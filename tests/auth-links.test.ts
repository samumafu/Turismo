import { test } from "node:test";
import assert from "node:assert/strict";
import { completeEmailLink } from "../src/lib/auth-links";

type Auth = Parameters<typeof completeEmailLink>[0];
const href = (type: string) =>
  `https://turismo.example/auth/confirmar#type=${type}&access_token=returned-session&refresh_token=refresh`;

function auth(
  options: { confirmed?: boolean; token?: string; rejected?: boolean } = {},
) {
  let checks = 0;
  return {
    get checks() {
      return checks;
    },
    client: {
      getSession: async () => ({
        data: {
          session: { access_token: options.token ?? "returned-session" },
        },
        error: null,
      }),
      getUser: async () => {
        checks++;
        return {
          data: {
            user: {
              email_confirmed_at:
                options.confirmed === false ? null : "2026-11-04T00:00:00Z",
            },
          },
          error: options.rejected
            ? new Error("provider private details")
            : null,
        };
      },
    } as unknown as Auth,
  };
}

test("email links require matching returned sessions and server-verified confirmation", async () => {
  const valid = auth();
  assert.deepEqual(
    await completeEmailLink(valid.client, href("signup"), "signup"),
    { ok: true },
  );
  assert.equal(valid.checks, 1);
  for (const invalid of [
    auth({ confirmed: false }),
    auth({ token: "older-existing-session" }),
    auth({ rejected: true }),
  ]) {
    assert.equal(
      (await completeEmailLink(invalid.client, href("signup"), "signup")).ok,
      false,
    );
  }
  const expired = await completeEmailLink(
    valid.client,
    "https://turismo.example/auth/confirmar#error_code=otp_expired&error_description=private-provider-message",
    "signup",
  );
  assert.equal(expired.ok, false);
  assert.doesNotMatch(JSON.stringify(expired), /private-provider-message/);
  assert.equal(
    (
      await completeEmailLink(
        valid.client,
        "https://turismo.example/auth/confirmar?correo=confirmado",
        "signup",
      )
    ).ok,
    false,
  );
});

test("password recovery requires a recovery return, never a signup link or a stale login", async () => {
  const valid = auth();
  assert.deepEqual(
    await completeEmailLink(valid.client, href("recovery"), "recovery"),
    { ok: true },
  );
  assert.equal(
    (await completeEmailLink(valid.client, href("signup"), "recovery")).ok,
    false,
  );
  assert.equal(
    (await completeEmailLink(valid.client, href("recovery"), "signup")).ok,
    false,
  );
  const existing = auth({ token: "existing-login" });
  assert.equal(
    (await completeEmailLink(existing.client, href("recovery"), "recovery")).ok,
    false,
  );
});
