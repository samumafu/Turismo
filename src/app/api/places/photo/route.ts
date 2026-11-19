import { placeSchema } from "@/lib/places";
import { isVerifiedPlace } from "@/lib/server/place-verification";
import { placePhoto } from "@/lib/server/place-photo";
import {
  guardRequest,
  readJson,
  errorResponse,
  HttpError,
} from "@/lib/server/guard";
export const maxDuration = 25;
export async function POST(request: Request) {
  try {
    guardRequest(request, "photo");
    const place = placeSchema.parse(await readJson(request, 6000));
    if (!isVerifiedPlace(place))
      throw new HttpError(
        409,
        "Vuelve a buscar el lugar para consultar su foto.",
      );
    return Response.json(
      { photo: await placePhoto(place) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
