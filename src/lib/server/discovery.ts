import "server-only";
import {
  buildResolveQuery,
  buildSearchQuery,
  normalizeResult,
} from "@/lib/osm";
import { HttpError, rateLimit } from "./guard";
import {
  osmIdSchema,
  searchSpecSchema,
  type Place,
  type SearchResponse,
  type SearchSpec,
} from "@/lib/places";

type CacheEntry = {
  places: Place[];
  truncated: boolean;
  observedAt: string;
  expires: number;
};
const cache = new Map<string, CacheEntry>();
const registry = new Map<string, { place: Place; expires: number }>();
const inFlight = new Map<string, Promise<CacheEntry>>();
let nextSlot = 0;
let backoffUntil = 0;
function endpoint() {
  const url = new URL(
    process.env.OVERPASS_API_URL ||
      "https://overpass.private.coffee/api/interpreter",
  );
  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV === "test" && url.hostname === "localhost")
  )
    throw new Error("Overpass must use HTTPS");
  return url.href;
}
function remember(places: Place[]) {
  for (const place of places) {
    if (registry.size >= 2000) registry.delete(registry.keys().next().value!);
    registry.set(place.id, { place, expires: Date.now() + 24 * 3600000 });
  }
}
async function remote(query: string): Promise<unknown> {
  if (Date.now() < backoffUntil)
    throw new HttpError(
      503,
      "OpenStreetMap está ocupado. Espera un minuto y vuelve a intentar.",
      Math.ceil((backoffUntil - Date.now()) / 1000),
    );
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
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": `TurismoInteligentePasto/2.0 (+${process.env.APP_PUBLIC_URL || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")}/fuentes; academic prototype)`,
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (
    response.status === 406 ||
    response.status === 429 ||
    response.status === 504 ||
    response.status === 503
  )
    backoffUntil = Date.now() + 60000;
  if (!response.ok)
    throw new HttpError(
      503,
      "No se pudo consultar OpenStreetMap. Reintenta más tarde; no se reemplazarán los datos con lugares inventados.",
      60,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing Overpass response");
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
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
export async function discoverPlaces(
  raw: SearchSpec,
  offset = 0,
): Promise<SearchResponse> {
  const spec = searchSpecSchema.parse(raw);
  if (spec.center)
    spec.center = spec.center.map((n) => Math.round(n * 10000) / 10000) as [
      number,
      number,
    ];
  const key = JSON.stringify(spec);
  let hit = cache.get(key);
  let source: SearchResponse["source"] = "cache";
  if (!hit || hit.expires < Date.now()) {
    try {
      let pending = inFlight.get(key);
      if (!pending) {
        pending = (async () => {
          const observedAt = new Date().toISOString();
          const result = normalizeResult(
            await remote(buildSearchQuery(spec)),
            observedAt,
            spec,
          );
          const fresh = {
            ...result,
            observedAt,
            expires: Date.now() + 15 * 60000,
          };
          if (cache.size >= 40) cache.delete(cache.keys().next().value!);
          cache.set(key, fresh);
          remember(fresh.places);
          return fresh;
        })();
        inFlight.set(key, pending);
      }
      hit = await pending;
      source = "overpass";
    } catch (error) {
      if (hit && Date.now() - Date.parse(hit.observedAt) < 24 * 3600000)
        source = "stale-cache";
      else if (error instanceof HttpError) throw error;
      else
        throw new HttpError(
          503,
          "La búsqueda de OpenStreetMap no respondió. Puedes reducir el radio y volver a intentar.",
          30,
        );
    } finally {
      inFlight.delete(key);
    }
  }
  const end = Math.min(offset + 50, hit.places.length);
  const notice =
    source === "stale-cache"
      ? "El proveedor no respondió. Se muestran datos OSM guardados temporalmente, de menos de 24 horas."
      : hit.truncated
        ? "La consulta alcanzó el límite de 500 registros. Reduce el radio o filtra por nombre/categoría para explorar otros resultados."
        : spec.regionalFood
          ? "La comida regional se filtra por etiquetas cuisine de OSM. Los lugares sin esa etiqueta no se presentan como típicos."
          : null;
  return {
    places: hit.places.slice(offset, end),
    total: hit.places.length,
    truncated: hit.truncated,
    nextOffset: end < hit.places.length ? end : null,
    spec,
    source,
    observedAt: hit.observedAt,
    notice,
  };
}
export async function resolvePlaces(ids: string[]): Promise<Place[]> {
  const unique = [...new Set(ids)];
  if (
    unique.length > 30 ||
    unique.some((id) => !osmIdSchema.safeParse(id).success)
  )
    throw new HttpError(400, "Identificadores OSM no válidos.");
  const missing = unique.filter(
    (id) => !registry.has(id) || registry.get(id)!.expires < Date.now(),
  );
  if (missing.length) {
    try {
      const now = new Date().toISOString();
      const result = normalizeResult(
        await remote(buildResolveQuery(missing)),
        now,
      );
      remember(result.places);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        "No se pudieron volver a comprobar los lugares del plan. Reintenta cuando OpenStreetMap responda.",
        30,
      );
    }
  }
  const output = unique
    .map((id) => {
      const entry = registry.get(id);
      return entry && entry.expires > Date.now() ? entry.place : undefined;
    })
    .filter((p): p is Place => !!p);
  if (output.length !== unique.length)
    throw new HttpError(
      409,
      "Un lugar del plan ya no está disponible en OpenStreetMap. Inicia una nueva búsqueda.",
    );
  return output;
}
