import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/route/route";
import { rawFixture, fixturePlaces } from "./fixtures";
import { directionsLink } from "../src/lib/places";

test("GPS routes use resolved destinations, actual profiles and no GPS cache (simulated HTTP)", async (t) => {
  let clock = Date.now();
  const date = mock.method(Date, "now", () => clock);
  const urls: string[] = [];
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("/interpreter")) {
        const raw = rawFixture(3);
        return Response.json({
          ...raw,
          elements: raw.elements.map((e, i) =>
            i === 2 ? { ...e, tags: { ...e.tags, access: "private" } } : e,
          ),
        });
      }
      urls.push(href);
      const coordinates = new URL(href).pathname
        .split("/")
        .at(-1)!
        .split(";")
        .map((p) => p.split(",").map(Number));
      return Response.json({
        code: "Ok",
        waypoints: coordinates.map(() => ({ distance: 2 })),
        routes: [
          {
            distance: 1200,
            duration: 500,
            geometry: { type: "LineString", coordinates },
          },
        ],
      });
    },
  );
  const call = (body: unknown) => {
    clock += 2000;
    return POST(
      new Request("http://localhost:3000/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify(body),
      }),
    );
  };
  const id = "osm:node:910000001";
  const origin: [number, number] = [1.215, -77.28];
  try {
    await t.test(
      "invalid GPS, unsupported mode and one-point routes without origin are rejected",
      async () => {
        for (const body of [
          { placeIds: [id], origin: [91, 0] },
          { placeIds: [id], mode: "transit", origin },
          { placeIds: [id] },
        ])
          assert.equal((await call(body)).status, 400);
        assert.equal(urls.length, 0);
      },
    );
    await t.test(
      "GPS is prepended, browser destination coordinates are ignored, GPS routes are not cached",
      async () => {
        const body = { placeIds: [id], origin, coordinates: [[80, 80]] };
        const a = await call(body);
        assert.equal(a.status, 200);
        assert.equal(a.headers.get("cache-control"), "no-store");
        assert.match(
          urls[0],
          /routed-car\/route\/v1\/driving\/-77\.28,1\.215;-77\.2783,1\.2146/,
        );
        assert.equal((await call(body)).status, 200);
        assert.equal(urls.length, 2);
        const link = new URL(
          directionsLink(fixturePlaces().slice(0, 1), "driving", origin),
        );
        assert.equal(link.searchParams.get("origin"), origin.join(","));
      },
    );
    await t.test(
      "walking uses the foot server, not a car route renamed as walking",
      async () => {
        const response = await call({
          placeIds: [id],
          origin,
          mode: "walking",
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).profile, "walking");
        assert.match(urls.at(-1)!, /routed-foot/);
      },
    );
    await t.test("restricted destinations cannot be routed", async () => {
      const count = urls.length;
      assert.equal(
        (await call({ placeIds: ["osm:node:910000003"], origin })).status,
        422,
      );
      assert.equal(urls.length, count);
    });
  } finally {
    fetch.mock.restore();
    date.mock.restore();
  }
});
