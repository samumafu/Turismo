import { interpretSearch, searchRequestSchema, normalize } from "@/lib/places";
import { discoverReachablePlaces } from "@/lib/server/route-discovery";
import {
  errorResponse,
  guardRequest,
  HttpError,
  readJson,
} from "@/lib/server/guard";
export const maxDuration = 75;
export async function POST(request: Request) {
  try {
    guardRequest(request, "discovery");
    const parsed = searchRequestSchema.safeParse(
      await readJson(request, 10000),
    );
    if (!parsed.success)
      throw new HttpError(
        400,
        "Revisa la zona, categoría y distancia (entre 100 m y 25 km).",
      );
    const { text, spec, pageToken } = parsed.data;
    const filters = text ? interpretSearch(text, spec) : spec;
    // The numeric field is authoritative unless the text supplies a distance.
    if (
      text &&
      !/\d+(?:[.,]\d+)?\s*(?:km|kilometros?|metros?|m)\b/i.test(normalize(text))
    )
      filters.radius = spec.radius;
    return Response.json(await discoverReachablePlaces(filters, pageToken), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
