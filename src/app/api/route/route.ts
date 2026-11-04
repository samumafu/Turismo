import { z } from "zod";
import { placeIdSchema, placeSchema } from "@/lib/places";
import { resolvePlaces } from "@/lib/server/discovery";
import { googleRoute } from "@/lib/server/google-routes";
import {
  errorResponse,
  guardRequest,
  HttpError,
  readJson,
} from "@/lib/server/guard";
export const maxDuration = 50;
const schema = z
  .object({
    placeIds: z.array(placeIdSchema).min(1).max(5),
    knownPlaces: z.array(placeSchema).max(5).optional(),
    origin: z
      .tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])
      .optional(),
    mode: z.enum(["driving", "walking"]).default("driving"),
  })
  .refine((v) => !!v.origin || v.placeIds.length >= 2);
export async function POST(request: Request) {
  try {
    guardRequest(request, "route");
    const parsed = schema.safeParse(await readJson(request, 100000));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Envía un origen y de 1 a 5 destinos; sin origen se necesitan al menos dos destinos.",
      );
    const { origin, mode, placeIds, knownPlaces } = parsed.data;
    const stops = await resolvePlaces(placeIds, knownPlaces);
    if (
      stops.some(
        (p) =>
          p.availability === "restringido" ||
          (mode === "driving" && !p.roadAccess),
      )
    )
      throw new HttpError(
        422,
        "Confirma el acceso de estos destinos o prueba una ruta a pie.",
      );
    return Response.json(
      await googleRoute(stops, mode, origin, request.signal),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
