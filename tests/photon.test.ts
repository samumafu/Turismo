import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { normalizePhoton, photonUrl } from "../src/lib/server/photon";
import { discoverPlaces, resolvePlaces } from "../src/lib/server/discovery";
import { searchSpecSchema } from "../src/lib/places";
import { dynamicReply, validatePlan } from "../src/lib/planning";
import { emptyProfile } from "../src/lib/schemas";

const spec = searchSpecSchema.parse({ categories: ["museos"], radius: 3000 });
const feature = {
  geometry: { type: "Point", coordinates: [-77.2783, 1.2146] },
  properties: {
    osm_type: "W",
    osm_id: 910000005,
    osm_key: "tourism",
    osm_value: "museum",
    name: "Museo de prueba",
    state: "Nariño",
    countrycode: "CO",
    city: "Pasto",
  },
};
test("Photon retains OSM IDs and rejects outside-region, outside-radius and wrong-category records", () => {
  const data = {
    features: [
      feature,
      { ...feature, properties: { ...feature.properties, countrycode: "EC" } },
      { ...feature, properties: { ...feature.properties, state: "Cauca" } },
      {
        ...feature,
        geometry: { ...feature.geometry, coordinates: [-78.7, 1.8] },
      },
      {
        ...feature,
        properties: {
          ...feature.properties,
          osm_key: "amenity",
          osm_value: "restaurant",
        },
      },
    ],
  };
  const places = normalizePhoton(data, spec, new Date().toISOString());
  assert.equal(places.length, 1);
  assert.equal(places[0].id, "osm:way:910000005");
  assert.equal(places[0].coordinateKind, "center");
  assert.equal(places[0].costCOP, null);
  assert.equal(places[0].openingHours, null);
  assert.equal(photonUrl(spec).searchParams.get("countrycode"), "CO");
  assert.equal(photonUrl(spec).searchParams.get("limit"), "50");
  assert.deepEqual(
    normalizePhoton(
      { features: [feature] },
      { ...spec, regionalFood: true },
      new Date().toISOString(),
    ),
    [],
  );
});

test("a real provider outage uses Photon records for search and grounded rule itineraries (simulated HTTP)", async () => {
  const previous = process.env.OVERPASS_FALLBACK_URL;
  process.env.OVERPASS_FALLBACK_URL = "disabled";
  const calls: string[] = [];
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/interpreter")) throw new TypeError("network failure");
      assert.match(url, /photon\.komoot\.io/);
      return Response.json({ features: [feature] });
    },
  );
  try {
    const result = await discoverPlaces(spec);
    assert.equal(result.source, "photon");
    assert.equal(result.places.length, 1);
    assert.match(result.notice!, /cobertura/);
    assert.equal(calls.length, 2);
    assert.equal((await resolvePlaces([result.places[0].id])).length, 1);
    const reply = dynamicReply(
      {
        messages: [
          {
            role: "user",
            content:
              "1 dia de cultura, presupuesto de 100000 COP para todo el grupo. Somos 2 y viajamos en carro.",
          },
        ],
        profile: emptyProfile,
        itinerary: null,
        demo: true,
        selectedIds: [],
      },
      result.places,
    );
    assert.ok(reply.itinerary);
    assert.ok(validatePlan(reply.itinerary, reply.profile, result.places));
    assert.equal((await discoverPlaces(spec)).source, "cache");
    assert.equal(calls.length, 2);
  } finally {
    upstream.mock.restore();
    if (previous === undefined) delete process.env.OVERPASS_FALLBACK_URL;
    else process.env.OVERPASS_FALLBACK_URL = previous;
  }
});
