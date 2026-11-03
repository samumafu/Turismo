import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchQuery,
  buildResolveQuery,
  deduplicatePlaces,
  normalizeElement,
  normalizeResult,
} from "../src/lib/osm";
import {
  categoryKeys,
  interpretSearch,
  searchSpecSchema,
  mapsLink,
  directionsLink,
} from "../src/lib/places";
import {
  dynamicReply,
  extractDemoProfile,
  validatePlan,
} from "../src/lib/planning";
import {
  emptyProfile,
  chatRequestSchema,
  type ChatRequest,
} from "../src/lib/schemas";
import {
  readJson,
  guardRequest,
  HttpError,
  rateLimit,
} from "../src/lib/server/guard";
import { fixturePlaces, rawFixture } from "./fixtures";
const request = (content: string): ChatRequest => ({
  messages: [{ role: "user", content }],
  profile: emptyProfile,
  itinerary: null,
  demo: true,
  selectedIds: [],
});
const prompt =
  "2 días de cultura, presupuesto de 300000 COP para todo el grupo. Somos 2 y viajamos en carro.";
test("natural searches infer waterfalls near Pasto", () => {
  const s = interpretSearch("cascadas cerca de Pasto");
  assert.equal(s.zone, "pasto");
  assert.deepEqual(s.categories, ["cascadas"]);
  assert.equal(s.name, "");
});
test("regional cuisine in Ipiales requires OSM cuisine tags", () => {
  const s = interpretSearch("restaurantes típicos en Ipiales");
  assert.equal(s.zone, "ipiales");
  assert.equal(s.regionalFood, true);
  assert.match(buildSearchQuery(s), /cuisine/);
});
test("nature around La Cocha and custom radius are interpreted", () => {
  const s = interpretSearch(
    "lugares naturales alrededor de La Cocha, radio de 15 km",
  );
  assert.equal(s.zone, "cocha");
  assert.deepEqual(s.categories, ["naturaleza"]);
  assert.equal(s.radius, 15000);
});
test("name lookup and quoted names remain names, never executable QL", () => {
  assert.equal(interpretSearch("Museo Taminango en Pasto").name, "Taminango");
  const s = interpretSearch('"Taminango"');
  assert.equal(s.name, "Taminango");
  const q = buildSearchQuery({ ...s, name: 'a.*"];out;(' });
  assert.ok(q.includes(JSON.stringify("a\\.\\*").slice(1, -1)));
  assert.ok(q.endsWith("out body center 501;"));
});
test("all tourism categories have bounded geographic query templates", () => {
  for (const c of categoryKeys) {
    const q = buildSearchQuery(searchSpecSchema.parse({ categories: [c] }));
    assert.match(q, /CO-NAR/);
    assert.match(q, /around:8000/);
    assert.match(q, /timeout:12/);
    assert.ok(q.endsWith("501;"));
  }
});
test("invalid radius, category, center and fabricated selected ID are rejected", () => {
  assert.equal(searchSpecSchema.safeParse({ radius: 1000000 }).success, false);
  assert.equal(
    searchSpecSchema.safeParse({ categories: ["sql"] }).success,
    false,
  );
  assert.equal(searchSpecSchema.safeParse({ center: [40, -3] }).success, false);
  assert.equal(
    chatRequestSchema.safeParse({
      ...request(prompt),
      selectedIds: ["inventado"],
    }).success,
    false,
  );
});
test("nodes and way centers retain canonical OSM identity and provenance", () => {
  const now = new Date().toISOString();
  const node = normalizeElement(rawFixture(1).elements[0], now)!;
  assert.equal(node.id, "osm:node:910000001");
  assert.deepEqual(node.coordinates, [1.2146, -77.2783]);
  assert.equal(node.costCOP, null);
  const way = normalizeElement(
    {
      type: "way",
      id: 12345,
      center: { lat: 1.2146, lon: -77.2783 },
      tags: { name: "Prueba", leisure: "park" },
    },
    now,
  )!;
  assert.equal(way.coordinateKind, "center");
  assert.match(way.sources[0].url, /way\/12345$/);
});
test("unknown prices, opening times and cuisine are never fabricated", () => {
  const p = fixturePlaces()[0];
  assert.equal(p.costCOP, null);
  assert.equal(p.openingHours, null);
  assert.equal(p.cuisine, null);
  assert.equal(p.image, undefined);
});
test("private sites and volcanoes are ineligible", () => {
  const p = normalizeElement(
    {
      type: "node",
      id: 123,
      lat: 1.21,
      lon: -77.28,
      tags: { tourism: "attraction", name: "Prueba", access: "private" },
    },
    new Date().toISOString(),
  )!;
  assert.equal(p.availability, "restringido");
  assert.equal(p.roadAccess, false);
});
test("unsafe external URLs and invalid coordinates are discarded", () => {
  const p = normalizeElement(
    {
      type: "node",
      id: 123,
      lat: 1.21,
      lon: -77.28,
      tags: {
        tourism: "museum",
        name: "Prueba",
        website: "javascript:alert(1)",
      },
    },
    new Date().toISOString(),
  )!;
  assert.equal(p.sources.length, 1);
  assert.equal(
    normalizeElement(
      {
        type: "node",
        id: 123,
        lat: 100,
        lon: 200,
        tags: { tourism: "museum" },
      },
      new Date().toISOString(),
    ),
    null,
  );
});
test("duplicate IDs and same-name nearby node/way copies are merged", () => {
  const p = fixturePlaces()[0];
  assert.equal(
    deduplicatePlaces([
      p,
      p,
      { ...p, id: "osm:way:1234", coordinates: [1.21461, -77.27831] },
    ]).length,
    1,
  );
  assert.equal(
    deduplicatePlaces([
      p,
      { ...p, id: "osm:way:1234", coordinates: [1.31461, -77.37831] },
    ]).length,
    2,
  );
});
test("incomplete Overpass results are not presented as complete successes", () => {
  assert.throws(() =>
    normalizeResult(
      { elements: [], remark: "runtime timeout" },
      new Date().toISOString(),
    ),
  );
  assert.equal(
    normalizeResult(rawFixture(501), new Date().toISOString()).truncated,
    true,
  );
});
test("resolution batches IDs instead of performing per-place requests", () => {
  const q = buildResolveQuery(["osm:node:1", "osm:node:2", "osm:way:3"]);
  assert.match(q, /node\(id:1,2\)/);
  assert.match(q, /way\(id:3\)/);
  assert.match(q, /CO-NAR/);
});
test("rule planner asks for missing data and never synthesizes POIs", () => {
  assert.equal(
    dynamicReply(request("naturaleza"), fixturePlaces()).itinerary,
    null,
  );
  assert.equal(dynamicReply(request(prompt), []).itinerary, null);
  const p = dynamicReply(request(prompt), fixturePlaces());
  assert.ok(p.itinerary);
  assert.ok(validatePlan(p.itinerary, p.profile, fixturePlaces()));
});
test("new budgets and time reductions preserve grounded destinations", () => {
  const first = dynamicReply(request(prompt), fixturePlaces());
  const next = dynamicReply(
    {
      ...request("Reduce a 1 día y 2 horas, presupuesto a 150 mil COP"),
      profile: first.profile,
      itinerary: first.itinerary,
    },
    fixturePlaces(),
  );
  assert.equal(next.profile.budgetCOP, 150000);
  assert.equal(next.itinerary?.days.length, 1);
  assert.ok(validatePlan(next.itinerary!, next.profile, fixturePlaces()));
});
test("phantom, restricted and non-local walking itineraries fail server semantics", () => {
  const first = dynamicReply(request(prompt), fixturePlaces());
  const bad = structuredClone(first.itinerary!);
  bad.days[0].stops[0].placeId = "osm:node:999";
  assert.equal(validatePlan(bad, first.profile, fixturePlaces()), false);
  const walking = { ...first.profile, transport: "a-pie" as const };
  const far = fixturePlaces().map((p, i) =>
    i === 1 ? { ...p, coordinates: [1.8, -78.7] as [number, number] } : p,
  );
  assert.equal(validatePlan(first.itinerary!, walking, far), false);
});
test("COP parsing and keyless Google Maps links remain correct", () => {
  assert.equal(
    extractDemoProfile("Presupuesto de 1,5 millones por persona", emptyProfile)
      .budgetCOP,
    1500000,
  );
  assert.equal(
    new URL(mapsLink(fixturePlaces()[0])).searchParams.get("query"),
    "1.2146,-77.2783",
  );
  assert.equal(
    new URL(directionsLink(fixturePlaces())).searchParams.get("api"),
    "1",
  );
});
test("origin, byte limits and Retry-After protect endpoints", async () => {
  assert.throws(() =>
    guardRequest(
      new Request("http://localhost/api", {
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
      }),
      "chat",
    ),
  );
  await assert.rejects(
    readJson(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ x: "ñ".repeat(100) }),
      }),
      50,
    ),
    (e: unknown) => e instanceof HttpError && e.status === 413,
  );
  rateLimit("test:new", 1, 60000);
  assert.throws(
    () => rateLimit("test:new", 1, 60000),
    (e: unknown) =>
      e instanceof HttpError && e.status === 429 && !!e.retryAfter,
  );
});
