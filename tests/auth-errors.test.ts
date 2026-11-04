import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../src/lib/auth-errors";

test("authentication errors distinguish confirmation, SMTP, credentials and request limits", () => {
  assert.match(
    authErrorMessage({ code: "email_not_confirmed", status: 400 }, "login"),
    /confirmar el correo/,
  );
  assert.match(
    authErrorMessage({ code: "otp_expired", status: 403 }, "confirm"),
    /expiró/,
  );
  assert.match(
    authErrorMessage(
      {
        code: "unexpected_failure",
        status: 500,
        message: "Error sending confirmation email",
      },
      "register",
    ),
    /Auth Log/,
  );
  assert.match(
    authErrorMessage(
      { code: "email_address_not_authorized", status: 400 },
      "register",
    ),
    /Custom SMTP/,
  );
  assert.match(
    authErrorMessage({ code: "invalid_credentials", status: 400 }, "login"),
    /no son correctos/,
  );
  assert.match(
    authErrorMessage({ status: 429 }, "register"),
    /Demasiados intentos/,
  );
  assert.doesNotMatch(
    authErrorMessage(
      { status: 500, message: "private-provider-response" },
      "register",
    ),
    /private-provider-response/,
  );
});
