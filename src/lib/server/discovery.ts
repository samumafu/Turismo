import "server-only";
import {
  placeIdSchema,
  searchSpecSchema,
  type Place,
  type SearchResponse,
  type SearchSpec,
} from "@/lib/places";
import {
  discoverGooglePlaces,
  resolveGooglePlace,
  resolveGoogleReference,
} from "./google-maps";
import { HttpError } from "./guard";
import { isVerifiedPlace, signPlace } from "./place-verification";

export async function discoverPlaces(
  raw: SearchSpec,
  pageToken?: string,
): Promise<SearchResponse> {
  const parsed = searchSpecSchema.parse(raw);
  // Continuation pages must preserve exactly the original query parameters.
  const spec =
    pageToken && parsed.reference
      ? parsed
      : await resolveGoogleReference(parsed);
  const result = await discoverGooglePlaces(spec, pageToken);
  return { ...result, places: result.places.map(signPlace) };
}
export async function resolvePlaces(
  ids: string[],
  snapshots: Place[] = [],
): Promise<Place[]> {
  const unique = [...new Set(ids)];
  if (
    unique.length > 25 ||
    unique.some((id) => !placeIdSchema.safeParse(id).success)
  )
    throw new HttpError(400, "Identificadores de lugares no válidos.");
  const places = new Map<string, Place>();
  for (let start = 0; start < unique.length; start += 5) {
    await Promise.all(
      unique.slice(start, start + 5).map(async (id) => {
        const known = snapshots.find((p) => p.id === id && isVerifiedPlace(p));
        places.set(id, known ?? signPlace(await resolveGooglePlace(id)));
      }),
    );
  }
  return unique.map((id) => places.get(id)!);
}
