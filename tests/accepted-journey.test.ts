import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { fixturePlaces } from "./fixtures";
import { acceptedJourney, itineraryIds } from "../src/lib/accepted-journey";
import {
  signPlace,
  isVerifiedPlace,
} from "../src/lib/server/place-verification";
import { POST as route } from "../src/app/api/route/route";
import { placePhoto } from "../src/lib/server/place-photo";

test("unaccepted options never enter the journey; order, removal and incomplete profiles are supported", () => {
  const places = fixturePlaces();
  assert.equal(acceptedJourney([], places), null);
  const ids = [places[1].id, places[0].id];
  const timed = acceptedJourney(ids, places)!;
  timed.days[0].stops[0].suggestedTime = "14:00";
  timed.days[0].stops[1].suggestedTime = "16:00";
  assert.equal(
    acceptedJourney(ids, places, timed)?.days[0].stops[0].suggestedTime,
    "14:00",
  );
  assert.notEqual(
    acceptedJourney(ids.slice(1), places, timed)?.days[0].stops[0].placeId,
    ids[0],
  );
  assert.deepEqual(itineraryIds(acceptedJourney(ids, places)), ids);
  assert.deepEqual(
    itineraryIds(acceptedJourney(ids.slice(1), places)),
    ids.slice(1),
  );
  assert.equal(
    acceptedJourney(
      [places[0].id],
      [{ ...places[0], availability: "restringido" }],
    ),
    null,
  );
});
test("signed OSM records support a cold route function without trusting browser edits or calling Overpass", async () => {
  const place = signPlace({
    ...fixturePlaces()[0],
    id: "osm:node:910009000",
    observedAt: new Date().toISOString(),
  });
  assert.ok(isVerifiedPlace(place));
  assert.equal(isVerifiedPlace({ ...place, coordinates: [1.3, -77.4] }), false);
  assert.equal(isVerifiedPlace({ ...place, name: "Other" }), false);
  assert.equal(
    isVerifiedPlace({
      ...place,
      observedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
    }),
    false,
  );
  const calls: string[] = [];
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      assert.match(url, /routing\.openstreetmap\.de/);
      return Response.json({
        code: "Ok",
        waypoints: [{ distance: 1 }, { distance: 2 }],
        routes: [
          {
            distance: 1000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [
                [-77.28, 1.22],
                [place.coordinates[1], place.coordinates[0]],
              ],
            },
          },
        ],
      });
    },
  );
  try {
    const result = await route(
      new Request("http://localhost:3000/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: [1.22, -77.28],
          placeIds: [place.id],
          knownPlaces: [place],
          mode: "walking",
        }),
      }),
    );
    assert.equal(result.status, 200);
    assert.equal(calls.length, 1);
  } finally {
    upstream.mock.restore();
  }
});
test("photos require a reusable Commons license and retain author attribution", async () => {
  const place = { ...fixturePlaces()[0], commons: "File:Test.jpg" };
  let license = "CC BY-SA 4.0";
  const upstream = mock.method(globalThis, "fetch", async () =>
    Response.json({
      query: {
        pages: {
          "1": {
            imageinfo: [
              {
                thumburl: "https://thumb.wikimedia.org/test.jpg",
                descriptionurl:
                  "https://commons.wikimedia.org/wiki/File:Test.jpg",
                extmetadata: {
                  CommonsMetadataExtension: { value: 1 },
                  LicenseShortName: { value: license },
                  LicenseUrl: {
                    value: "https://creativecommons.org/licenses/by-sa/4.0/",
                  },
                  Artist: { value: "<a>Test author</a>" },
                },
              },
            ],
          },
        },
      },
    }),
  );
  try {
    const photo = await placePhoto(place);
    assert.equal(photo?.author, "Test author");
    assert.equal(photo?.license, "CC BY-SA 4.0");
    license = "CC BY-NC 4.0";
    assert.equal(
      await placePhoto({ ...place, id: "osm:node:910009001" }),
      null,
    );
  } finally {
    upstream.mock.restore();
  }
});
