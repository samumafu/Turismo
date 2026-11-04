import type { SupabaseClient } from "@supabase/supabase-js";

export const emailConfirmationPath = "/auth/confirmar";
export const passwordRecoveryPath = "/auth/recuperar";

export type EmailConfirmationResult =
  { ok: true } | { ok: false; message: string };

// Supabase verifies the email before redirecting. Its browser SDK reads the
// session from the URL fragment; no tokens are passed through our server.
export async function completeEmailLink(
  auth: Pick<SupabaseClient["auth"], "getSession" | "getUser">,
  href: string,
  purpose: "signup" | "recovery",
): Promise<EmailConfirmationResult> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  try {
    // Wait for SDK initialization before the caller clears the URL fragment.
    const { data: sessionData, error: sessionError } = await auth.getSession();
    if (
      ["error", "error_code", "error_description"].some(
        (key) => hash.has(key) || url.searchParams.has(key),
      )
    )
      return {
        ok: false,
        message:
          "El enlace venció o ya fue utilizado. Si ya confirmaste tu correo, inicia sesión; si no, solicita otro enlace.",
      };
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
