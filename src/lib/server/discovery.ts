import "server-only";
import {
  buildResolveQuery,
  buildSearchQuery,
  normalizeResult,
} from "@/lib/osm";
import { HttpError } from "./guard";
import { OverpassUnavailableError, queryOverpass } from "./overpass";
import { discoverPhoton } from "./photon";
import { resolveSearchReference } from "./search-reference";
import { usesGoogleMaps } from "@/lib/maps-config";
import { discoverGooglePlaces, resolveGooglePlace } from "./google-maps";
import { signPlace, isVerifiedPlace } from "./place-verification";
import {
  placeIdSchema,
  isGooglePlace,
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
  provider: string;
  origin: "overpass" | "photon";
};
const cache = new Map<string, CacheEntry>();
const registry = new Map<string, { place: Place; expires: number }>();
const inFlight = new Map<string, Promise<CacheEntry>>();
function remember(places: Place[]) {
  for (const place of places) {
    if (isGooglePlace(place)) continue;
    if (registry.size >= 2000) registry.delete(registry.keys().next().value!);
    registry.set(place.id, {
      place,
      expires: Date.parse(place.observedAt) + 24 * 3600000,
    });
  }
}
export async function discoverPlaces(
  raw: SearchSpec,
  offset = 0,
): Promise<SearchResponse> {
  const spec = await resolveSearchReference(searchSpecSchema.parse(raw));
  if (usesGoogleMaps()) {
    const result = await discoverGooglePlaces(spec, offset);
    return { ...result, places: result.places.map(signPlace) };
  }
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
          let result: ReturnType<typeof normalizeResult>;
          let provider: string;
          let origin: "overpass" | "photon" = "overpass";
          try {
            const upstream = await queryOverpass(buildSearchQuery(spec));
            result = normalizeResult(upstream.data, observedAt, spec);
            provider = upstream.provider;
          } catch (error) {
            if (
              !(error instanceof OverpassUnavailableError) ||
              process.env.PHOTON_FALLBACK_ENABLED === "false"
            )
              throw error;
            result = await discoverPhoton(spec, observedAt);
            provider = "photon.komoot.io";
            origin = "photon";
          }
          const fresh = {
            ...result,
            places: result.places.map(signPlace),
            observedAt,
            // Retry the primary after its cooldown instead of keeping fallback results for 15 minutes.
            expires: Date.now() + (origin === "photon" ? 60000 : 15 * 60000),
            provider,
            origin,
          };
          if (cache.size >= 40) cache.delete(cache.keys().next().value!);
          cache.set(key, fresh);
          remember(fresh.places);
          return fresh;
        })();
        inFlight.set(key, pending);
      }
      hit = await pending;
      source = hit.origin;
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
      ? "Datos guardados hace menos de 24 horas; proveedor temporalmente no disponible."
      : hit.truncated
        ? "Se alcanzó el límite de resultados. Reduce el radio o filtra la búsqueda."
        : hit.origin === "photon"
          ? "Búsqueda de respaldo (Photon): cobertura limitada."
          : spec.regionalFood
            ? "Gastronomía regional según etiquetas de OSM; por confirmar."
            : null;
  return {
    places: hit.places.slice(offset, end),
    total: hit.places.length,
    truncated: hit.truncated,
    nextOffset: end < hit.places.length ? end : null,
    spec,
    source,
    provider: hit.provider,
    observedAt: hit.observedAt,
    notice,
  };
}
export async function resolvePlaces(
  ids: string[],
  snapshots: Place[] = [],
): Promise<Place[]> {
  remember(snapshots.filter((p) => ids.includes(p.id) && isVerifiedPlace(p)));
  const unique = [...new Set(ids)];
  if (
    unique.length > 30 ||
    unique.some((id) => !placeIdSchema.safeParse(id).success)
  )
    throw new HttpError(400, "Identificadores de lugares no válidos.");
  const google = new Map<string, Place>();
  // Google content lives only in the active request/browser session. Saved
  // journeys retain IDs and fetch fresh details when opened again.
  const googleIds = unique.filter((id) => id.startsWith("google:"));
  if (googleIds.length && !usesGoogleMaps())
    throw new HttpError(
      409,
      "Activa Google Maps para abrir estos lugares guardados.",
    );
  for (let start = 0; start < googleIds.length; start += 5) {
    await Promise.all(
      googleIds.slice(start, start + 5).map(async (id) => {
        const snapshot = snapshots.find(
          (p) => p.id === id && isVerifiedPlace(p),
        );
        google.set(id, snapshot ?? signPlace(await resolveGooglePlace(id)));
      }),
    );
  }
  const missing = unique
    .filter((id) => !id.startsWith("google:"))
    .filter(
      (id) => !registry.has(id) || registry.get(id)!.expires < Date.now(),
    );
  if (missing.length) {
    try {
      const now = new Date().toISOString();
      const upstream = await queryOverpass(buildResolveQuery(missing));
      const result = normalizeResult(upstream.data, now);
      remember(result.places.map(signPlace));
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
      if (google.has(id)) return google.get(id);
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
