import "server-only";
import { createHash } from "node:crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

// Bounded, best-effort protection per warm server instance; no paid storage.
const windows = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max: number, duration: number) {
  const now = Date.now();
  if (windows.size >= 2000) {
    for (const [id, entry] of windows)
      if (entry.reset <= now) windows.delete(id);
    if (windows.size >= 2000 && !windows.has(key))
      throw new HttpError(
        429,
        "El servicio está ocupado. Intenta en un minuto.",
        60,
      );
  }
  let window = windows.get(key);
  if (!window || window.reset <= now) {
    window = { count: 0, reset: now + duration };
    windows.set(key, window);
  }
  if (window.count >= max)
    throw new HttpError(
      429,
      "Has alcanzado el límite temporal. Espera antes de volver a intentar.",
      Math.ceil((window.reset - now) / 1000),
    );
  window.count++;
}

export function guardRequest(request: Request, namespace: string) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "Origen no permitido.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Origen no permitido.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Envía una solicitud JSON.");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  rateLimit(`${namespace}:${key}`, namespace === "chat" ? 10 : 12, 60_000);
}

export async function readJson(request: Request, maxBytes = 24000) {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new HttpError(
      413,
      "La conversación es demasiado larga. Inicia un nuevo viaje.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Falta el mensaje.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new HttpError(
          413,
          "La conversación es demasiado larga. Inicia un nuevo viaje.",
        );
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "El JSON no es válido.");
  } finally {
    reader.releaseLock();
  }
}

export function errorResponse(error: unknown) {
  const known = error instanceof HttpError;
  return Response.json(
    {
      error: known
        ? error.message
        : "No se pudo procesar la solicitud. Intenta de nuevo.",
    },
    {
      status: known ? error.status : 500,
      headers: {
        "Cache-Control": "no-store",
        ...(known && error.retryAfter
          ? { "Retry-After": String(error.retryAfter) }
          : {}),
      },
    },
  );
}
