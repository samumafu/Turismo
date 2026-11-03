import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { POST as chat } from "../src/app/api/chat/route";
import { POST as search } from "../src/app/api/places/search/route";
import {
  chatResponseSchema,
  emptyProfile,
  missingFields,
  type ChatRequest,
} from "../src/lib/schemas";
import { dynamicReply, extractDemoProfile } from "../src/lib/planning";
import { searchSpecSchema } from "../src/lib/places";
import { fixturePlaces, rawFixture } from "./fixtures";
import { geminiFailureNotice } from "../src/lib/server/gemini";
const input: ChatRequest = {
  messages: [
    {
      role: "user",
      content:
        "2 días de museos, presupuesto de 300000 COP para el grupo. Somos 2 y vamos en carro.",
    },
  ],
  profile: emptyProfile,
  itinerary: null,
  demo: false,
  selectedIds: [],
};
const request = (body: unknown, path = "chat") =>
  new Request("http://localhost:3000/api/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-for": "198.51.100.210",
    },
    body: JSON.stringify(body),
  });
test("OSM discovery, cache, Gemini grounding and failure paths with simulated HTTP", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-not-a-secret";
  let overpassCalls = 0;
  let modelCalls = 0;
  let failModel = false;
  let phantom = false;
  let omitAgenda = false;
  let lastCandidates: unknown[] = [];
  const mocked = mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = url instanceof Request ? url.url : String(url);
      const text =
        url instanceof Request ? await url.clone().text() : String(init?.body);
      if (href.includes("/interpreter")) {
        overpassCalls++;
        return Response.json(rawFixture(125));
      }
      assert.match(href, /generativelanguage\.googleapis\.com/);
      modelCalls++;
      if (failModel)
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
      const body = JSON.parse(text);
      const data = JSON.parse(body.input);
      let result: unknown;
      if (data.allowedCategories) {
        const profile = extractDemoProfile(
          data.messages.at(-1).content,
          data.previousProfile,
        );
        result = {
          action: missingFields(profile).length ? "clarify" : "plan",
          message:
            "Completa los datos que faltan para organizar el itinerario.",
          profile,
          zone: "pasto",
          radius: 8000,
          categories: ["museos"],
          name: "",
          regionalFood: false,
        };
      } else {
        lastCandidates = data.candidates;
        assert.ok(data.candidates.length <= 50);
        assert.equal(data.catalog, undefined);
        const reply = dynamicReply(
          { ...input, messages: data.messages, profile: data.previousProfile },
          data.candidates,
        );
        if (phantom)
          reply.itinerary!.days[0].stops[0].placeId = "osm:node:999999999";
        if (omitAgenda) reply.itinerary = null;
        result = reply;
      }
      return Response.json({
        id: "test",
        status: "completed",
        model: "gemini-3.5-flash-lite",
        output_text: JSON.stringify(result),
        steps: [],
      });
    },
  );
  try {
    await t.test(
      "Gemini asks missing details without depending on Overpass",
      async () => {
        const result = chatResponseSchema.parse(
          await (
            await chat(
              request({
                messages: [
                  {
                    role: "user",
                    content: "Quiero un itinerario de museos en Pasto",
                  },
                ],
              }),
            )
          ).json(),
        );
        assert.equal(result.mode, "gemini");
        assert.equal(result.itinerary, null);
        assert.equal(result.profile.days, null);
        assert.deepEqual(result.places, []);
        assert.equal(overpassCalls, 0);
        assert.equal(modelCalls, 1);
      },
    );
    await t.test(
      "without a key, missing details do not trigger a discovery request",
      async () => {
        delete process.env.GEMINI_API_KEY;
        try {
          const result = chatResponseSchema.parse(
            await (
              await chat(
                request({ messages: [{ role: "user", content: "Hola" }] }),
              )
            ).json(),
          );
          assert.equal(result.mode, "demo");
          assert.equal(result.itinerary, null);
          assert.equal(overpassCalls, 0);
          assert.equal(modelCalls, 1);
        } finally {
          process.env.GEMINI_API_KEY = "test-key-not-a-secret";
        }
      },
    );
    await t.test(
      "bounded search paginates 125 server results into 50 browser records",
      async () => {
        const spec = searchSpecSchema.parse({ categories: ["museos"] });
        const first = await search(request({ spec }, "places/search"));
        assert.equal(first.status, 200);
        const page = await first.json();
        assert.equal(page.total, 125);
        assert.equal(page.places.length, 50);
        assert.equal(page.nextOffset, 50);
        const second = await (
          await search(request({ spec, offset: 50 }, "places/search"))
        ).json();
        assert.equal(second.places.length, 50);
        assert.equal(second.source, "cache");
        assert.equal(overpassCalls, 1);
      },
    );
    await t.test(
      "interpret, discover, then select only observed OSM candidates",
      async () => {
        const before = modelCalls;
        const response = await chat(request(input));
        assert.equal(response.status, 200);
        const result = chatResponseSchema.parse(await response.json());
        assert.equal(result.mode, "gemini");
        assert.ok(result.itinerary);
        assert.ok(lastCandidates.length > 0);
        assert.equal(modelCalls - before, 2);
        assert.equal(result.places[0].id, "osm:node:910000001");
      },
    );
    await t.test(
      "complete profile and observed places produce an agenda even if Gemini omits it",
      async () => {
        const now = Date.now();
        const clock = mock.method(Date, "now", () => now + 61000);
        omitAgenda = true;
        try {
          const result = chatResponseSchema.parse(
            await (await chat(request(input))).json(),
          );
          assert.equal(result.mode, "demo");
          assert.ok(result.itinerary?.days.length);
          assert.ok(
            result.itinerary!.days.every((day) =>
              day.stops.every((stop) =>
                result.places.some((place) => place.id === stop.placeId),
              ),
            ),
          );
        } finally {
          omitAgenda = false;
          clock.mock.restore();
        }
      },
    );
    await t.test(
      "phantom model destination is rejected and rebuilt from OSM",
      async () => {
        phantom = true;
        const result = chatResponseSchema.parse(
          await (await chat(request(input))).json(),
        );
        assert.equal(result.mode, "demo");
        assert.ok(!JSON.stringify(result.itinerary).includes("999999999"));
        phantom = false;
      },
    );
    await t.test(
      "Gemini 429 uses OSM rules without retrying the provider",
      async () => {
        failModel = true;
        const before = modelCalls;
        const result = chatResponseSchema.parse(
          await (await chat(request(input))).json(),
        );
        assert.equal(result.mode, "demo");
        assert.ok(result.itinerary);
        assert.equal(modelCalls - before, 1);
      },
    );
    await t.test(
      "fabricated browser place IDs cannot substitute coordinates",
      async () => {
        const bad = {
          ...input,
          itinerary: dynamicReply(input, fixturePlaces()).itinerary,
        };
        bad.itinerary!.days[0].stops[0].placeId = "made-up";
        const response = await chat(request(bad));
        assert.ok([400, 409].includes(response.status));
      },
    );
  } finally {
    mocked.mock.restore();
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("Gemini diagnostics distinguish configuration and quota without exposing provider errors", () => {
  assert.match(
    geminiFailureNotice({ status: 403, message: "secret-provider-payload" }),
    /permisos/,
  );
  assert.match(geminiFailureNotice({ status: 429 }), /cuota/);
  assert.match(geminiFailureNotice({ status: 404 }), /modelo/);
  assert.match(geminiFailureNotice({ status: 400 }), /solicitud/);
  assert.doesNotMatch(
    geminiFailureNotice(new Error("secret-provider-payload")),
    /secret-provider/,
  );
});
