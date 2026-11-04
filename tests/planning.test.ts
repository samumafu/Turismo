import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
import { fixturePlaces } from "./fixtures";
const request = (content: string): ChatRequest => ({
  messages: [{ role: "user", content }],
  profile: emptyProfile,
  itinerary: null,
  demo: true,
  selectedIds: [],
});
const prompt =
  "2 días de cultura, presupuesto de 300000 COP para todo el grupo. Somos 2 y viajamos en carro.";
test("search understands categories, names, radius, regional food and named references", () => {
  assert.deepEqual(interpretSearch("cascadas cerca de Pasto").categories, [
    "cascadas",
  ]);
  assert.equal(
    interpretSearch("restaurantes típicos en Ipiales").regionalFood,
    true,
  );
  assert.equal(
    interpretSearch("restaurantes típicos en Ipiales").zone,
    "ipiales",
  );
  assert.equal(
    interpretSearch("lugares naturales alrededor de La Cocha, radio de 15 km")
      .radius,
    15000,
  );
  assert.equal(interpretSearch("Museo Taminango en Pasto").name, "Taminango");
  const near = interpretSearch(
    "una cafeteria cerca de la universidad cooperativa de colombia campus pasto",
  );
  assert.deepEqual(near.categories, ["cafeterias"]);
  assert.equal(near.name, "");
  assert.match(near.near!, /universidad cooperativa/i);
  assert.equal(near.radius, 1500);
  assert.equal(interpretSearch("cafeterías en Pasto", near).near, undefined);
});
test("invalid geographic filters and fabricated place IDs are rejected", () => {
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
test("rule planning uses only available candidates and leaves unknown costs and hours unknown", () => {
  assert.equal(
    dynamicReply(request("naturaleza"), fixturePlaces()).itinerary,
    null,
  );
  assert.equal(dynamicReply(request(prompt), []).itinerary, null);
  const result = dynamicReply(request(prompt), fixturePlaces());
  assert.ok(result.itinerary);
  assert.ok(validatePlan(result.itinerary, result.profile, fixturePlaces()));
  assert.equal(fixturePlaces()[0].costCOP, null);
  assert.equal(fixturePlaces()[0].openingHours, null);
});
test("budget and duration edits preserve grounded destinations", () => {
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
test("phantom destinations and excessive walking distances fail itinerary validation", () => {
  const first = dynamicReply(request(prompt), fixturePlaces());
  const bad = structuredClone(first.itinerary!);
  bad.days[0].stops[0].placeId = "google:NonexistentPlace";
  assert.equal(validatePlan(bad, first.profile, fixturePlaces()), false);
  const far = fixturePlaces().map((p, i) =>
    i === 1 ? { ...p, coordinates: [1.8, -78.7] as [number, number] } : p,
  );
  assert.equal(
    validatePlan(
      first.itinerary!,
      { ...first.profile, transport: "a-pie" },
      far,
    ),
    false,
  );
});
test("COP values and external Google Maps links preserve exact place identities", () => {
  assert.equal(
    extractDemoProfile("Presupuesto de 1,5 millones por persona", emptyProfile)
      .budgetCOP,
    1500000,
  );
  const place = fixturePlaces()[0];
  assert.equal(
    new URL(mapsLink(place)).searchParams.get("query_place_id"),
    place.id.slice(7),
  );
  assert.equal(
    new URL(directionsLink(fixturePlaces())).searchParams.get("api"),
    "1",
  );
});
test("cross-site requests, oversized bodies and excess frequency are rejected", async () => {
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
