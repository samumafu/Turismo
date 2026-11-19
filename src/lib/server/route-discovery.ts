import { waitForRoutingSlot } from "@/lib/server/osrm";
import "server-only";
import { z } from "zod";
import { searchZones, type Place, type SearchSpec } from "@/lib/places";
import { discoverPlaces } from "./discovery";

import { signPlace } from "./place-verification";
import { HttpError } from "./guard";

type Coord = [number, number];
type Measurement = { distanceMeters: number; durationSeconds: number };
export async function measureStreetRoutes(
  origins: Coord[],
  destinations: Place[],
  mode: SearchSpec["travelMode"],
) {
  const result = new Map<string, Measurement>();
  if (!origins.length || !destinations.length) return result;
  const coords = [...origins, ...destinations.map((p) => p.coordinates)]
    .map(([lat, lon]) => lon + "," + lat)
    .join(";");
  const params = new URLSearchParams({
    sources: origins.map((_, i) => i).join(";"),
    destinations: destinations.map((_, i) => i + origins.length).join(";"),
    annotations: "distance,duration",
  });
  const url = `https://routing.openstreetmap.de/routed-${mode === "walking" ? "foot" : "car"}/table/v1/driving/${coords}?${params}`;
  await waitForRoutingSlot();
  let body: unknown;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "TurismoInteligentePasto/2.0" },
      signal: AbortSignal.timeout(15000),
    });
    body = response.ok ? await response.json() : null;
  } catch {
    throw new HttpError(
      503,
      "No se pudo conectar con el servicio de rutas por calles.",
    );
  }
  const matrix = z
    .object({
      code: z.literal("Ok"),
      distances: z.array(z.array(z.number().nonnegative().nullable())),
      durations: z.array(z.array(z.number().nonnegative().nullable())),
    })
    .safeParse(body);
  if (!matrix.success)
    throw new HttpError(
      503,
      "No se pudieron comprobar las distancias por calles.",
    );
  origins.forEach((_, i) =>
    destinations.forEach((_, j) => {
      const d = matrix.data.distances[i]?.[j],
        t = matrix.data.durations[i]?.[j];
      if (d != null && t != null)
        result.set(i + ":" + j, { distanceMeters: d, durationSeconds: t });
    }),
  );
  return result;
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
    [[center[0], center[1]]],
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
      anchors.map((place) => place.coordinates),
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
