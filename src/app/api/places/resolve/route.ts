import { z } from "zod";
import { placeIdSchema } from "@/lib/places";
import { resolvePlaces } from "@/lib/server/discovery";
import {
  errorResponse,
  guardRequest,
  HttpError,
  readJson,
} from "@/lib/server/guard";

export const maxDuration = 75;
const schema = z.object({ ids: z.array(placeIdSchema).min(1).max(25) });
export async function POST(request: Request) {
  try {
    guardRequest(request, "resolve");
    const parsed = schema.safeParse(await readJson(request, 10000));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Envía de 1 a 25 identificadores de lugares válidos.",
      );
    const { ids } = parsed.data;
    return Response.json(
      { places: await resolvePlaces(ids) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
