import type { SupabaseClient } from "@supabase/supabase-js";

export const emailConfirmationPath = "/auth/confirmar";
export const passwordRecoveryPath = "/auth/recuperar";

export type EmailConfirmationResult =
  { ok: true } | { ok: false; message: string };

export type EmailReturn =
  | { kind: "none" }
  | { kind: "session"; purpose: "signup" | "recovery" }
  | { kind: "error"; message: string };

export function readEmailReturn(href: string): EmailReturn {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (
    ["error", "error_code", "error_description"].some(
      (key) => hash.has(key) || url.searchParams.has(key),
    )
  ) {
    const code = hash.get("error_code") ?? url.searchParams.get("error_code");
    return {
      kind: "error",
      message:
        code === "otp_expired"
          ? "Ese enlace ya fue utilizado o venció. Si tu correo ya está confirmado, inicia sesión con tu contraseña. Si no, pulsa «Confirmar mi correo» para pedir otro enlace."
          : "No pudimos completar el acceso desde el correo. Inicia sesión o solicita otro enlace de confirmación.",
    };
  }
  if (hash.has("access_token") && hash.has("refresh_token")) {
    if (hash.get("type") === "recovery")
      return { kind: "session", purpose: "recovery" };
    if (["signup", "email"].includes(hash.get("type") ?? ""))
      return { kind: "session", purpose: "signup" };
  }
  return { kind: "none" };
}

// Supabase verifies the email before redirecting. Its browser SDK reads the
// session from the URL fragment; no tokens are passed through our server.
export async function completeEmailLink(
  auth: Pick<SupabaseClient["auth"], "getSession" | "getUser" | "setSession">,
  href: string,
  purpose: "signup" | "recovery",
): Promise<EmailConfirmationResult> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  try {
    // Wait for SDK initialization before the caller clears the URL fragment.
    let { data: sessionData, error: sessionError } = await auth.getSession();
    const incoming = readEmailReturn(href);
    if (incoming.kind === "error")
      return { ok: false, message: incoming.message };
    const allowedTypes =
      purpose === "signup" ? ["signup", "email"] : ["recovery"];
    if (
      !hash.has("access_token") ||
      !hash.has("refresh_token") ||
      !allowedTypes.includes(hash.get("type") ?? "")
    )
      return {
        ok: false,
        message:
          "Abre el botón del correo correspondiente para completar este paso.",
      };
    // A client may already exist when a callback reaches the planner. URL
    // detection only runs when the SDK initializes, so establish it explicitly
    // if that initialization did not consume this particular return.
    if (
      sessionError ||
      sessionData.session?.access_token !== hash.get("access_token")
    ) {
      const established = await auth.setSession({
        access_token: hash.get("access_token")!,
        refresh_token: hash.get("refresh_token")!,
      });
      sessionData = established.data;
      sessionError = established.error;
    }
    if (
      sessionError ||
      !sessionData.session ||
      sessionData.session.access_token !== hash.get("access_token")
    )
      return {
        ok: false,
        message:
          "No pudimos iniciar tu sesión. Vuelve al planificador e inicia sesión con tu correo y contraseña.",
      };
    // Confirm against Auth, rather than trusting URL flags or browser storage.
    const { data, error } = await auth.getUser();
    if (error || !data.user?.email_confirmed_at)
      return {
        ok: false,
        message:
          "No pudimos comprobar el acceso. Vuelve al planificador y solicita otro enlace.",
      };
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "No pudimos conectar con el servicio de cuentas. Revisa tu conexión y vuelve a iniciar sesión.",
    };
  }
}
