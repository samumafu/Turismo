import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  discoverReachablePlaces,
  measureStreetRoutes,
} from "../src/lib/server/route-discovery";
import { interpretSearch, searchSpecSchema } from "../src/lib/places";
import { isVerifiedPlace } from "../src/lib/server/place-verification";
import { POST as search } from "../src/app/api/places/search/route";
import { rawFixture, fixturePlaces } from "./fixtures";

test("custom distances accept meters and decimal kilometers below one kilometer", () => {
  assert.equal(interpretSearch("cafeterías a 250 metros").radius, 250);
  assert.equal(interpretSearch("cafeterías a 0,25 km").radius, 250);
  assert.equal(interpretSearch("cafeterías 0.1 kilómetros").radius, 100);
  assert.equal(searchSpecSchema.safeParse({ radius: 99 }).success, false);
});

test("discovery uses street distances, bounds paired places, and preserves the custom field", async (t) => {
  const names = [
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_SERVER_API_KEY",
  ] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) process.env[name] = "synthetic-key";
  let streetDistance = 200;
  let betweenDistance = 200;
  let malformed = false;
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (String(input).includes("computeRouteMatrix")) {
        assert.match(String(input), /distanceMatrix\/v2:computeRouteMatrix$/);
        assert.equal(body.travelMode, "WALK");
        assert.equal(body.routingPreference, undefined);
        assert.ok(
          new Headers(init?.headers)
            .get("X-Goog-FieldMask")
            ?.includes("status"),
        );
        if (malformed) return Response.json({ invalid: true });
        return Response.json(
          body.origins.flatMap(
            (origin: { waypoint: { placeId?: string } }, originIndex: number) =>
              body.destinations.map((_: unknown, destinationIndex: number) => ({
                ...(originIndex ? { originIndex } : {}),
                ...(destinationIndex ? { destinationIndex } : {}),
                condition: "ROUTE_EXISTS",
                status: {},
                distanceMeters: origin.waypoint.placeId
                  ? betweenDistance
                  : streetDistance,
                duration: "180s",
              })),
          ),
        );
      }
      const records = rawFixture(2).places.map((place, index) => ({
        ...place,
        types: [index ? "park" : "cafe"],
      }));
      return Response.json({ places: records });
    },
  );
  const spec = searchSpecSchema.parse({
    categories: ["cafeterias"],
    radius: 250,
  });
  try {
    await t.test(
      "a nearby coordinate is rejected if the street route exceeds the limit",
      async () => {
        streetDistance = 400;
        assert.equal((await discoverReachablePlaces(spec)).places.length, 0);
        streetDistance = 200;
        const result = await discoverReachablePlaces(spec);
        assert.equal(result.places.length, 1);
        assert.equal(result.places[0].travel?.distanceMeters, 200);
        assert.equal(result.places[0].travel?.durationSeconds, 180);
        assert.ok(isVerifiedPlace(result.places[0]));
      },
    );
    await t.test(
      "categories with a long connecting road are not presented as a nearby combination",
      async () => {
        betweenDistance = 4000;
        const result = await discoverReachablePlaces({
          ...spec,
          radius: 1500,
          categories: ["cafeterias", "parques"],
        });
        assert.equal(result.places.length, 0);
        assert.match(result.notice!, /combinación/);
        betweenDistance = 200;
        const nearby = await discoverReachablePlaces({
          ...spec,
          radius: 1500,
          categories: ["cafeterias", "parques"],
        });
        assert.deepEqual(
          nearby.places.map((place) => place.categoryKey),
          ["cafeterias", "parques"],
        );
        assert.equal(
          nearby.places[1].travel?.originName,
          nearby.places[0].name,
        );
      },
    );
    await t.test(
      "a generic nearby prompt does not replace the custom numeric distance",
      async () => {
        const response = await search(
          new Request("http://localhost:3000/api/places/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: "Una cafetería y un parque cerca",
              spec,
            }),
          }),
        );
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.spec.radius, 250);
        assert.equal(result.places.length, 2);
      },
    );
    await t.test(
      "malformed routing data is a controlled error, never a guessed distance",
      async () => {
        malformed = true;
        await assert.rejects(
          measureStreetRoutes(
            [{ placeId: "SyntheticPlace1" }],
            fixturePlaces().slice(0, 1),
            "walking",
          ),
          /distancias por calles/,
        );
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
