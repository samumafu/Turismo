import "server-only";
import { z } from "zod";
import {
  categoryLabels,
  coordinateSchema,
  googleAuthorSchema,
  haversine,
  normalize,
  placeSchema,
  searchZones,
  type Place,
  type SearchSpec,
  type SearchResponse,
} from "@/lib/places";
import { HttpError, rateLimit } from "./guard";

// These fields keep searches and details in the Pro SKU. No ratings, hours,
// reviews, phone numbers, or other Enterprise fields are requested implicitly.
const fields = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "types",
  "businessStatus",
  "photos",
  "attributions",
];
type Category = SearchSpec["categories"][number];
const types: Record<Category, string[]> = {
  turismo: [
    "tourist_attraction",
    "museum",
    "park",
    "historical_landmark",
    "art_gallery",
  ],
  museos: ["museum"],
  monumentos: [
    "historical_landmark",
    "monument",
    "church",
    "cultural_landmark",
  ],
  parques: ["park", "garden", "botanical_garden", "national_park"],
  miradores: ["observation_deck", "tourist_attraction"],
  naturaleza: [
    "national_park",
    "state_park",
    "hiking_area",
    "natural_feature",
    "lake",
    "mountain_peak",
    "nature_preserve",
    "river",
    "woods",
    "beach",
  ],
  cascadas: ["tourist_attraction", "natural_feature"],
  restaurantes: ["restaurant"],
  cafeterias: ["cafe", "coffee_shop"],
  alojamientos: ["hotel", "lodging", "hostel", "campground", "guest_house"],
  cultura: [
    "museum",
    "art_gallery",
    "cultural_center",
    "performing_arts_theater",
    "library",
  ],
};
const rawPlaceSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{5,240}$/),
  displayName: z.object({ text: z.string().min(1) }),
  formattedAddress: z.string().optional(),
  addressComponents: z
    .array(
      z.object({
        longText: z.string().optional(),
        shortText: z.string().optional(),
        // Places can omit empty repeated fields, including address types.
        types: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  types: z.array(z.string()).default([]),
  businessStatus: z.string().optional(),
  photos: z
    .array(
      z.object({
        name: z.string(),
        authorAttributions: z.array(googleAuthorSchema).default([]),
      }),
    )
    .optional(),
  attributions: z
    .array(
      z.object({
        provider: z.string(),
        providerUri: z.string().url().optional(),
      }),
    )
    .optional(),
});
type RawPlace = z.infer<typeof rawPlaceSchema>;
let pausedUntil = 0;

function parseGoogleResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new HttpError(
      503,
      "Google Maps devolvió una respuesta incompleta. Intenta de nuevo.",
      30,
    );
  return parsed.data;
}

export async function googleRequest(
  path: string,
  mask: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim())
    throw new HttpError(
      503,
      "Google Maps está seleccionado, pero faltan sus claves. Completa la configuración del servidor y del mapa.",
    );
  if (Date.now() < pausedUntil)
    throw new HttpError(
      503,
      "Google Maps alcanzó un límite temporal. Espera un minuto antes de volver a consultar.",
      Math.ceil((pausedUntil - Date.now()) / 1000),
    );
  const url = path.startsWith("routes/")
    ? `https://routes.googleapis.com/${path === "routes/computeRouteMatrix" ? "distanceMatrix" : "directions"}/v2:${path.slice(7)}`
    : `https://places.googleapis.com/v1/${path}`;
  try {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        ...(mask ? { "X-Goog-FieldMask": mask } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) {
        pausedUntil = Date.now() + 60000;
        throw new HttpError(
          503,
          "Google Maps alcanzó la cuota configurada. Revisa el consumo o intenta después.",
          60,
        );
      }
      if (response.status === 401 || response.status === 403)
        throw new HttpError(
          503,
          "Google Maps rechazó la clave. Revisa las APIs habilitadas, sus restricciones y la facturación del proyecto.",
        );
      throw new HttpError(
        503,
        "Google Maps no pudo completar la consulta. Intenta de nuevo más tarde.",
        30,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("empty_response");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 2_000_000) {
          await reader.cancel();
          throw new Error("oversized_response");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      "No se pudo conectar con Google Maps. Intenta de nuevo más tarde.",
      30,
    );
  }
}

function locationOf(place: RawPlace): [number, number] | null {
  const point = coordinateSchema.safeParse([
    place.location.latitude,
    place.location.longitude,
  ]);
  const country = place.addressComponents.find((c) =>
    c.types.includes("country"),
  );
  const department = place.addressComponents.find((c) =>
    c.types.includes("administrative_area_level_1"),
  );
  return point.success &&
    country?.shortText === "CO" &&
    /^(departamento de )?narino$/.test(
      normalize(department?.longText ?? department?.shortText ?? ""),
    )
    ? point.data
    : null;
}

export function normalizeGooglePlace(
  raw: unknown,
  observedAt: string,
  spec?: SearchSpec,
): Place | null {
  const parsed = rawPlaceSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const coordinates = locationOf(p);
  if (!coordinates) return null;
  if (
    spec &&
    haversine(
      [...(spec.center ?? searchZones[spec.zone].center)],
      coordinates,
    ) > spec.radius
  )
    return null;
  // Prefer the specific classification over generic tourist_attraction/park tags.
  const order: Category[] = [
    "cafeterias",
    "restaurantes",
    "alojamientos",
    "museos",
    "monumentos",
    "parques",
    "cultura",
    "naturaleza",
    "turismo",
  ];
  let category = order.find((c) =>
    types[c]
      .filter((t) => c === "turismo" || t !== "tourist_attraction")
      .some((t) => p.types.includes(t)),
  );
  if (spec) {
    const requested = spec.categories.find((c) =>
      types[c].some((t) => p.types.includes(t)),
    );
    if (!requested) return null;
    category =
      (requested === "turismo" || requested === "cultura") && category
        ? category
        : requested;
    if (
      category === "cascadas" &&
      !/cascada|waterfall|salto/.test(normalize(p.displayName.text))
    )
      return null;
    if (
      category === "miradores" &&
      !p.types.includes("observation_deck") &&
      !/mirador|viewpoint/.test(normalize(p.displayName.text))
    )
      return null;
  }
  if (!category) return null;
  const restricted =
    (p.businessStatus !== undefined && p.businessStatus !== "OPERATIONAL") ||
    (["naturaleza", "cascadas", "turismo"].includes(category) &&
      /\b(volcan|galeras|azufral|cumbal|chiles|corota)\b/.test(
        normalize(p.displayName.text),
      ));
  const photo = p.photos?.find(
    (v) =>
      /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(v.name) &&
      v.name.length <= 2000 &&
      v.name.startsWith(`places/${p.id}/photos/`),
  );
  const place = placeSchema.safeParse({
    id: `google:${p.id}`,
    name: p.displayName.text.slice(0, 180),
    category: categoryLabels[category],
    categoryKey: category,
    coordinates,
    coordinateKind: "place",
    region: (p.formattedAddress ?? "Nariño, Colombia").slice(0, 140),
    zone: "google",
    description: `${categoryLabels[category]} encontrado en Google Maps. Consulta su ficha para ver información actualizada.`,
    visitMinutes:
      category === "cafeterias" ? 45 : category === "restaurantes" ? 60 : 75,
    costCOP: null,
    openingHours: null,
    availability: restricted ? "restringido" : "confirmar",
    roadAccess: !restricted && !["naturaleza", "cascadas"].includes(category),
    sources: [
      {
        label: "Google Maps · ficha del lugar",
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName.text.slice(0, 180))}&query_place_id=${encodeURIComponent(p.id)}`,
      },
    ],
    note: restricted
      ? "Lugar cerrado o con acceso sujeto a autorización. Confirma con el responsable antes de visitarlo."
      : "Información de Google Maps; confirma acceso y disponibilidad. La ubicación no garantiza una entrada. Las horas de visita son orientativas.",
    observedAt,
    cuisine: null,
    ...(photo
      ? {
          googlePhoto: {
            name: photo.name,
            authors: photo.authorAttributions.slice(0, 10),
          },
        }
      : {}),
    ...(p.attributions
      ? { googleAttributions: p.attributions.slice(0, 10) }
      : {}),
  });
  return place.success ? place.data : null;
}

export async function discoverGooglePlaces(
  spec: SearchSpec,
  pageToken?: string,
): Promise<SearchResponse> {
  if (spec.categories.length > 1 && !spec.name) {
    const results = await Promise.all(
      spec.categories.map((category) =>
        discoverGooglePlaces({ ...spec, categories: [category] }),
      ),
    );
    const center = [...(spec.center ?? searchZones[spec.zone].center)];
    const places = [
      ...new Map(
        results
          .flatMap((result) =>
            result.places
              .sort(
                (a, b) =>
                  haversine(center, a.coordinates) -
                  haversine(center, b.coordinates),
              )
              .slice(0, 8),
          )
          .map((place) => [place.id, place]),
      ).values(),
    ];
    return {
      ...results[0],
      places,
      total: places.length,
      spec,
      nextPageToken: null,
    };
  }
  rateLimit("google:search", 10, 60000);
  const [latitude, longitude] = spec.center ?? searchZones[spec.zone].center;
  const dy = spec.radius / 111000;
  const dx = dy / Math.cos((latitude * Math.PI) / 180);
  const data = parseGoogleResponse(
    z.object({
      places: z.array(z.unknown()).max(20).default([]),
      nextPageToken: z.string().max(4096).optional(),
    }),
    await googleRequest(
      "places:searchText",
      [...fields.map((f) => `places.${f}`), "nextPageToken"].join(","),
      {
        textQuery: `${spec.name || spec.categories.map((c) => categoryLabels[c]).join(" o ")}${spec.regionalFood ? " comida típica" : ""}${spec.center ? " en " : ` en ${searchZones[spec.zone].label}, `}Nariño, Colombia`,
        languageCode: "es",
        regionCode: "CO",
        pageSize: 20,
        ...(!spec.name ? { rankPreference: "DISTANCE" } : {}),
        ...(spec.name
          ? {
              locationBias: {
                circle: {
                  center: { latitude, longitude },
                  radius: spec.radius,
                },
              },
            }
          : {
              locationRestriction: {
                rectangle: {
                  low: { latitude: latitude - dy, longitude: longitude - dx },
                  high: {
                    latitude: latitude + dy,
                    longitude: longitude + dx,
                  },
                },
              },
            }),
        ...(pageToken ? { pageToken } : {}),
      },
    ),
  );
  const observedAt = new Date().toISOString();
  const places = [
    ...new Map(
      data.places
        .map((p) => normalizeGooglePlace(p, observedAt, spec))
        .filter((p): p is Place => !!p)
        .map((p) => [p.id, p]),
    ).values(),
  ];
  return {
    places,
    total: places.length,
    nextPageToken: data.nextPageToken ?? null,
    spec,
    source: "google" as const,
    provider: "Google Maps",
    observedAt,
    notice: spec.regionalFood
      ? "Confirma con cada lugar su oferta de comida regional."
      : null,
  };
}

export async function resolveGooglePlace(id: string) {
  if (!/^google:[A-Za-z0-9_-]{5,240}$/.test(id))
    throw new HttpError(400, "Identificador de Google Maps no válido.");
  rateLimit("google:details", 30, 60000);
  const data = await googleRequest(`places/${id.slice(7)}`, fields.join(","));
  const place = normalizeGooglePlace(data, new Date().toISOString());
  if (!place || place.id !== id)
    throw new HttpError(
      409,
      "Este lugar ya no está disponible en la zona. Vuelve a buscarlo.",
    );
  return place;
}

export async function resolveGoogleReference(
  spec: SearchSpec,
): Promise<SearchSpec> {
  if (!spec.near?.trim())
    return { ...spec, near: undefined, reference: undefined };
  rateLimit("google:search", 10, 60000);
  const data = parseGoogleResponse(
    z.object({ places: z.array(z.unknown()).max(5).default([]) }),
    await googleRequest(
      "places:searchText",
      ["id", "displayName", "location", "addressComponents"]
        .map((f) => `places.${f}`)
        .join(","),
      {
        textQuery: `${spec.near} ${searchZones[spec.zone].label}, Nariño, Colombia`,
        languageCode: "es",
        regionCode: "CO",
        pageSize: 5,
      },
    ),
  );
  // One incomplete candidate must not prevent using the other valid matches.
  const matches = data.places.flatMap((value) => {
    const place = rawPlaceSchema.safeParse(value);
    return place.success && locationOf(place.data) ? [place.data] : [];
  });
  if (!matches.length)
    throw new HttpError(
      422,
      "No pude ubicar esa referencia en Google Maps. Precisa el nombre y el municipio.",
    );
  if (matches.length > 1)
    throw new HttpError(
      422,
      `Hay varias referencias: ${matches
        .slice(0, 3)
        .map((p) => p.displayName.text)
        .join(", ")}. Precisa la sede o dirección.`,
    );
  const p = matches[0];
  return {
    ...spec,
    center: locationOf(p)!,
    reference: { id: `google:${p.id}`, name: p.displayName.text.slice(0, 180) },
  };
}

export async function googlePlacePhoto(place: Place) {
  if (!place.googlePhoto) return null;
  if (!place.googlePhoto.name.startsWith(`places/${place.id.slice(7)}/photos/`))
    throw new HttpError(400, "La foto no corresponde al lugar.");
  rateLimit("google:photos", 60, 60000);
  const data = parseGoogleResponse(
    z.object({ photoUri: z.string().url() }),
    await googleRequest(
      `${place.googlePhoto.name}/media?maxWidthPx=640&skipHttpRedirect=true`,
      "",
    ),
  );
  const url = new URL(data.photoUri);
  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "googleusercontent.com" ||
      url.hostname.endsWith(".googleusercontent.com")
    )
  )
    throw new HttpError(503, "Google Maps no devolvió una foto válida.");
  return {
    provider: "google" as const,
    url: url.href,
    page: place.sources[0].url,
    authors: place.googlePhoto.authors,
  };
}
