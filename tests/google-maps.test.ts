// Synthetic provider responses only: this suite never calls or bills Google.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { discoverPlaces, resolvePlaces } from "../src/lib/server/discovery";
import {
  normalizeGooglePlace,
  resolveGoogleReference,
} from "../src/lib/server/google-maps";
import { decodePolyline } from "../src/lib/server/google-routes";
import {
  signPlace,
  isVerifiedPlace,
} from "../src/lib/server/place-verification";
import {
  searchSpecSchema,
  searchResponseSchema,
  type Place,
} from "../src/lib/places";
import { chatResponseSchema, emptyProfile } from "../src/lib/schemas";
import { storedJourney } from "../src/lib/journey-storage";
import { acceptedJourney } from "../src/lib/accepted-journey";
import { fixturePlaces, routeMatrixFixture } from "./fixtures";
import { POST as photo } from "../src/app/api/places/photo/route";
import { POST as route } from "../src/app/api/route/route";
import { POST as chat } from "../src/app/api/chat/route";
import { POST as resolve } from "../src/app/api/places/resolve/route";

test("saved-journey restoration rejects malformed IDs before contacting a provider", async () => {
  const result = await resolve(
    new Request("http://localhost:3000/api/places/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["../invalid"] }),
    }),
  );
  assert.equal(result.status, 400);
});

const raw = {
  id: "ChIJSyntheticCafe1",
  displayName: { text: "Cafe sintetico Google" },
  location: { latitude: 1.2146, longitude: -77.2783 },
  types: ["cafe", "food", "point_of_interest"],
  formattedAddress: "Direccion sintetica, Pasto, Colombia",
  businessStatus: "OPERATIONAL",
  addressComponents: [
    { longText: "Colombia", shortText: "CO", types: ["country"] },
    {
      longText: "Nariño",
      shortText: "Nariño",
      types: ["administrative_area_level_1"],
    },
  ],
  photos: [
    {
      name: "places/ChIJSyntheticCafe1/photos/SyntheticPhoto1",
      authorAttributions: [
        {
          displayName: "Autor sintetico",
          uri: "https://maps.google.com/maps/contrib/123",
        },
      ],
    },
  ],
  attributions: [
    {
      provider: "Proveedor sintetico",
      providerUri: "https://example.org/credit",
    },
  ],
};
const request = (path: string, body: unknown) =>
  new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("Google Maps integrates search, accepted itineraries, photos, routes and ID-only storage", async (t) => {
  const names = [
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_SERVER_API_KEY",
  ] as const;
  const previous = names.map((name) => process.env[name]);
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-test-key";
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  const calls: { url: string; init?: RequestInit }[] = [];
  let mode = "success";
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      assert.match(url, /^https:\/\/(places|routes)\.googleapis\.com\//);
      assert.equal(
        new Headers(init?.headers).get("X-Goog-Api-Key"),
        "server-test-key",
      );
      assert.equal(init?.cache, "no-store");
      if (mode === "pagination" && url.includes(":searchText")) {
        const token = JSON.parse(String(init?.body)).pageToken;
        return Response.json(
          token
            ? {
                places: [
                  { ...raw, id: "ChIJSyntheticCafe2", photos: undefined },
                ],
              }
            : { places: [raw], nextPageToken: "page-two-token" },
        );
      }
      if (mode === "denied") return Response.json({}, { status: 403 });
      if (mode === "quota") return Response.json({}, { status: 429 });
      if (url.includes("computeRouteMatrix"))
        return Response.json(routeMatrixFixture(init));
      if (url.includes("/media?"))
        return Response.json({
          photoUri: "https://lh3.googleusercontent.com/synthetic-photo",
        });
      if (url.includes("directions/v2:computeRoutes"))
        return Response.json({
          routes: [
            {
              distanceMeters: 1234,
              duration: "120.5s",
              polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
            },
          ],
        });
      if (url.includes(":search"))
        return Response.json({
          places:
            mode === "ambiguous"
              ? [raw, { ...raw, id: "ChIJSyntheticCafe2" }]
              : [raw],
        });
      return Response.json(raw);
    },
  );
  let place: Place;
  const spec = searchSpecSchema.parse({
    categories: ["cafeterias"],
    radius: 3000,
  });
  try {
    await t.test(
      "rejects the wrong country, department, radius, category and invalid IDs",
      () => {
        const observed = new Date().toISOString();
        assert.equal(
          normalizeGooglePlace({ ...raw, id: "../bad" }, observed, spec),
          null,
        );
        assert.equal(
          normalizeGooglePlace(
            {
              ...raw,
              addressComponents: [
                { shortText: "EC", types: ["country"] },
                { longText: "Nariño", types: ["administrative_area_level_1"] },
              ],
            },
            observed,
            spec,
          ),
          null,
        );
        assert.equal(
          normalizeGooglePlace(
            {
              ...raw,
              addressComponents: [
                { shortText: "CO", types: ["country"] },
                { longText: "Cauca", types: ["administrative_area_level_1"] },
              ],
            },
            observed,
            spec,
          ),
          null,
        );
        assert.equal(
          normalizeGooglePlace(
            { ...raw, location: { latitude: 2, longitude: -78 } },
            observed,
            spec,
          ),
          null,
        );
        assert.equal(
          normalizeGooglePlace(raw, observed, {
            ...spec,
            categories: ["museos"],
          }),
          null,
        );
        assert.equal(
          normalizeGooglePlace(
            { ...raw, businessStatus: "CLOSED_PERMANENTLY" },
            observed,
            spec,
          )?.availability,
          "restringido",
        );
      },
    );
    await t.test(
      "missing credentials fail before any upstream request",
      async () => {
        delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
        await assert.rejects(discoverPlaces(spec), /faltan sus claves/);
        assert.equal(calls.length, 0);
        process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
      },
    );
    await t.test(
      "one search returns signed Google records without Enterprise fields or photo downloads",
      async () => {
        const result = searchResponseSchema.parse(await discoverPlaces(spec));
        assert.equal(result.source, "google");
        assert.equal(result.total, 1);
        place = result.places[0];
        assert.equal(place.id, "google:ChIJSyntheticCafe1");
        assert.ok(isVerifiedPlace(place));
        assert.equal(calls.length, 1);
        assert.ok(calls[0].url.endsWith("places:searchText"));
        const mask = new Headers(calls[0].init?.headers).get(
          "X-Goog-FieldMask",
        )!;
        assert.match(mask, /places.photos/);
        assert.doesNotMatch(
          mask,
          /rating|reviews|openingHours|phone|website|\*/i,
        );
        assert.equal(JSON.parse(String(calls[0].init?.body)).pageSize, 20);
        assert.equal(result.nextPageToken, null);
        assert.equal(result.places[0].costCOP, null);
        assert.ok(!JSON.stringify(result).includes("server-test-key"));
        assert.ok(acceptedJourney([place.id], [place]));
      },
    );
    await t.test(
      "chat uses Google candidates while retaining explicit acceptance",
      async () => {
        const response = await chat(
          request("/api/chat", {
            messages: [{ role: "user", content: "busca cafeterias en Pasto" }],
            demo: true,
          }),
        );
        assert.equal(response.status, 200);
        const result = chatResponseSchema.parse(await response.json());
        assert.equal(result.discovery?.source, "google");
        assert.equal(result.itinerary, null);
        assert.equal(result.places[0].id, place.id);
      },
    );
    await t.test(
      "named queries and reference ambiguity stay bounded and verified",
      async () => {
        await discoverPlaces({ ...spec, name: "Cafe sintetico" });
        const last = calls.at(-1)!;
        assert.ok(last.url.endsWith("places:searchText"));
        assert.equal(JSON.parse(String(last.init?.body)).pageSize, 20);
        const reference = await resolveGoogleReference({
          ...spec,
          near: "Referencia sintetica",
        });
        assert.deepEqual(reference.center, place.coordinates);
        mode = "ambiguous";
        await assert.rejects(
          resolveGoogleReference({ ...spec, near: "Referencia sintetica" }),
          /varias referencias/,
        );
        mode = "success";
      },
    );
    await t.test(
      "photos require a valid signed place and preserve authors without caching downloads",
      async () => {
        let count = calls.length;
        const forged = await photo(
          request("/api/places/photo", { ...place, name: "alterado" }),
        );
        assert.equal(forged.status, 409);
        assert.equal(calls.length, count);
        const result = await photo(request("/api/places/photo", place));
        assert.equal(result.status, 200);
        assert.equal(calls.length, count + 1);
        const data = await result.json();
        assert.equal(data.photo.provider, "google");
        assert.equal(data.photo.authors[0].displayName, "Autor sintetico");
        assert.equal(
          new URL(calls.at(-1)!.url).searchParams.get("skipHttpRedirect"),
          "true",
        );
        count = calls.length;
        const noPhoto = signPlace({ ...place, googlePhoto: undefined });
        assert.deepEqual(
          await (await photo(request("/api/places/photo", noPhoto))).json(),
          { photo: null },
        );
        assert.equal(calls.length, count);
        const wrong = signPlace({
          ...place,
          googlePhoto: {
            ...place.googlePhoto!,
            name: "places/AnotherPlace/photos/SyntheticPhoto1",
          },
        });
        assert.equal(
          (await photo(request("/api/places/photo", wrong))).status,
          400,
        );
        assert.equal(calls.length, count);
      },
    );
    await t.test(
      "routes use place IDs and GPS, without requesting traffic or alternative routes",
      async () => {
        const count = calls.length;
        const response = await route(
          request("/api/route", {
            placeIds: [place.id],
            knownPlaces: [place],
            origin: [1.215, -77.279],
            mode: "walking",
          }),
        );
        assert.equal(response.status, 200);
        assert.equal(calls.length, count + 1);
        const data = await response.json();
        assert.equal(data.provider, "Google Maps");
        assert.equal(data.durationSeconds, 120.5);
        const body = JSON.parse(String(calls.at(-1)!.init?.body));
        assert.equal(body.travelMode, "WALK");
        assert.equal(body.destination.placeId, raw.id);
        assert.equal(body.origin.location.latLng.latitude, 1.215);
        assert.equal(body.routingPreference, undefined);
        assert.equal(body.computeAlternativeRoutes, false);
        assert.deepEqual(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), [
          [-120.2, 38.5],
          [-120.95, 40.7],
          [-126.453, 43.252],
        ]);
        assert.throws(() => decodePolyline("abc"));
      },
    );
    await t.test(
      "saved journeys retain Google IDs and schedule, and discard place content",
      () => {
        const other = fixturePlaces()[0];
        const stored = storedJourney({
          results: [place, other],
          places: [place, other],
          acceptedIds: [place.id, other.id],
          search: {
            ...spec,
            center: place.coordinates,
            near: "Consulta del viajero",
            reference: { id: place.id, name: place.name },
          },
          itinerary: acceptedJourney([place.id, other.id], [place, other]),
          profile: emptyProfile,
          mode: "demo",
        });
        const text = JSON.stringify(stored);
        assert.ok(!text.includes(place.name));
        assert.ok(!text.includes("Direccion sintetica"));
        assert.ok(!text.includes("SyntheticPhoto1"));
        assert.ok(!text.includes("Autor sintetico"));
        assert.deepEqual(stored.googlePlaceIds, [place.id, other.id]);
        assert.deepEqual(stored.places, []);
        assert.equal(stored.search.center, undefined);
        assert.equal(stored.itinerary?.days[0].stops[0].placeId, place.id);
      },
    );
    await t.test(
      "fresh details are fetched for stored IDs; active signed records avoid another request",
      async () => {
        let count = calls.length;
        assert.equal(
          (await resolvePlaces([place.id], [place]))[0].id,
          place.id,
        );
        assert.equal(calls.length, count);
        await resolvePlaces([place.id]);
        await resolvePlaces([place.id]);
        assert.equal(calls.length, count + 2);
        count = calls.length;
        const expired = signPlace({
          ...place,
          observedAt: new Date(Date.now() - 31 * 60000).toISOString(),
        });
        await resolvePlaces([place.id], [expired]);
        assert.equal(calls.length, count + 1);
      },
    );
    await t.test(
      "continuation tokens preserve the query and fetch only the requested next page",
      async () => {
        mode = "pagination";
        const start = calls.length;
        const first = await discoverPlaces(spec);
        assert.equal(first.nextPageToken, "page-two-token");
        const second = await discoverPlaces(first.spec, first.nextPageToken!);
        assert.equal(second.places[0].id, "google:ChIJSyntheticCafe2");
        assert.equal(second.nextPageToken, null);
        assert.equal(calls.length, start + 2);
        const a = JSON.parse(String(calls[start].init?.body));
        const b = JSON.parse(String(calls[start + 1].init?.body));
        assert.equal(b.pageToken, first.nextPageToken);
        delete b.pageToken;
        assert.deepEqual(b, a);
        assert.ok(
          new Headers(calls[start].init?.headers)
            .get("X-Goog-FieldMask")!
            .includes("nextPageToken"),
        );
        mode = "success";
      },
    );
    await t.test(
      "denials and quotas report errors without retries",
      async () => {
        const later = Date.now() + 61000;
        const clock = mock.method(Date, "now", () => later);
        try {
          mode = "denied";
          await assert.rejects(discoverPlaces(spec), /rechazó la clave/);
          mode = "quota";
          await assert.rejects(discoverPlaces(spec), /cuota configurada/);
          const count = calls.length;
          await assert.rejects(discoverPlaces(spec), /límite temporal/);
          assert.equal(calls.length, count);
        } finally {
          clock.mock.restore();
        }
      },
    );
  } finally {
    upstream.mock.restore();
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
