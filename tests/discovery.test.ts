import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { discoverPlaces, resolvePlaces } from "../src/lib/server/discovery";
import { searchSpecSchema } from "../src/lib/places";
import { rawFixture } from "./fixtures";
test("Overpass cache, coalescing, failure cooldown and stale responses with simulated HTTP", async (t) => {
  const initial = Date.now();
  let clock = initial;
  const date = mock.method(Date, "now", () => clock);
  let count = 0;
  let fail = false;
  const fetch = mock.method(globalThis, "fetch", async () => {
    count++;
    return fail
      ? Response.json({ error: "busy" }, { status: 429 })
      : Response.json(rawFixture(5));
  });
  try {
    const spec = searchSpecSchema.parse({
      categories: ["museos"],
      radius: 3000,
    });
    await t.test(
      "concurrent identical lookups share one upstream request",
      async () => {
        const [a, b] = await Promise.all([
          discoverPlaces(spec),
          discoverPlaces(spec),
        ]);
        assert.equal(a.places.length, 5);
        assert.equal(b.places.length, 5);
        assert.equal(count, 1);
      },
    );
    await t.test(
      "resolution uses previously observed OSM records",
      async () => {
        const result = await resolvePlaces(["osm:node:910000001"]);
        assert.equal(result[0].name, "Lugar de prueba 1");
        assert.equal(count, 1);
      },
    );
    await t.test(
      "stale responses are explicitly identified during provider throttling",
      async () => {
        clock = initial + 16 * 60000;
        fail = true;
        const response = await discoverPlaces(spec);
        assert.equal(response.source, "stale-cache");
        assert.match(response.notice!, /24 horas/);
        assert.equal(count, 2);
      },
    );
    await t.test(
      "no cache means a visible service error, never a local catalog",
      async () => {
        await assert.rejects(
          discoverPlaces({ ...spec, name: "different-query" }),
        );
        assert.equal(count, 2);
      },
    );
    await t.test(
      "invalid or missing OSM IDs cannot be resolved from browser snapshots",
      async () => {
        await assert.rejects(resolvePlaces(["fake"]));
      },
    );
  } finally {
    fetch.mock.restore();
    date.mock.restore();
  }
});
