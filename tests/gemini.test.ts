import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/chat/route";
import { chatResponseSchema, emptyProfile } from "../src/lib/schemas";
import { rawFixture, routeMatrixFixture } from "./fixtures";
import { geminiFailureNotice } from "../src/lib/server/gemini";
import { isVerifiedPlace } from "../src/lib/server/place-verification";
import { itineraryIds } from "../src/lib/accepted-journey";
const request = (body: unknown) =>
  new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
test("chat discovers options and plans only accepted visits (simulated HTTP)", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-not-a-secret";
  let now = Date.now();
  const clock = mock.method(Date, "now", () => now);
  let modelCalls = 0;
  let mapsCalls = 0;
  const mapKeys = [
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_SERVER_API_KEY",
  ] as const;
  const previousMaps = mapKeys.map((k) => process.env[k]);
  for (const k of mapKeys) process.env[k] = "test-map-key";
  let quota = false;
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("computeRouteMatrix"))
        return Response.json(routeMatrixFixture(init));
      if (String(url).includes("places.googleapis.com")) {
        mapsCalls++;
        return Response.json({
          places: rawFixture(3).places.map((p, i) => ({
            ...p,
            displayName: { text: "Opci\u00f3n " + (i + 1) },
            types: i === 1 ? ["park"] : ["cafe"],
          })),
        });
      }
      modelCalls++;
      if (quota)
        return Response.json(
          {
            error: {
              code: 429,
              message: "Test quota",
              status: "RESOURCE_EXHAUSTED",
            },
          },
          { status: 429 },
        );
      const data = JSON.parse(JSON.parse(String(init?.body)).input);
      const last = data.messages.at(-1).content;
      const result = {
        action:
          last === "Hola"
            ? "clarify"
            : /Organiza|Elijo/.test(last)
              ? "plan"
              : "explore",
        message:
          last === "Hola"
            ? "El trayecto es de 500 metros en línea recta."
            : "Elige los lugares que quieras visitar.",
        profile: data.previousProfile,
        zone: "pasto",
        radius: 8000,
        categories: ["cafeterias", "parques"],
        name: "",
        regionalFood: false,
        selection: {
          add: data.knownPlaces?.length
            ? [data.knownPlaces[0].id, "google:FakePlace999999999"]
            : [],
          remove: [],
        },
      };
      return Response.json({
        status: "completed",
        output_text: JSON.stringify(result),
        steps: [],
      });
    },
  );
  const call = async (body: object) => {
    const r = await POST(request(body));
    assert.equal(r.status, 200);
    return chatResponseSchema.parse(await r.json());
  };
  try {
    const hello = await call({ messages: [{ role: "user", content: "Hola" }] });
    assert.equal(hello.action, "clarify");
    assert.ok(!/500|recta/.test(hello.message));
    assert.equal(mapsCalls, 0);
    const options = await call({
      messages: [
        {
          role: "user",
          content: "Hoy quiero ir a un café y luego a un parque",
        },
      ],
    });
    assert.equal(options.itinerary, null);
    assert.equal(options.action, "explore");
    assert.equal(options.places.length, 2);
    assert.ok(options.places.every(isVerifiedPlace));
    const chosen = options.places.slice(0, 2).map((p) => p.id);
    const before = modelCalls;
    const plan = await call({
      messages: [{ role: "user", content: "Organiza mi itinerario" }],
      selectedIds: chosen,
      knownPlaces: options.places,
    });
    assert.deepEqual(itineraryIds(plan.itinerary), chosen);
    assert.equal(modelCalls - before, 1);
    assert.equal(mapsCalls, 2);
    assert.equal(plan.profile.budgetCOP, null); // Budget is not required to accept two visits.
    const suggestions = await call({
      messages: [{ role: "user", content: "Busca más cafeterías" }],
      knownPlaces: options.places,
    });
    assert.deepEqual(suggestions.selectedIds, []);
    assert.equal(suggestions.itinerary, null); // Model suggestions never imply acceptance.
    const accepted = await call({
      messages: [{ role: "user", content: "Elijo Opción 1" }],
      knownPlaces: options.places,
    });
    assert.deepEqual(accepted.selectedIds, [options.places[0].id]);
    assert.ok(!JSON.stringify(accepted.itinerary).includes("999999999"));
    now += 61000;
    quota = true;
    const fallback = await call({
      messages: [{ role: "user", content: "Organiza mi itinerario" }],
      selectedIds: chosen,
      knownPlaces: options.places,
    });
    assert.equal(fallback.mode, "demo");
    assert.deepEqual(itineraryIds(fallback.itinerary), chosen);
    assert.match(fallback.notice!, /cuota/);
    const bad = await POST(
      request({
        messages: [{ role: "user", content: "Hola" }],
        selectedIds: ["made-up"],
      }),
    );
    assert.equal(bad.status, 400);
    void emptyProfile;
  } finally {
    upstream.mock.restore();
    clock.mock.restore();
    mapKeys.forEach((k, i) => {
      if (previousMaps[i] === undefined) delete process.env[k];
      else process.env[k] = previousMaps[i];
    });
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
test("Gemini diagnostics remain safe and distinguish key and quota", () => {
  assert.match(geminiFailureNotice({ status: 403 }), /permisos/);
  assert.match(geminiFailureNotice({ status: 429 }), /cuota/);
  assert.match(geminiFailureNotice({ status: 404 }), /modelo/);
  assert.doesNotMatch(
    geminiFailureNotice(new Error("secret-provider-payload")),
    /secret-provider/,
  );
});
