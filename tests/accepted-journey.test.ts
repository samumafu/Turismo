import { test } from "node:test";
import assert from "node:assert/strict";
import { fixturePlaces } from "./fixtures";
import { acceptedJourney, itineraryIds } from "../src/lib/accepted-journey";
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
