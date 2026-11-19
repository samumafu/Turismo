import { test } from "node:test";
import assert from "node:assert/strict";
import { readStoredJourney, storedJourney } from "../src/lib/journey-storage";
import { emptyProfile } from "../src/lib/schemas";
import { searchSpecSchema } from "../src/lib/places";

const snapshot = {
  search: searchSpecSchema.parse({}),
  profile: emptyProfile,
  itinerary: null,
  results: [],
  places: [],
  acceptedIds: ["osm:node:999"],
};
test("saved journeys round-trip without retaining catalog data", () => {
  const result = readStoredJourney(storedJourney(snapshot));
  assert.deepEqual(result?.snapshot.acceptedIds, snapshot.acceptedIds);
  assert.deepEqual(result?.snapshot.places, []);
  assert.equal(result?.snapshot.version, 2);
});
test("legacy provider records no longer prevent restoring preferences", () => {
  const result = readStoredJourney({
    ...snapshot,
    profile: { days: 2 },
    acceptedIds: ["google:LegacyPlace", ...snapshot.acceptedIds],
    places: [{ id: "google:LegacyPlace" }],
    search: {
      ...snapshot.search,
      reference: { id: "osm:node:456" },
      center: [1.2, -77.3],
    },
  });
  assert.ok(result?.legacyVisits);
  assert.deepEqual(result.snapshot.acceptedIds, snapshot.acceptedIds);
  assert.equal(result.snapshot.profile.days, 2);
  assert.equal(result.snapshot.search.reference, undefined);
  assert.equal(result.snapshot.search.center, undefined);
});
test("invalid and future snapshots cannot overwrite a current journey", () => {
  for (const value of [
    null,
    "{",
    {},
    { ...snapshot, version: 99 },
    { ...snapshot, profile: { days: -10 } },
  ])
    assert.equal(readStoredJourney(value), null);
  assert.ok(readStoredJourney(JSON.stringify(snapshot)));
});
