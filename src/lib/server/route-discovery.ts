import "server-only";
import { z } from "zod";
import { searchZones, type Place, type SearchSpec } from "@/lib/places";
import { discoverPlaces } from "./discovery";
import { googleRequest } from "./google-maps";
import { signPlace } from "./place-verification";
import { HttpError, rateLimit } from "./guard";

const elementSchema = z.object({
  originIndex: z.number().int().min(0).default(0),
  destinationIndex: z.number().int().min(0).default(0),
  status: z.object({ code: z.number().default(0) }).optional(),
  condition: z.string(),
  distanceMeters: z.number().nonnegative().optional(),
  duration: z
    .string()
    .regex(/^\d+(?:\.\d+)?s$/)
    .optional(),
});
type Origin =
  | { placeId: string }
  | { location: { latLng: { latitude: number; longitude: number } } };
type Measurement = { distanceMeters: number; durationSeconds: number };

export async function measureStreetRoutes(
  origins: Origin[],
  destinations: Place[],
  mode: SearchSpec["travelMode"],
) {
  if (!origins.length || !destinations.length)
    return new Map<string, Measurement>();
  // Bounded matrices, no traffic SKU, polling or persistent provider cache.
  if (
    origins.length * destinations.length > 48 ||
    origins.length + destinations.length > 50
  )
    throw new HttpError(400, "Demasiados lugares para comparar distancias.");
  rateLimit("google:matrix", 16, 60000);
  const response = z
    .array(elementSchema)
    .max(48)
    .safeParse(
      await googleRequest(
        "routes/computeRouteMatrix",
        "originIndex,destinationIndex,status,condition,distanceMeters,duration",
        {
          origins: origins.map((waypoint) => ({ waypoint })),
          destinations: destinations.map((place) => ({
            waypoint: { placeId: place.id.slice(7) },
          })),
          travelMode: mode === "walking" ? "WALK" : "DRIVE",
          ...(mode === "driving"
            ? { routingPreference: "TRAFFIC_UNAWARE" }
            : {}),
        },
      ),
    );
  if (!response.success)
    throw new HttpError(
      503,
      "No se pudieron comprobar las distancias por calles. Vuelve a intentar.",
    );
  const measurements = new Map<string, Measurement>();
  for (const value of response.data) {
    if (
      value.originIndex >= origins.length ||
      value.destinationIndex >= destinations.length
    )
      continue;
    if (
      value.condition !== "ROUTE_EXISTS" ||
      value.status?.code ||
      value.distanceMeters === undefined ||
      !value.duration
    )
      continue;
    measurements.set(`${value.originIndex}:${value.destinationIndex}`, {
      distanceMeters: value.distanceMeters,
      durationSeconds: Number(value.duration.slice(0, -1)),
    });
  }
  return measurements;
}

export async function discoverReachablePlaces(
  spec: SearchSpec,
  pageToken?: string,
) {
  const found = await discoverPlaces(spec, pageToken);
  const active = found.spec;
  const center = active.center ?? [...searchZones[active.zone].center];
  const originName =
    active.reference?.name ??
    (active.center
      ? "tu punto de búsqueda"
      : `el centro de ${searchZones[active.zone].label}`);
  const candidates = found.places.filter(
    (place) =>
      place.availability !== "restringido" &&
      (active.travelMode !== "driving" || place.roadAccess),
  );
  const distances = await measureStreetRoutes(
    [{ location: { latLng: { latitude: center[0], longitude: center[1] } } }],
    candidates,
    active.travelMode,
  );
  let places = candidates
    .flatMap((place, index) => {
      const travel = distances.get(`0:${index}`);
      return travel && travel.distanceMeters <= active.radius
        ? [
            {
              ...place,
              travel: { ...travel, mode: active.travelMode, originName },
            },
          ]
        : [];
    })
    .sort((a, b) => a.travel.distanceMeters - b.travel.distanceMeters);

  // For a combined request, require an actual street connection between the
  // categories. Separate city-wide results are never presented as a nearby pair.
  if (active.categories.length > 1 && !active.name && places.length) {
    const anchors = places
      .filter((place) => place.categoryKey === active.categories[0])
      .slice(0, 3);
    const others = active.categories
      .slice(1)
      .flatMap((category) =>
        places.filter((place) => place.categoryKey === category).slice(0, 4),
      );
    const links = await measureStreetRoutes(
      anchors.map((place) => ({ placeId: place.id.slice(7) })),
      others,
      active.travelMode,
    );
    const maxBetween = Math.min(active.radius, 1000);
    const groups = anchors
      .flatMap((anchor, index) => {
        const nearby = others.flatMap((place, destination) => {
          const travel = links.get(`${index}:${destination}`);
          return travel && travel.distanceMeters <= maxBetween
            ? [
                {
                  ...place,
                  travel: {
                    ...travel,
                    mode: active.travelMode,
                    originName: anchor.name,
                  },
                },
              ]
            : [];
        });
        if (
          !active.categories
            .slice(1)
            .every((category) =>
              nearby.some((place) => place.categoryKey === category),
            )
        )
          return [];
        const score = active.categories
          .slice(1)
          .reduce(
            (sum, category) =>
              sum +
              Math.min(
                ...nearby
                  .filter((place) => place.categoryKey === category)
                  .map((place) => place.travel.distanceMeters),
              ),
            0,
          );
        return [{ places: [anchor, ...nearby], score }];
      })
      .sort((a, b) => a.score - b.score);
    places = groups[0]?.places ?? [];
  }
  return {
    ...found,
    total: places.length,
    places: places.map(signPlace),
    notice:
      !places.length && active.categories.length > 1
        ? "No encontré una combinación de esas categorías con rutas cercanas dentro de la distancia indicada. Amplía la distancia o cambia el punto de búsqueda."
        : found.notice,
  };
}
