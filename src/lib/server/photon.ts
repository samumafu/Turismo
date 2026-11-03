import "server-only";
import { z } from "zod";
import { deduplicatePlaces, normalizeElement } from "@/lib/osm";
import {
  haversine,
  normalize,
  searchZones,
  type SearchSpec,
  type Place,
} from "@/lib/places";
import { HttpError, rateLimit } from "./guard";

const tags: Record<SearchSpec["categories"][number], string[]> = {
  turismo: [
    "tourism:attraction",
    "tourism:museum",
    "tourism:viewpoint",
    "tourism:gallery",
    "historic:monument",
    "leisure:park",
  ],
  museos: ["tourism:museum"],
  monumentos: [
    "historic:monument",
    "historic:memorial",
    "historic:archaeological_site",
    "amenity:place_of_worship",
  ],
  parques: ["leisure:park", "leisure:garden", "leisure:nature_reserve"],
  miradores: ["tourism:viewpoint"],
  naturaleza: [
    "natural:water",
    "natural:wood",
    "natural:peak",
    "natural:beach",
    "natural:cave_entrance",
    "natural:hot_spring",
    "leisure:nature_reserve",
    "waterway:waterfall",
    "boundary:protected_area",
    "landuse:forest",
  ],
  cascadas: ["waterway:waterfall", "natural:waterfall"],
  restaurantes: ["amenity:restaurant"],
  cafeterias: ["amenity:cafe"],
  alojamientos: [
    "tourism:hotel",
    "tourism:hostel",
    "tourism:guest_house",
    "tourism:camp_site",
  ],
  cultura: [
    "tourism:museum",
    "tourism:gallery",
    "tourism:artwork",
    "amenity:arts_centre",
    "amenity:theatre",
    "amenity:library",
  ],
};
const featureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    osm_type: z.enum(["N", "W", "R"]),
    osm_id: z.number().int().positive(),
    osm_key: z.string(),
    osm_value: z.string(),
    name: z.string(),
    countrycode: z.string(),
    state: z.string(),
    city: z.string().optional(),
  }),
});
let nextSlot = 0;
let pausedUntil = 0;

export function photonUrl(spec: SearchSpec) {
  const [lat, lon] = spec.center ?? searchZones[spec.zone].center;
  const dy = spec.radius / 111000;
  const dx = dy / Math.cos((lat * Math.PI) / 180);
  const url = new URL(
    spec.name
      ? "https://photon.komoot.io/api/"
      : "https://photon.komoot.io/reverse",
  );
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    limit: "50",
  }).toString();
  if (spec.name) {
    url.searchParams.set("q", spec.name);
    url.searchParams.set("countrycode", "CO");
    url.searchParams.set(
      "bbox",
      [lon - dx, lat - dy, lon + dx, lat + dy].join(","),
    );
  } else url.searchParams.set("radius", String(spec.radius / 1000));
  for (const tag of new Set(spec.categories.flatMap((c) => tags[c])))
    url.searchParams.append("osm_tag", tag);
  return url;
}

export function normalizePhoton(
  data: unknown,
  spec: SearchSpec,
  observedAt: string,
): Place[] {
  const collection = z
    .object({ features: z.array(z.unknown()).max(100) })
    .parse(data);
  const allowed = new Set(spec.categories.flatMap((c) => tags[c]));
  const center = spec.center ?? searchZones[spec.zone].center;
  const places: Place[] = [];
  for (const raw of collection.features) {
    const parsed = featureSchema.safeParse(raw);
    if (!parsed.success) continue;
    const { properties: p, geometry: g } = parsed.data;
    const [lon, lat] = g.coordinates;
    if (
      p.countrycode.toUpperCase() !== "CO" ||
      !/^(departamento de )?narino$/.test(normalize(p.state)) ||
      haversine([...center], [lat, lon]) > spec.radius ||
      !allowed.has(`${p.osm_key}:${p.osm_value}`)
    )
      continue;
    if (spec.name && !normalize(p.name).includes(normalize(spec.name)))
      continue;
    // This index cannot verify regional cuisine, opening hours, prices or access.
    if (spec.regionalFood) continue;
    const type = { N: "node", W: "way", R: "relation" }[p.osm_type];
    const place = normalizeElement(
      {
        type,
        id: p.osm_id,
        ...(type === "node" ? { lat, lon } : { center: { lat, lon } }),
        tags: {
          name: p.name,
          [p.osm_key]: p.osm_value,
          "addr:city": p.city || p.state,
        },
      },
      observedAt,
    );
    if (!place) continue;
    place.note +=
      " Resultado del índice Photon de OpenStreetMap; confirma acceso, horarios y vigencia antes de ir.";
    place.sources.push({
      label: "Índice Photon / OpenStreetMap",
      url: "https://photon.komoot.io/",
    });
    places.push(place);
  }
  return deduplicatePlaces(places)
    .sort(
      (a, b) =>
        haversine([...center], a.coordinates) -
        haversine([...center], b.coordinates),
    )
    .slice(0, 50);
}

export async function requestPhoton(url: URL) {
  if (Date.now() < pausedUntil)
    throw new HttpError(
      503,
      "El buscador alternativo está ocupado. Intenta en un minuto.",
      60,
    );
  const delay = Math.max(0, nextSlot - Date.now());
  if (delay > 2000)
    throw new HttpError(
      429,
      "Hay varias búsquedas en curso. Espera unos segundos.",
      5,
    );
  rateLimit("photon:minute", 10, 60000);
  nextSlot = Date.now() + delay + 1500;
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": `TurismoInteligentePasto/2.0 (+${process.env.APP_PUBLIC_URL || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")}/fuentes)`,
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) {
      pausedUntil = Date.now() + 60000;
      await response.body?.cancel();
      throw new HttpError(
        503,
        "Los buscadores de lugares no están disponibles temporalmente. Intenta en un minuto.",
        60,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty Photon response");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1_000_000) {
          await reader.cancel();
          throw new Error("Oversized Photon response");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    pausedUntil = Date.now() + 60000;
    throw new HttpError(
      503,
      "No se pudo conectar con los buscadores de lugares. Intenta en un minuto.",
      60,
    );
  }
}

export async function discoverPhoton(spec: SearchSpec, observedAt: string) {
  return {
    places: normalizePhoton(
      await requestPhoton(photonUrl(spec)),
      spec,
      observedAt,
    ),
    truncated: false,
  };
}
