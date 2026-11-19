import { waitForRoutingSlot } from "@/lib/server/osrm";
import { z } from "zod";
import { resolvePlaces } from "@/lib/server/discovery";
import { osmIdSchema, placeSchema } from "@/lib/places";
import {
  guardRequest,
  readJson,
  errorResponse,
  HttpError,
} from "@/lib/server/guard";

// A cold instance may need to resolve the OSM IDs before requesting OSRM.
export const maxDuration = 50;
const schema = z
  .object({
    placeIds: z.array(osmIdSchema).min(1).max(5),
    knownPlaces: z.array(placeSchema).max(5).optional(),
    origin: z
      .tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])
      .optional(),
    mode: z.enum(["driving", "walking"]).default("driving"),
  })
  .refine((v) => !!v.origin || v.placeIds.length >= 2);
const routeSchema = z.object({
  code: z.literal("Ok"),
  waypoints: z.array(z.object({ distance: z.number().min(0).max(500) })),
  routes: z
    .array(
      z.object({
        distance: z.number().nonnegative(),
        duration: z.number().nonnegative(),
        legs: z
          .array(
            z.object({
              steps: z.array(
                z.object({
                  name: z.string(),
                  distance: z.number().nonnegative(),
                  maneuver: z.object({
                    type: z.string(),
                    modifier: z.string().optional(),
                  }),
                }),
              ),
            }),
          )
          .optional(),
        geometry: z.object({
          type: z.literal("LineString"),
          coordinates: z
            .array(z.tuple([z.number(), z.number()]))
            .min(2)
            .max(30000),
        }),
      }),
    )
    .min(1),
});
const cache = new Map<string, { expires: number; data: unknown }>();

export async function POST(request: Request) {
  try {
    guardRequest(request, "route");
    const parsed = schema.safeParse(await readJson(request, 24000));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Envía una ubicación válida y de 1 a 5 destinos OSM; sin ubicación se necesitan al menos 2 destinos.",
      );
    const { origin, mode } = parsed.data;
    const stops = await resolvePlaces(
      parsed.data.placeIds,
      parsed.data.knownPlaces,
    );
    if (
      stops.some(
        (place) =>
          (mode === "driving" && !place.roadAccess) ||
          place.availability === "restringido",
      )
    )
      throw new HttpError(
        422,
        "Estos destinos no tienen un acceso válido para esta ruta. Puedes probar a pie o consultar el mapa externo y confirmar el acceso.",
      );
    const key = mode + ":" + parsed.data.placeIds.join("|");
    // Never retain GPS coordinates or routes derived from the user's position.
    const hit = origin ? undefined : cache.get(key);
    if (hit && hit.expires > Date.now()) return Response.json(hit.data);
    // Public demo policy: <=1 request/s, no retries, cache only route geometries.
    await waitForRoutingSlot();
    const points = [
      ...(origin ? [origin] : []),
      ...stops.map((p) => p.coordinates),
    ];
    const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const response = await fetch(
      `https://routing.openstreetmap.de/routed-${mode === "walking" ? "foot" : "car"}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&radiuses=${points.map((_, i) => (origin && i === 0 ? "500" : "100")).join(";")}`,
      {
        headers: {
          "User-Agent": `TurismoInteligentePasto/2.0 (+${process.env.APP_PUBLIC_URL || new URL(request.url).origin}/fuentes; academic prototype)`,
          Referer: new URL(request.url).origin,
        },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new HttpError(
        503,
        "El servicio de rutas no está disponible. Abre el recorrido en el mapa externo.",
      );
    const result = routeSchema.safeParse(await response.json());
    if (
      !result.success ||
      result.data.waypoints.length !== points.length ||
      result.data.waypoints.some(
        (w, i) => w.distance > (origin && i === 0 ? 500 : 100),
      )
    )
      throw new HttpError(
        503,
        "No hay una ruta vial confiable entre estos puntos. Consulta el mapa externo.",
      );
    const route = result.data.routes[0];
    const data = {
      geometry: route.geometry,
      steps: (route.legs ?? [])
        .flatMap((leg) =>
          leg.steps.map((step) => {
            const direction: Record<string, string> = {
              left: "a la izquierda",
              right: "a la derecha",
              "slight left": "ligeramente a la izquierda",
              "slight right": "ligeramente a la derecha",
              "sharp left": "fuertemente a la izquierda",
              "sharp right": "fuertemente a la derecha",
              uturn: "en U",
            };
            const modifier = direction[step.maneuver.modifier ?? ""];
            let instruction = modifier ? "Gira " + modifier : "Continúa";
            if (step.maneuver.type === "arrive")
              instruction = "Llegada al destino";
            if (step.maneuver.type === "depart")
              instruction = "Inicia el tramo";
            if (step.maneuver.type.includes("roundabout"))
              instruction = "Sigue la rotonda";
            return {
              instruction: instruction + (step.name ? " · " + step.name : ""),
              distanceMeters: step.distance,
            };
          }),
        )
        .slice(0, 200),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      provider: "FOSSGIS / OSRM",
      profile: mode,
    };
    if (!origin) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { data, expires: Date.now() + 3600000 });
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(
      error instanceof HttpError
        ? error
        : new HttpError(
            503,
            "El servicio de rutas no respondió. Puedes abrir el recorrido en el mapa externo.",
          ),
    );
  }
}
