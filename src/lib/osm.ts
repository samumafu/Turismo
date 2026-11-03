import {
  categoryLabels,
  haversine,
  normalize,
  placeSchema,
  searchZones,
  type Place,
  type SearchSpec,
} from "./places";

const selectors: Record<SearchSpec["categories"][number], string[]> = {
  turismo: [
    '[tourism~"^(attraction|museum|viewpoint|gallery|artwork|zoo|theme_park)$"]',
    '[historic~"^(monument|memorial|archaeological_site|ruins|castle)$"]',
    "[leisure=park]",
  ],
  museos: ["[tourism=museum]"],
  monumentos: [
    '[historic~"^(monument|memorial|archaeological_site|ruins|castle)$"]',
    "[amenity=place_of_worship][name]",
  ],
  parques: ['[leisure~"^(park|garden|nature_reserve)$"]'],
  miradores: ["[tourism=viewpoint]"],
  naturaleza: [
    '[natural~"^(water|wood|peak|beach|cave_entrance|hot_spring|volcano)$"][name]',
    "[leisure=nature_reserve]",
    "[waterway=waterfall]",
    "[boundary=protected_area][name]",
    "[landuse=forest][name]",
    "[tourism=picnic_site]",
  ],
  cascadas: ["[waterway=waterfall]", "[natural=waterfall]"],
  restaurantes: ["[amenity=restaurant]"],
  cafeterias: ["[amenity=cafe]"],
  alojamientos: [
    '[tourism~"^(hotel|hostel|guest_house|motel|camp_site|chalet)$"]',
  ],
  cultura: [
    '[tourism~"^(museum|gallery|artwork)$"]',
    '[amenity~"^(arts_centre|theatre|cultural_centre|library)$"][name]',
  ],
};
const literalRegex = (text: string) =>
  JSON.stringify(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
export function buildSearchQuery(spec: SearchSpec) {
  const [lat, lng] = spec.center ?? searchZones[spec.zone].center;
  const name = spec.name ? `[name~${literalRegex(spec.name)},i]` : "";
  const cuisine = spec.regionalFood
    ? '[cuisine~"(^|;)(regional|local|colombian)(;|$)",i]'
    : "";
  const filters = [
    ...new Set(spec.categories.flatMap((category) => selectors[category])),
  ];
  return `[out:json][timeout:12][maxsize:16777216];area["ISO3166-2"="CO-NAR"][admin_level=4]->.narino;(${filters.map((s) => `nwr(area.narino)(around:${spec.radius},${lat},${lng})${s}${name}${cuisine};`).join("")});out body center 501;`;
}
export function buildResolveQuery(ids: string[]) {
  const groups = ["node", "way", "relation"].map((type) => {
    const values = ids
      .filter((id) => id.startsWith(`osm:${type}:`))
      .map((id) => id.split(":")[2]);
    return values.length ? `${type}(id:${values.join(",")})(area.narino);` : "";
  });
  return `[out:json][timeout:12][maxsize:8388608];area["ISO3166-2"="CO-NAR"][admin_level=4]->.narino;(${groups.join("")});out body center 30;`;
}
type Element = {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
};
function categoryFor(
  t: Record<string, string>,
): SearchSpec["categories"][number] | null {
  if (t.waterway === "waterfall" || t.natural === "waterfall")
    return "cascadas";
  if (t.amenity === "restaurant") return "restaurantes";
  if (t.amenity === "cafe") return "cafeterias";
  if (
    /^(hotel|hostel|guest_house|motel|camp_site|chalet)$/.test(t.tourism ?? "")
  )
    return "alojamientos";
  if (t.tourism === "museum") return "museos";
  if (t.tourism === "viewpoint") return "miradores";
  if (t.historic || t.amenity === "place_of_worship") return "monumentos";
  if (/^(park|garden)$/.test(t.leisure ?? "")) return "parques";
  if (
    t.natural ||
    t.leisure === "nature_reserve" ||
    t.boundary === "protected_area" ||
    t.landuse === "forest" ||
    t.tourism === "picnic_site"
  )
    return "naturaleza";
  if (
    /^(gallery|artwork)$/.test(t.tourism ?? "") ||
    /^(arts_centre|theatre|cultural_centre|library)$/.test(t.amenity ?? "")
  )
    return "cultura";
  if (
    t.tourism === "attraction" ||
    t.tourism === "zoo" ||
    t.tourism === "theme_park"
  )
    return "turismo";
  return null;
}
function safeWebsite(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href.slice(0, 500)
      : null;
  } catch {
    return null;
  }
}
export function normalizeElement(
  element: Element,
  observedAt: string,
): Place | null {
  if (
    !/^(node|way|relation)$/.test(String(element.type)) ||
    !Number.isSafeInteger(element.id) ||
    Number(element.id) <= 0
  )
    return null;
  const t = Object.fromEntries(
    Object.entries(element.tags ?? {})
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([k, v]) => [k, v.slice(0, 800)]),
  );
  const category = categoryFor(t);
  if (!category) return null;
  const lat = element.type === "node" ? element.lat : element.center?.lat;
  const lng = element.type === "node" ? element.lon : element.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const id = `osm:${element.type}:${element.id}`;
  const name = (
    t["name:es"] ||
    t.name ||
    `${categoryLabels[category]} sin nombre en OSM`
  ).slice(0, 180);
  const restricted =
    /^(private|no|permit)$/.test(t.access ?? "") ||
    t.disused === "yes" ||
    t.abandoned === "yes" ||
    t.natural === "volcano" ||
    (category === "naturaleza" && /corota/.test(normalize(name)));
  const website = safeWebsite(t.website || t["contact:website"]);
  const openingHours = t.opening_hours?.slice(0, 200) || null;
  const note = restricted
    ? "Acceso restringido o sujeto a autorización. No se incluye automáticamente en itinerarios; confirma con la autoridad o el responsable."
    : "Registro comunitario de OpenStreetMap, no verificación presencial. Confirma acceso, tarifas y disponibilidad. El punto puede representar el centro del lugar, no una entrada.";
  const parsed = placeSchema.safeParse({
    id,
    name,
    category: categoryLabels[category],
    categoryKey: category,
    coordinates: [lat, lng],
    coordinateKind: element.type === "node" ? "node" : "center",
    region: (
      t["addr:city"] ||
      t["addr:town"] ||
      t["addr:village"] ||
      "Nariño"
    ).slice(0, 140),
    zone: "osm",
    description: `${categoryLabels[category]} registrado en OpenStreetMap.${t.description ? ` Nota de la comunidad: ${t.description.slice(0, 350)}` : " Consulta el registro de origen para conocer sus etiquetas."}`,
    visitMinutes:
      category === "cafeterias" ? 45 : category === "restaurantes" ? 60 : 75,
    costCOP: null,
    openingHours,
    availability: restricted ? "restringido" : "confirmar",
    roadAccess: !restricted && !["naturaleza", "cascadas"].includes(category),
    sources: [
      {
        label: "OpenStreetMap · registro de origen",
        url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      },
      ...(website ? [{ label: "Sitio indicado en OSM", url: website }] : []),
    ],
    note,
    observedAt,
    cuisine: t.cuisine?.slice(0, 140) || null,
  });
  return parsed.success ? parsed.data : null;
}
export function deduplicatePlaces(input: Place[]) {
  const output: Place[] = [];
  const ids = new Set<string>();
  for (const p of input) {
    if (ids.has(p.id)) continue;
    ids.add(p.id);
    const name = normalize(p.name).replace(/[^a-z0-9]/g, "");
    if (
      !/sin nombre/.test(normalize(p.name)) &&
      output.some(
        (v) =>
          v.categoryKey === p.categoryKey &&
          normalize(v.name).replace(/[^a-z0-9]/g, "") === name &&
          haversine(v.coordinates, p.coordinates) < 40,
      )
    )
      continue;
    output.push(p);
  }
  return output;
}
export function normalizeResult(
  raw: unknown,
  observedAt: string,
  spec?: SearchSpec,
) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("elements" in raw) ||
    !Array.isArray(raw.elements) ||
    "remark" in raw
  )
    throw new Error("Overpass returned incomplete data");
  if (raw.elements.length > 1000) throw new Error("Unexpected response size");
  let items = raw.elements
    .map((e: Element) => normalizeElement(e, observedAt))
    .filter((p): p is Place => p !== null);
  if (spec) {
    const center = spec.center ?? searchZones[spec.zone].center;
    items = items.filter(
      (p) => haversine([...center], p.coordinates) <= spec.radius,
    );
    items.sort(
      (a, b) =>
        haversine([...center], a.coordinates) -
        haversine([...center], b.coordinates),
    );
  }
  return {
    places: deduplicatePlaces(items).slice(0, 500),
    truncated: raw.elements.length >= 501,
  };
}
