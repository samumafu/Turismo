type AuthOperation = "login" | "register" | "forgot" | "password" | "confirm";

// Fixed messages only: never expose raw provider responses or request data.
export function authErrorMessage(error: unknown, operation: AuthOperation) {
  const value = error && typeof error === "object" ? error : {};
  const code = "code" in value ? String(value.code) : "";
  const status = "status" in value ? Number(value.status) : 0;
  const message = "message" in value ? String(value.message) : "";

  if (code === "invalid_credentials")
    return "El correo o la contraseña no son correctos.";
  if (code === "email_not_confirmed")
    return "Necesitas confirmar el correo. Abre el enlace que recibiste o solicita uno nuevo.";
  if (code === "email_address_not_authorized")
    return "Supabase todavía está usando su correo predeterminado. Activa y guarda Custom SMTP antes de volver a intentarlo.";
  if (
    code === "unexpected_failure" &&
    /error sending (?:confirmation|recovery|email)/i.test(message)
  )
    return "Supabase no pudo enviar el correo por Brevo. Revisa el último Auth Log para comprobar las credenciales SMTP, el remitente y la activación transaccional.";
  if (code === "over_email_send_rate_limit")
    return "Se alcanzó el límite de envío de correos. Espera antes de solicitar otro enlace.";
  if (status === 429 || code === "over_request_rate_limit")
    return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
  if (code === "weak_password")
    return "La contraseña no cumple los requisitos. Usa al menos 8 caracteres y combina letras, números y símbolos.";
  if (code === "email_address_invalid" || code === "validation_failed")
    return "Revisa que el correo sea válido y los datos estén completos.";
  if (code === "user_already_exists" || code === "email_exists")
    return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (code === "signup_disabled" || code === "email_provider_disabled")
    return "El registro con correo está deshabilitado temporalmente.";
  if (code === "captcha_failed")
    return "No se pudo validar el registro. Intenta de nuevo más tarde.";
  if (code === "otp_expired" || code === "otp_disabled")
    return "El enlace no es válido o expiró. Solicita uno nuevo.";
  if (code === "same_password")
    return "Elige una contraseña diferente de la anterior.";
  if (status === 0 || /fetch|network|timeout/i.test(message))
    return "No se pudo conectar con el servicio de cuentas. Revisa tu conexión e inténtalo de nuevo.";
  if (status >= 500)
    return "El servicio de cuentas no está disponible temporalmente. Intenta más tarde.";
  return operation === "login"
    ? "No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo."
    : operation === "confirm"
      ? "No se pudo enviar el enlace de confirmación. Intenta de nuevo más tarde."
      : operation === "password"
        ? "No se pudo cambiar la contraseña. Solicita otro enlace e inténtalo de nuevo."
        : operation === "forgot"
          ? "No se pudo enviar el enlace de recuperación. Intenta de nuevo más tarde."
          : "No se pudo completar el registro. Intenta de nuevo más tarde.";
}
