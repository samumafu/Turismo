import { z } from "zod";
import { type Place } from "./places";

const photoSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (url) =>
        new URL(url).protocol === "https:" &&
        ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(
          new URL(url).hostname,
        ),
    ),
  page: z.string().url().startsWith("https://commons.wikimedia.org/"),
  author: z.string(),
  license: z.string(),
  licenseUrl: z.string().url(),
});
export type PlacePhotoData = z.infer<typeof photoSchema>;
// Deduplicate only photos already on screen during this page visit.
// No disk cache, catalog prefetching or automatic retry loops.
const visiblePhotos = new Map<
  string,
  { promise: Promise<PlacePhotoData | null>; expires: number }
>();
let running = 0;
const waiting: (() => void)[] = [];
async function requestPhoto(place: Place) {
  if (running >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    const response = await fetch("/api/places/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(place),
      signal: AbortSignal.timeout(22000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error("No se pudo cargar la imagen.");
    return z.object({ photo: photoSchema.nullable() }).parse(body).photo;
  } finally {
    running--;
    waiting.shift()?.();
  }
}
export function loadPlacePhoto(place: Place) {
  if (
    !place.commons &&
    !place.wikidata &&
    place.name.endsWith("sin nombre en OSM")
  )
    return Promise.resolve(null);
  const key = `${place.id}:${place.observedAt}`;
  const known = visiblePhotos.get(key);
  if (known && known.expires > Date.now()) return known.promise;
  if (visiblePhotos.size >= 60)
    visiblePhotos.delete(visiblePhotos.keys().next().value!);
  const promise = requestPhoto(place).catch((error: unknown) => {
    visiblePhotos.delete(key);
    throw error;
  });
  visiblePhotos.set(key, { promise, expires: Date.now() + 5 * 60000 });
  return promise;
}
