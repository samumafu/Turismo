import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { queryOverpass } from "../src/lib/server/overpass";
import { HttpError } from "../src/lib/server/guard";
import { rawFixture } from "./fixtures";

test("Overpass transport recovers from outages without evading provider limits", async (t) => {
  let now = Date.now();
  const clock = mock.method(Date, "now", () => now);
  const calls: string[] = [];
  const previousPrimary = process.env.OVERPASS_API_URL;
  const previousBackup = process.env.OVERPASS_FALLBACK_URL;
  process.env.OVERPASS_API_URL = "https://primary.example.test/api/interpreter";
  process.env.OVERPASS_FALLBACK_URL =
    "https://backup.example.test/api/interpreter";
  let primaryMode = "network";
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const host = new URL(String(input)).hostname;
      calls.push(host);
      now += 2000;
      assert.match(
        new Headers(init?.headers).get("User-Agent")!,
        /TurismoInteligentePasto/,
      );
      assert.equal(init?.method, "POST");
      if (host.startsWith("primary")) {
        if (primaryMode === "network") throw new TypeError("fetch failed");
        if (primaryMode === "quota") return Response.json({}, { status: 429 });
        if (primaryMode === "denied") return Response.json({}, { status: 406 });
        if (primaryMode === "html")
          return new Response("<html>Unavailable</html>");
        if (primaryMode === "oversize")
          return new Response("x".repeat(3_000_001));
      }
      return Response.json(rawFixture(2));
    },
  );
  try {
    await t.test(
      "network failure uses one backup; unavailable primary is skipped for a minute",
      async () => {
        assert.equal(
          (await queryOverpass("test")).provider,
          "backup.example.test",
        );
        assert.equal(calls.length, 2);
        await queryOverpass("test 2");
        assert.equal(calls.length, 3);
        assert.equal(calls[2], "backup.example.test");
      },
    );
    await t.test("429 stops both providers and honors cooldown", async () => {
      now += 61000;
      primaryMode = "quota";
      await assert.rejects(
        queryOverpass("quota"),
        (error: unknown) => error instanceof HttpError && !!error.retryAfter,
      );
      const count = calls.length;
      await assert.rejects(queryOverpass("another query"));
      assert.equal(calls.length, count);
      assert.equal(calls.at(-1), "primary.example.test");
    });
    await t.test("406 does not switch to the backup", async () => {
      now += 61000;
      primaryMode = "denied";
      const count = calls.length;
      await assert.rejects(queryOverpass("denied"));
      assert.equal(calls.length, count + 1);
    });
    await t.test(
      "HTML error pages are not mistaken for empty successful searches",
      async () => {
        now += 61000;
        primaryMode = "html";
        assert.equal(
          (await queryOverpass("html")).provider,
          "backup.example.test",
        );
      },
    );
    await t.test(
      "the byte limit is enforced without another provider request",
      async () => {
        now += 61000;
        primaryMode = "oversize";
        const count = calls.length;
        await assert.rejects(
          queryOverpass("large"),
          (error: unknown) =>
            error instanceof HttpError && error.status === 413,
        );
        assert.equal(calls.length, count + 1);
      },
    );
  } finally {
    upstream.mock.restore();
    clock.mock.restore();
    if (previousPrimary === undefined) delete process.env.OVERPASS_API_URL;
    else process.env.OVERPASS_API_URL = previousPrimary;
    if (previousBackup === undefined) delete process.env.OVERPASS_FALLBACK_URL;
    else process.env.OVERPASS_FALLBACK_URL = previousBackup;
  }
});
