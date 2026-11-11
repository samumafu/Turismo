import "server-only";
import { z } from "zod";
import { type Place } from "@/lib/places";
import { googleRequest } from "./google-maps";
import { HttpError, rateLimit } from "./guard";

export function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0,
    latitude = 0,
    longitude = 0;
  function delta() {
    let result = 0,
      shift = 0,
      byte: number;
    do {
      if (index >= encoded.length || shift > 30)
        throw new Error("Invalid polyline");
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error("Invalid polyline");
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
  while (index < encoded.length) {
    latitude += delta();
    longitude += delta();
    if (
      Math.abs(latitude / 1e5) > 90 ||
      Math.abs(longitude / 1e5) > 180 ||
      coordinates.length >= 30000
    )
      throw new Error("Invalid route coordinates");
    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }
  if (coordinates.length < 2) throw new Error("Empty route");
  return coordinates;
}

const schema = z.object({
  routes: z
    .array(
      z.object({
        distanceMeters: z.number().nonnegative(),
        duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
        polyline: z.object({ encodedPolyline: z.string().max(200000) }),
        legs: z
          .array(
            z.object({
              steps: z
                .array(
                  z.object({
                    navigationInstruction: z
                      .object({ instructions: z.string().max(600) })
                      .optional(),
                    distanceMeters: z.number().nonnegative().default(0),
                  }),
                )
                .max(500)
                .default([]),
            }),
          )
          .max(6)
          .default([]),
      }),
    )
    .min(1)
    .max(3),
});

export async function googleRoute(
  stops: Place[],
  mode: "driving" | "walking",
  origin?: [number, number],
  signal?: AbortSignal,
) {
  rateLimit("google:routes", 15, 60000);
  const waypoint = (p: Place) => ({ placeId: p.id.slice(7) });
  const points = [
    ...(origin
      ? [
          {
            location: { latLng: { latitude: origin[0], longitude: origin[1] } },
          },
        ]
      : []),
    ...stops.map(waypoint),
  ];
  if (points.length < 2)
    throw new HttpError(400, "La ruta necesita un origen y un destino.");
  const result = schema.safeParse(
    await googleRequest(
      "routes/computeRoutes",
      "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.distanceMeters",
      {
        origin: points[0],
        destination: points.at(-1),
        intermediates: points.slice(1, -1),
        travelMode: mode === "walking" ? "WALK" : "DRIVE",
        ...(mode === "driving" ? { routingPreference: "TRAFFIC_UNAWARE" } : {}),
        computeAlternativeRoutes: false,
        optimizeWaypointOrder: false,
        polylineQuality: "OVERVIEW",
        languageCode: "es",
        units: "METRIC",
      },
      signal,
    ),
  );
  if (!result.success)
    throw new HttpError(
      503,
      "Google Maps no encontró una ruta disponible. Prueba el enlace externo.",
    );
  const route = result.data.routes[0];
  let coordinates: [number, number][];
  try {
    coordinates = decodePolyline(route.polyline.encodedPolyline);
  } catch {
    throw new HttpError(503, "Google Maps no devolvió una ruta válida.");
  }
  return {
    geometry: { type: "LineString" as const, coordinates },
    distanceMeters: route.distanceMeters,
    durationSeconds: Number(route.duration.slice(0, -1)),
    steps: route.legs
      .flatMap((leg) =>
        leg.steps.flatMap((step) =>
          step.navigationInstruction?.instructions
            ? [
                {
                  instruction: step.navigationInstruction.instructions,
                  distanceMeters: step.distanceMeters,
                },
              ]
            : [],
        ),
      )
      .slice(0, 200),
    provider: "Google Maps",
    profile: mode,
  };
}
