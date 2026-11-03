import "server-only";
import { z } from "zod";
import {
  coordinateSchema,
  haversine,
  normalize,
  searchZones,
  type SearchSpec,
} from "@/lib/places";
import { HttpError } from "./guard";
import { requestPhoton } from "./photon";

const featureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    osm_type: z.enum(["N", "W", "R"]),
    osm_id: z.number().int().positive(),
    name: z.string().min(1).max(180),
    countrycode: z.string(),
    state: z.string(),
  }),
});
type Reference = {
  center: [number, number];
  reference: NonNullable<SearchSpec["reference"]>;
};
const cache = new Map<string, { value: Reference; expires: number }>();
const pending = new Map<string, Promise<Reference>>();

export function referenceUrl(spec: SearchSpec) {
  const query = spec
    .near!.replace(/\b(campus|sede)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const city = searchZones[spec.zone].label.split(" / ")[0];
  const url = new URL("https://photon.komoot.io/api/");
  url.search = new URLSearchParams({
    q: normalize(query).includes(normalize(city)) ? query : `${query} ${city}`,
    countrycode: "CO",
    bbox: "-79.5,-0.1,-76.3,3",
    limit: "5",
  }).toString();
  return url;
}

export function normalizeReference(data: unknown): Reference {
  const collection = z
    .object({ features: z.array(z.unknown()).max(100) })
    .parse(data);
  const matches: Reference[] = [];
  for (const raw of collection.features) {
    const result = featureSchema.safeParse(raw);
    if (!result.success) continue;
    const { properties: p, geometry } = result.data;
    const center = coordinateSchema.safeParse([
      geometry.coordinates[1],
      geometry.coordinates[0],
    ]);
    if (
      !center.success ||
      p.countrycode.toUpperCase() !== "CO" ||
      !/^(departamento de )?narino$/.test(normalize(p.state))
    )
      continue;
    const type = { N: "node", W: "way", R: "relation" }[p.osm_type];
    const id = `osm:${type}:${p.osm_id}`;
    if (
      matches.some(
        (m) =>
          m.reference.id === id ||
          (normalize(m.reference.name) === normalize(p.name) &&
            haversine(m.center, center.data) < 150),
      )
    )
      continue;
    matches.push({ center: center.data, reference: { id, name: p.name } });
  }
  if (!matches.length)
    throw new HttpError(
      422,
      "No pude ubicar ese punto de referencia en OpenStreetMap. Indica su nombre y el municipio, o selecciona la zona en el mapa.",
    );
  if (matches.length > 1)
    throw new HttpError(
      422,
      `Encontré varios puntos de referencia: ${matches
        .slice(0, 3)
        .map((m) => m.reference.name)
        .join(
          ", ",
        )}. Indica la sede o dirección para buscar cerca del correcto.`,
    );
  return matches[0];
}

export async function resolveSearchReference(
  spec: SearchSpec,
): Promise<SearchSpec> {
  if (!spec.near?.trim())
    return { ...spec, near: undefined, reference: undefined };
  const key = normalize(referenceUrl(spec).searchParams.get("q")!);
  let value = cache.get(key);
  if (!value || value.expires <= Date.now()) {
    let request = pending.get(key);
    if (!request) {
      request = requestPhoton(referenceUrl(spec)).then(normalizeReference);
      pending.set(key, request);
    }
    try {
      value = { value: await request, expires: Date.now() + 3600000 };
      if (cache.size >= 50) cache.delete(cache.keys().next().value!);
      cache.set(key, value);
    } finally {
      pending.delete(key);
    }
  }
  // Coordinates and identity come from the provider, never from Gemini or browser metadata.
  return { ...spec, ...value.value };
}
