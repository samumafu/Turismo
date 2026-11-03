import "server-only";
import { z } from "zod";
import { haversine, normalize, type Place } from "@/lib/places";
import { rateLimit } from "./guard";

export type PlacePhoto = {
  url: string;
  page: string;
  author: string;
  license: string;
  licenseUrl: string;
};
const cache = new Map<string, { photo: PlacePhoto | null; expires: number }>();
const pending = new Map<string, Promise<PlacePhoto | null>>();
const entitySchema = z.object({
  labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
  claims: z
    .record(
      z.string(),
      z.array(
        z.object({
          mainsnak: z.object({
            datavalue: z.object({ value: z.unknown() }).optional(),
          }),
        }),
      ),
    )
    .optional(),
});
async function json(url: URL) {
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `TurismoInteligentePasto/2.0 (${process.env.APP_PUBLIC_URL || "https://turismo-seven-mu.vercel.app"}/fuentes)`,
    },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("Photo provider unavailable");
  const body = await r.text();
  if (body.length > 1500000) throw new Error("Photo metadata too large");
  return JSON.parse(body) as unknown;
}
function api(host: string, params: Record<string, string>) {
  const u = new URL(`https://${host}/w/api.php`);
  u.search = new URLSearchParams({ format: "json", ...params }).toString();
  return u;
}
async function imageFile(place: Place) {
  if (place.commons?.startsWith("File:")) return place.commons;
  let ids = place.wikidata ? [place.wikidata] : [];
  if (!ids.length) {
    const found = z
      .object({
        search: z.array(z.object({ id: z.string().regex(/^Q\d+$/) })).max(5),
      })
      .parse(
        await json(
          api("www.wikidata.org", {
            action: "wbsearchentities",
            search: place.name,
            language: "es",
            limit: "5",
            type: "item",
          }),
        ),
      );
    ids = found.search.map((s) => s.id);
  }
  if (!ids.length) return null;
  const data = z.object({ entities: z.record(z.string(), entitySchema) }).parse(
    await json(
      api("www.wikidata.org", {
        action: "wbgetentities",
        ids: ids.join("|"),
        props: "claims|labels",
        languages: "es|en",
      }),
    ),
  );
  const matches: string[] = [];
  for (const [id, entity] of Object.entries(data.entities)) {
    if (!place.wikidata) {
      const point = z
        .object({ latitude: z.number(), longitude: z.number() })
        .safeParse(entity.claims?.P625?.[0]?.mainsnak.datavalue?.value);
      const nameMatch = Object.values(entity.labels ?? {}).some(
        (l) => normalize(l.value) === normalize(place.name),
      );
      if (
        !nameMatch ||
        !point.success ||
        haversine(place.coordinates, [
          point.data.latitude,
          point.data.longitude,
        ]) > 200
      )
        continue;
    } else if (id !== place.wikidata) continue;
    const file = entity.claims?.P18?.[0]?.mainsnak.datavalue?.value;
    if (typeof file === "string") matches.push("File:" + file);
  }
  return matches.length === 1 ? matches[0] : null;
}
const plain = (text: string) =>
  text
    .replace(/<[^>]*>/g, "")
    .replace(/&[^;]+;/g, " ")
    .trim()
    .slice(0, 250);
async function lookup(place: Place): Promise<PlacePhoto | null> {
  rateLimit("photos:minute", 20, 60000);
  const file = await imageFile(place);
  if (!file) return null;
  const data = z
    .object({
      query: z.object({
        pages: z.record(
          z.string(),
          z.object({
            imageinfo: z
              .array(
                z.object({
                  thumburl: z.string().url(),
                  descriptionurl: z.string().url(),
                  extmetadata: z.object({
                    Artist: z.object({ value: z.string() }).optional(),
                    Credit: z.object({ value: z.string() }).optional(),
                    LicenseShortName: z
                      .object({ value: z.string() })
                      .optional(),
                    LicenseUrl: z.object({ value: z.string() }).optional(),
                  }),
                }),
              )
              .optional(),
          }),
        ),
      }),
    })
    .parse(
      await json(
        api("commons.wikimedia.org", {
          action: "query",
          titles: file,
          prop: "imageinfo",
          iiprop: "url|extmetadata",
          iiurlwidth: "640",
        }),
      ),
    );
  const info = Object.values(data.query.pages)[0]?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata;
  const license = meta.LicenseShortName?.value ?? "";
  // Never substitute a random nearby photo or display an image without reusable licensing.
  if (
    !/^(CC BY(?:-SA)?(?: \d\.\d)?|CC0(?: \d\.\d)?|Public domain)$/i.test(
      license,
    )
  )
    return null;
  const licenseUrl =
    meta.LicenseUrl?.value ||
    (license === "Public domain"
      ? "https://commons.wikimedia.org/wiki/Commons:Public_domain"
      : "");
  if (
    !licenseUrl.startsWith("https://creativecommons.org/") &&
    licenseUrl !== "https://commons.wikimedia.org/wiki/Commons:Public_domain"
  )
    return null;
  if (
    !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(
      new URL(info.thumburl).hostname,
    ) ||
    new URL(info.descriptionurl).hostname !== "commons.wikimedia.org"
  )
    return null;
  return {
    url: info.thumburl,
    page: info.descriptionurl,
    author: plain(
      meta.Artist?.value || meta.Credit?.value || "Autor en Wikimedia Commons",
    ),
    license,
    licenseUrl,
  };
}
export async function placePhoto(place: Place) {
  const hit = cache.get(place.id);
  if (hit && hit.expires > Date.now()) return hit.photo;
  let request = pending.get(place.id);
  if (!request) {
    request = lookup(place);
    pending.set(place.id, request);
  }
  try {
    const photo = await request;
    if (cache.size >= 300) cache.delete(cache.keys().next().value!);
    cache.set(place.id, { photo, expires: Date.now() + 24 * 3600000 });
    return photo;
  } finally {
    pending.delete(place.id);
  }
}
