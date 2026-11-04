// Regression fixtures only; no live Google or Gemini requests.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { POST as chat } from "../src/app/api/chat/route";
import { normalizeGooglePlace } from "../src/lib/server/google-maps";
import { chatResponseSchema } from "../src/lib/schemas";

const addressComponents = [
  { longText: "Campus sin etiqueta de tipo" },
  { shortText: "CO", types: ["country"] },
  { longText: "Nariño", types: ["administrative_area_level_1"] },
];
const reference = {
  id: "ChIJReferenceTest1",
  displayName: { text: "Campus de prueba" },
  location: { latitude: 1.2146, longitude: -77.2783 },
  addressComponents,
};
const cafe = {
  ...reference,
  id: "ChIJCafeReferenceTest1",
  displayName: { text: "Cafetería de prueba" },
  types: ["cafe"],
};

test("untyped address components do not discard valid places", () => {
  const place = normalizeGooglePlace(cafe, new Date().toISOString());
  assert.equal(place?.id, `google:${cafe.id}`);
  assert.deepEqual(place?.coordinates, [1.2146, -77.2783]);
});

test("chat searches near a reference and resolves an origin without failing on sparse Google records", async (t) => {
  const names = [
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_SERVER_API_KEY",
  ] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) process.env[name] = "synthetic-key";
  let mode = "sparse";
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (mode === "malformed") return Response.json({ places: "invalid" });
      return Response.json({
        places:
          body.pageSize === 5
            ? mode === "unlocated"
              ? [{ id: "ChIJNoCoordinates1" }]
              : [reference, { id: "ChIJNoCoordinates1" }]
            : [cafe],
      });
    },
  );
  const send = (content: string) =>
    chat(
      new Request("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demo: true,
          messages: [{ role: "user", content }],
        }),
      }),
    );
  try {
    await t.test("a nearby search returns map-ready places", async () => {
      const response = await send(
        "Busca cafeterías cerca de Campus de prueba en Pasto",
      );
      assert.equal(response.status, 200);
      const result = chatResponseSchema.parse(await response.json());
      assert.equal(result.action, "explore");
      assert.equal(result.search?.reference?.id, `google:${reference.id}`);
      assert.deepEqual(result.places[0].coordinates, [1.2146, -77.2783]);
      assert.ok(result.places[0].verification);
    });
    await t.test("an explicit origin can be confirmed on the map", async () => {
      const response = await send("Salgo desde Campus de prueba en Pasto");
      assert.equal(response.status, 200);
      const result = chatResponseSchema.parse(await response.json());
      assert.equal(result.origin?.name, reference.displayName.text);
      assert.equal(result.origin?.confirmed, false);
    });
    await t.test("an unlocated reference requests clarification", async () => {
      mode = "unlocated";
      const response = await send(
        "Busca cafeterías cerca de Campus de prueba en Pasto",
      );
      assert.equal(response.status, 422);
      assert.match((await response.json()).error, /Precisa el nombre/);
    });
    await t.test(
      "malformed upstream results report service unavailability",
      async () => {
        mode = "malformed";
        const response = await send("Busca cafeterías en Pasto");
        assert.equal(response.status, 503);
        assert.match((await response.json()).error, /Google Maps/);
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
