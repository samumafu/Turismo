import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { interpretSearch } from "../src/lib/places";
import {
  normalizeReference,
  referenceUrl,
  resolveSearchReference,
} from "../src/lib/server/search-reference";

const feature = {
  geometry: { type: "Point", coordinates: [-77.28, 1.22] },
  properties: {
    osm_type: "N",
    osm_id: 910000100,
    name: "Universidad de prueba",
    countrycode: "CO",
    state: "Nariño",
  },
};
test("cafeteria near a named campus separates the target from the reference without GPS", async () => {
  const spec = interpretSearch(
    "una cafeteria cerca de la universidad cooperativa de colombia campus pasto",
  );
  assert.deepEqual(spec.categories, ["cafeterias"]);
  assert.equal(spec.name, "");
  assert.match(spec.near!, /universidad cooperativa/i);
  assert.equal(spec.radius, 1500);
  assert.equal(spec.center, undefined);
  assert.equal(interpretSearch("cafeterías en Pasto", spec).near, undefined);
  assert.equal(
    interpretSearch("amplía el radio hasta 3 km", spec).near,
    spec.near,
  );
  assert.equal(interpretSearch("amplía el radio hasta 3 km", spec).name, "");
  assert.doesNotMatch(referenceUrl(spec).searchParams.get("q")!, /campus/i);
  let calls = 0;
  const upstream = mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ features: [feature] });
  });
  try {
    const found = await resolveSearchReference({
      ...spec,
      center: [1.8, -78.7],
    });
    assert.deepEqual(found.center, [1.22, -77.28]);
    assert.equal(found.reference?.id, "osm:node:910000100");
    await resolveSearchReference(spec);
    assert.equal(calls, 1);
  } finally {
    upstream.mock.restore();
  }
});
test("missing, foreign and ambiguous references ask for clarification rather than using city center", () => {
  assert.throws(() => normalizeReference({ features: [] }), /No pude ubicar/);
  assert.throws(
    () =>
      normalizeReference({
        features: [
          {
            ...feature,
            properties: { ...feature.properties, countrycode: "EC" },
          },
        ],
      }),
    /No pude ubicar/,
  );
  assert.throws(
    () =>
      normalizeReference({
        features: [
          feature,
          {
            ...feature,
            geometry: { type: "Point", coordinates: [-77.29, 1.23] },
            properties: { ...feature.properties, osm_id: 910000101 },
          },
        ],
      }),
    /varios puntos/,
  );
});
