// Explicit live smoke. Invoked manually; never part of npm test.
import assert from "node:assert/strict";
import { searchResponseSchema } from "../src/lib/places";
import { chatResponseSchema } from "../src/lib/schemas";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base },
    body: JSON.stringify(body),
  });
const response = await post("/api/places/search", {
  spec: {
    zone: "pasto",
    radius: 3000,
    categories: ["museos"],
    name: "",
    regionalFood: false,
  },
});
assert.equal(response.status, 200, await response.clone().text());
const result = searchResponseSchema.parse(await response.json());
assert.ok(result.places.length > 0, "No museums returned by live OSM query");
const reply = await post("/api/chat", {
  messages: [
    {
      role: "user",
      content:
        "1 día de museos, presupuesto de 100000 COP para el grupo. Viajo solo en carro.",
    },
  ],
  search: result.spec,
  selectedIds: [result.places[0].id],
  demo: true,
});
assert.equal(reply.status, 200, await reply.clone().text());
const plan = chatResponseSchema.parse(await reply.json());
assert.ok(plan.itinerary);
assert.ok(plan.places.length);
console.log(
  `LIVE OSM OK: ${result.total} results, ${result.source}; grounded chat itinerary generated.`,
);
