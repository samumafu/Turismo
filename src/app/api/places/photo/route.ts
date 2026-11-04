import { placeSchema } from "@/lib/places";
import { googlePlacePhoto } from "@/lib/server/google-maps";
import { isVerifiedPlace } from "@/lib/server/place-verification";
import {
  errorResponse,
  guardRequest,
  HttpError,
  readJson,
} from "@/lib/server/guard";
export const maxDuration = 25;
export async function POST(request: Request) {
  try {
    guardRequest(request, "photo");
    const parsed = placeSchema.safeParse(await readJson(request, 40000));
    if (!parsed.success)
      throw new HttpError(400, "Los datos del lugar no son válidos.");
    if (!isVerifiedPlace(parsed.data))
      throw new HttpError(
        409,
        "Vuelve a buscar el lugar para consultar su foto.",
      );
    return Response.json(
      { photo: await googlePlacePhoto(parsed.data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
