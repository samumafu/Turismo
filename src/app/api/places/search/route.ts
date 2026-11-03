import { interpretSearch, searchRequestSchema } from "@/lib/places";
import { discoverPlaces } from "@/lib/server/discovery";
import {
  errorResponse,
  guardRequest,
  HttpError,
  readJson,
} from "@/lib/server/guard";
export const maxDuration = 20;
export async function POST(request: Request) {
  try {
    guardRequest(request, "discovery");
    const parsed = searchRequestSchema.safeParse(await readJson(request, 3000));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Revisa la zona, categoría y radio (entre 500 m y 25 km).",
      );
    const { text, spec, offset } = parsed.data;
    return Response.json(
      await discoverPlaces(text ? interpretSearch(text, spec) : spec, offset),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
