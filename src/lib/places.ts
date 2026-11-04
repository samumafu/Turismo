import { z } from "zod";

export const categoryKeys = [
  "turismo",
  "museos",
  "monumentos",
  "parques",
  "miradores",
  "naturaleza",
  "cascadas",
  "restaurantes",
  "cafeterias",
  "alojamientos",
  "cultura",
] as const;
export const categoryLabels: Record<(typeof categoryKeys)[number], string> = {
  turismo: "Atractivos turísticos",
  museos: "Museos",
  monumentos: "Monumentos y patrimonio",
  parques: "Parques",
  miradores: "Miradores",
  naturaleza: "Naturaleza",
  cascadas: "Cascadas",
  restaurantes: "Restaurantes",
  cafeterias: "Cafeterías",
  alojamientos: "Alojamientos",
  cultura: "Sitios culturales",
};
// Search anchors, not a POI catalog. Other areas are selected directly on the map.
export const searchZones = {
  pasto: { label: "Pasto", center: [1.2146, -77.2783] },
  ipiales: { label: "Ipiales", center: [0.827, -77.64] },
  cocha: { label: "La Cocha / El Encano", center: [1.129, -77.154] },
  tumaco: { label: "Tumaco", center: [1.807, -78.76] },
  tuquerres: { label: "Túquerres", center: [1.088, -77.618] },
  sandona: { label: "Sandoná", center: [1.283, -77.471] },
  buesaco: { label: "Buesaco", center: [1.383, -77.156] },
  chachagui: { label: "Chachagüí", center: [1.359, -77.283] },
  union: { label: "La Unión", center: [1.6, -77.131] },
} as const;
export type ZoneKey = keyof typeof searchZones;
export const zoneKeys = Object.keys(searchZones) as [ZoneKey, ...ZoneKey[]];
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const coordinateSchema = z.tuple([
  z.number().min(-0.1).max(3),
  z.number().min(-79.5).max(-76.3),
]);
export const osmIdSchema = z
  .string()
  .regex(/^osm:(node|way|relation):[1-9]\d{0,14}$/);
export const googleIdSchema = z.string().regex(/^google:[A-Za-z0-9_-]{5,240}$/);
export const placeIdSchema = z.union([osmIdSchema, googleIdSchema]);
export const googleAuthorSchema = z.object({
  displayName: z.string().max(250),
  uri: z
    .string()
    .url()
    .regex(/^https?:\/\//)
    .max(1000)
    .optional(),
});
export const placeSchema = z.object({
  id: placeIdSchema,
  name: z.string().min(1).max(180),
  category: z.string().max(80),
  categoryKey: z.enum(categoryKeys),
  region: z.string().max(140),
  description: z.string().max(600),
  coordinates: coordinateSchema,
  coordinateKind: z.enum(["node", "center", "place"]),
  zone: z.string().max(100),
  visitMinutes: z.number().nullable(),
  costCOP: z.null(),
  openingHours: z.string().max(200).nullable(),
  availability: z.enum(["confirmar", "restringido"]),
  roadAccess: z.boolean(),
  sources: z
    .array(
      z.object({ label: z.string().max(100), url: z.string().url().max(500) }),
    )
    .max(4),
  note: z.string().max(800),
  observedAt: z.string().datetime(),
  cuisine: z.string().max(140).nullable(),
  image: z.string().optional(),
  wikidata: z
    .string()
    .regex(/^Q[1-9]\d*$/)
    .optional(),
  commons: z.string().max(250).optional(),
  verification: z.string().max(100).optional(),
  googlePhoto: z
    .object({
      name: z
        .string()
        .regex(/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/)
        .max(2000),
      authors: z.array(googleAuthorSchema).max(10),
    })
    .optional(),
  googleAttributions: z
    .array(
      z.object({
        provider: z.string().max(250),
        providerUri: z
          .string()
          .url()
          .regex(/^https?:\/\//)
          .max(1000)
          .optional(),
      }),
    )
    .max(10)
    .optional(),
});
export type Place = z.infer<typeof placeSchema>;
export const isGooglePlace = (place: Pick<Place, "id">) =>
  place.id.startsWith("google:");
export const searchSpecSchema = z.object({
  zone: z.enum(zoneKeys).default("pasto"),
  center: coordinateSchema.optional(),
  radius: z.number().int().min(500).max(25000).default(8000),
  categories: z.array(z.enum(categoryKeys)).min(1).max(3).default(["turismo"]),
  name: z.string().trim().max(80).default(""),
  near: z.string().trim().max(160).optional(),
  reference: z
    .object({ id: placeIdSchema, name: z.string().max(180) })
    .optional(),
  regionalFood: z.boolean().default(false),
});
export type SearchSpec = z.infer<typeof searchSpecSchema>;
export const searchRequestSchema = z.object({
  text: z.string().trim().max(300).default(""),
  spec: searchSpecSchema.default(searchSpecSchema.parse({})),
  offset: z.number().int().min(0).max(500).default(0),
});
export const searchResponseSchema = z.object({
  places: z.array(placeSchema).max(50),
  total: z.number().int(),
  truncated: z.boolean(),
  nextOffset: z.number().nullable(),
  spec: searchSpecSchema,
  source: z.enum(["google", "overpass", "photon", "cache", "stale-cache"]),
  provider: z.string().max(200).optional(),
  observedAt: z.string(),
  notice: z.string().nullable(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export function haversine(a: number[], b: number[]) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const t =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(t), Math.sqrt(1 - t));
}
export function mapsLink(place: Place) {
  if (isGooglePlace(place))
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.id.slice(7))}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.coordinates.join(","))}`;
}
export function directionsLink(
  stops: Place[],
  mode = "driving",
  origin?: [number, number],
) {
  const params = new URLSearchParams({ api: "1", travelmode: mode });
  const coords = stops.map((p) => p.coordinates.join(","));
  if (origin && coords.length) {
    params.set("origin", origin.join(","));
    params.set("destination", coords.at(-1)!);
    if (coords.length > 1)
      params.set("waypoints", coords.slice(0, -1).join("|"));
  } else if (coords.length > 1) {
    params.set("origin", coords[0]);
    params.set("destination", coords.at(-1)!);
    if (coords.length > 2)
      params.set("waypoints", coords.slice(1, -1).join("|"));
  } else if (coords.length) params.set("destination", coords[0]);
  return `https://www.google.com/maps/dir/?${params}`;
}
export const cop = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export function interpretSearch(
  text: string,
  previous = searchSpecSchema.parse({}),
): SearchSpec {
  const t = normalize(text);
  const spec = {
    ...previous,
    center: previous.center,
    categories: [...previous.categories],
  };
  const zone = [...zoneKeys].find(
    (key) =>
      t.includes(normalize(searchZones[key].label.split(" / ")[0])) ||
      (key === "cocha" && /cocha|encano/.test(t)) ||
      (key === "union" && /la union/.test(t)),
  );
  if (zone) {
    spec.zone = zone;
    spec.center = undefined;
    if (zone !== previous.zone) {
      spec.near = undefined;
      spec.reference = undefined;
    }
  }
  const detected: SearchSpec["categories"] = [];
  const patterns: [RegExp, SearchSpec["categories"][number]][] = [
    [/cascada|salto de agua/, "cascadas"],
    [/restaurante|comida|gastronom|tipic/, "restaurantes"],
    [/cafeteria|cafe\b/, "cafeterias"],
    [/hotel|alojamiento|hostal/, "alojamientos"],
    [/museo/, "museos"],
    [/mirador/, "miradores"],
    [/parque/, "parques"],
    [/naturale|natural|laguna|bosque/, "naturaleza"],
    [/monumento|patrimonio|templo/, "monumentos"],
    [/cultura|cultural|arte/, "cultura"],
  ];
  for (const [pattern, category] of patterns)
    if (pattern.test(t)) detected.push(category);
  if (detected.length) {
    spec.categories = detected.slice(0, 3);
    spec.name = "";
    spec.regionalFood =
      /tipic|regional|tradicional/.test(t) &&
      spec.categories.includes("restaurantes");
  }
  const radius = t.match(
    /(?:radio(?: de)?|a menos de|hasta)\s*(\d+)\s*(km|metros|m)\b/,
  );
  if (radius)
    spec.radius = Math.max(
      500,
      Math.min(25000, Number(radius[1]) * (radius[2] === "km" ? 1000 : 1)),
    );
  const named = text.match(/[“"]([^”"]{2,80})[”"]/);
  const targetText =
    /reemplaza|sustituye/.test(t) && /\spor\s/i.test(text)
      ? text.split(/\spor\s/i).at(-1)!
      : text.replace(/^(?:añade|agrega|incluye)\s+/i, "");
  const lead = targetText
    .split(/\s+(?:en|cerca|alrededor|a menos)\s/i)[0]
    .trim();
  const prefix =
    /^(?:museos?|restaurantes?|cafeter[ií]as?|cascadas?|miradores?|parques?|hoteles?|hotel)\s+/i;
  const suffix = lead.replace(prefix, "").trim();
  if (
    prefix.test(lead) &&
    suffix &&
    !/^(tipicos?|regionales?|tradicionales?|culturales?|naturales?)$/.test(
      normalize(suffix),
    ) &&
    !/presupuesto|\d+\s*d[ií]as/.test(normalize(lead))
  )
    spec.name = suffix.slice(0, 80);
  if (named) spec.name = named[1];
  else if (
    text.trim() &&
    !radius &&
    !zone &&
    !detected.length &&
    !/dia|presupuesto|somos|viajo|cambia|reduce|hora|persona|carro|pie|bus|anade|reemplaza/.test(
      t,
    )
  )
    spec.name = text.trim().slice(0, 80);
  const nearby = text.match(
    /\b(?:cerca(?:no|na|nos|nas)?\s+(?:del?|a)|alrededor\s+de|junto\s+a)\s+(?:(?:la|el|los|las)\s+)?(.+?)(?:[.!?]|$)/i,
  );
  if (zone && detected.length && !nearby) {
    spec.near = undefined;
    spec.reference = undefined;
  }
  if (nearby && detected.length) {
    const near = nearby[1].trim().slice(0, 160);
    if (normalize(near) !== normalize(previous.near ?? "")) {
      spec.center = undefined;
      spec.reference = undefined;
    }
    spec.near = near;
    if (!radius) spec.radius = 1500;
    // The reference is not the name of the cafe/restaurant being sought.
    if (spec.name && normalize(spec.name).includes(normalize(near)))
      spec.name = "";
  }
  return searchSpecSchema.parse(spec);
}
