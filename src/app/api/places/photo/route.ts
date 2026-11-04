import { isGooglePlace, placeSchema } from "@/lib/places";
import { googlePlacePhoto } from "@/lib/server/google-maps";
import { usesGoogleMaps } from "@/lib/maps-config";
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
    const place = placeSchema.parse(await readJson(request, 40000));
    if (!isVerifiedPlace(place))
      throw new HttpError(
        409,
        "Vuelve a buscar el lugar para consultar su foto.",
      );
    if (isGooglePlace(place) && !usesGoogleMaps())
      throw new HttpError(409, "Activa Google Maps para consultar esta foto.");
    return Response.json(
      {
        photo: isGooglePlace(place)
          ? await googlePlacePhoto(place)
          : await placePhoto(place),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
