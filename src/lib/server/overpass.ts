import "server-only";
import { HttpError, rateLimit } from "./guard";

const DEFAULT_PRIMARY = "https://overpass.private.coffee/api/interpreter";
let nextSlot = 0;
let limitedUntil = 0;
const unavailableUntil = new Map<string, number>();

function providers() {
  try {
    return [
      ...new Set(
        [
          process.env.OVERPASS_API_URL?.trim() || DEFAULT_PRIMARY,
          process.env.OVERPASS_FALLBACK_URL === "disabled"
            ? ""
            : process.env.OVERPASS_FALLBACK_URL?.trim() || "",
        ].filter(Boolean),
      ),
    ].map((value) => {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error();
      return url;
    });
  } catch {
    throw new HttpError(
      503,
      "El servicio de búsqueda no está configurado correctamente.",
    );
  }
}

class Unavailable extends Error {}

export class OverpassUnavailableError extends HttpError {
  constructor() {
    super(
      503,
      "El servicio de búsqueda de lugares no está disponible temporalmente. Intenta de nuevo en un minuto.",
      60,
    );
  }
}

async function requestProvider(url: URL, query: string) {
  const delay = Math.max(0, nextSlot - Date.now());
  if (delay > 3500)
    throw new HttpError(
      429,
      "Hay varias búsquedas en curso. Reintenta en unos segundos.",
      5,
    );
  rateLimit("overpass:minute", 15, 60000);
  nextSlot = Date.now() + delay + 1600;
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const signal = AbortSignal.timeout(15000);
  const response = await fetch(url.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": `TurismoInteligentePasto/2.0 (+${process.env.APP_PUBLIC_URL || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")}/fuentes; academic prototype)`,
    },
    body: new URLSearchParams({ data: query }),
    signal,
    cache: "no-store",
  });
  // Access denials and quotas stop the whole lookup. Never use a backup to bypass them.
  if ([401, 403, 406, 429].includes(response.status)) {
    const retry = Math.min(
      300,
      Math.max(60, Number(response.headers.get("Retry-After")) || 60),
    );
    limitedUntil = Date.now() + retry * 1000;
    await response.body?.cancel();
    throw new HttpError(
      503,
      "El proveedor de lugares limitó temporalmente las consultas. Espera antes de volver a buscar.",
      retry,
    );
  }
  if (response.status >= 500) {
    await response.body?.cancel();
    throw new Unavailable(`http_${response.status}`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(
      503,
      "El proveedor no pudo procesar la búsqueda. Prueba otra zona o categoría.",
      30,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Unavailable("empty_response");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 3_000_000) {
        await reader.cancel();
        throw new HttpError(
          413,
          "Demasiados datos en esta zona. Reduce el radio o elige una categoría.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Unavailable("invalid_json");
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("elements" in data) ||
    !Array.isArray(data.elements)
  )
    throw new Unavailable("invalid_response");
  if ("remark" in data && data.remark)
    throw new HttpError(
      503,
      "La consulta superó los recursos disponibles del proveedor. Reduce el radio o elige una categoría.",
      30,
    );
  return data;
}

export async function queryOverpass(query: string) {
  if (Date.now() < limitedUntil)
    throw new HttpError(
      503,
      "El proveedor de lugares está ocupado. Espera antes de volver a buscar.",
      Math.ceil((limitedUntil - Date.now()) / 1000),
    );
  for (const url of providers()) {
    if ((unavailableUntil.get(url.href) ?? 0) > Date.now()) continue;
    try {
      return {
        data: await requestProvider(url, query),
        provider: url.hostname,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      unavailableUntil.set(url.href, Date.now() + 60000);
      console.warn("[overpass] Provider unavailable", {
        provider: url.hostname,
        reason:
          error instanceof Unavailable
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "timeout"
              : "network_error",
      });
    }
  }
  throw new OverpassUnavailableError();
}
