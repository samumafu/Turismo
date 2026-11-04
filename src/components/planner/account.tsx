"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut, Save, UserRound } from "lucide-react";
import {
  accountsConfigured,
  browserSupabase,
  passwordRecoveryEnabled,
} from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  completeEmailLink,
  emailConfirmationPath,
  passwordRecoveryPath,
  readEmailReturn,
} from "@/lib/auth-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { journeySnapshotSchema, usePlanner } from "./provider";
import { storedJourney } from "@/lib/journey-storage";

type FormMode = "login" | "register" | "confirm" | "forgot";
const pendingJourneyKey = "turismo-narino:pending-registration";

export function Account() {
  const { state, actions } = usePlanner();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(accountsConfigured);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginFailures, setLoginFailures] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [savedAvailable, setSavedAvailable] = useState(false);
  const [checkedUser, setCheckedUser] = useState<string | null>(null);
  const current = useRef({ state, actions });
  const pendingRestored = useRef(false);
  useEffect(() => {
    current.current = { state, actions };
  }, [state, actions]);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const userId = user?.id;
  const snapshot = useMemo(
    () =>
      storedJourney({
        action: state.action,
        results: state.results,
        places: state.places,
        search: state.search,
        profile: state.profile,
        itinerary: state.itinerary,
        acceptedIds: state.selectedIds,
        mode: state.mode,
      }),
    [
      state.action,
      state.results,
      state.places,
      state.search,
      state.profile,
      state.itinerary,
      state.selectedIds,
      state.mode,
    ],
  );
  const serialized = JSON.stringify(snapshot);
  const hasJourney = !!state.itinerary || state.results.length > 0;

  useEffect(() => {
    void (async () => {
      try {
        const raw = sessionStorage.getItem(pendingJourneyKey);
        if (!raw) return;
        const parsed = journeySnapshotSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          pendingRestored.current = true;
          pendingRestored.current = await current.current.actions.loadJourney(
            parsed.data,
          );
        }
        sessionStorage.removeItem(pendingJourneyKey);
      } catch {
        // Storage can be disabled; the planner still works in memory.
      }
    })();
  }, []);

  useEffect(() => {
    const initialUrl = new URL(window.location.href);
    const incoming = readEmailReturn(initialUrl.href);
    if (incoming.kind === "session" && incoming.purpose === "recovery") {
      window.location.replace(
        passwordRecoveryPath + initialUrl.search + initialUrl.hash,
      );
      return;
    }
    const supabase = browserSupabase();
    let active = true;
    if (!supabase) {
      if (incoming.kind !== "none")
        queueMicrotask(() => {
          if (!active) return;
          setOpen(true);
          setMessage(
            "No se pudo conectar con las cuentas en este sitio. Revisa la configuración de Supabase.",
          );
        });
      return () => {
        active = false;
      };
    }
    void (async () => {
      const completed =
        incoming.kind === "session"
          ? await completeEmailLink(supabase.auth, initialUrl.href, "signup")
          : null;
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setAuthLoading(false);
      const url = new URL(window.location.href);
      if (incoming.kind !== "none") {
        url.hash = "";
        for (const key of ["error", "error_code", "error_description"])
          url.searchParams.delete(key);
        window.history.replaceState(
          window.history.state,
          "",
          url.pathname + url.search,
        );
      }
      if (incoming.kind === "error") {
        setOpen(true);
        setMessage(incoming.message);
      } else if (completed && !completed.ok) {
        setOpen(true);
        setMessage(completed.message);
      } else if (completed?.ok && nextUser) {
        setMessage("Correo confirmado. Tu cuenta ya está lista.");
      } else if (error) {
        setOpen(true);
        setMessage(authErrorMessage(error, "login"));
      }
      if (nextUser?.email_confirmed_at && url.searchParams.has("correo")) {
        setMessage(
          url.searchParams.get("correo") === "recuperado"
            ? "Contraseña actualizada. Ya puedes continuar tu viaje."
            : "Correo confirmado. Tu cuenta ya está lista.",
        );
        url.searchParams.delete("correo");
        window.history.replaceState(
          window.history.state,
          "",
          url.pathname + url.search + url.hash,
        );
      }
      if (!nextUser && url.searchParams.get("cuenta") === "confirmar") {
        setOpen(true);
        setMode("confirm");
        url.searchParams.delete("cuenta");
        window.history.replaceState(
          window.history.state,
          "",
          url.pathname + url.search + url.hash,
        );
      }
    })().catch(() => {
      if (!active) return;
      setAuthLoading(false);
      setOpen(true);
      setMessage(
        "No pudimos conectar con el servicio de cuentas. Revisa tu conexión y vuelve a intentar.",
      );
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN") {
        setPassword("");
        setMode("login");
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = browserSupabase();
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("saved_journeys")
        .select("journey")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      setCheckedUser(userId);
      if (error) {
        setMessage(
          "No se pudo consultar tu viaje guardado. Revisa la conexión y la configuración de Supabase.",
        );
        return;
      }
      const parsed = journeySnapshotSchema.safeParse(data?.journey);
      if (data && !parsed.success) {
        setMessage(
          "El viaje guardado no se pudo interpretar. El viaje actual sigue abierto.",
        );
        return;
      }
      setSavedAvailable(parsed.success);
      const existing = current.current.state;
      const hasOpenJourney =
        pendingRestored.current ||
        !!existing.itinerary ||
        existing.results.length > 0;
      pendingRestored.current = false;
      if (parsed.success && !hasOpenJourney) {
        if (await current.current.actions.loadJourney(parsed.data)) {
          setSyncEnabled(true);
          setMessage("Tu viaje guardado está listo.");
        } else setMessage("No se pudo cargar el viaje guardado.");
      } else if (parsed.success) {
        setMessage(
          "Tienes un viaje guardado. Puedes abrirlo o guardar el actual.",
        );
      } else {
        setSyncEnabled(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  function saveJourney(data: string, userId: string) {
    writeQueue.current = writeQueue.current
      .catch(() => {})
      .then(async () => {
        const supabase = browserSupabase();
        if (!supabase)
          throw new Error("El servicio de cuentas no está configurado.");
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user.id !== userId) return;
        const { error } = await supabase.from("saved_journeys").upsert({
          user_id: userId,
          journey: JSON.parse(data),
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setSavedAvailable(true);
        setMessage("Viaje guardado en tu cuenta.");
      })
      .catch(() => {
        setMessage("No se pudo guardar el viaje. Vuelve a intentarlo.");
      });
    return writeQueue.current;
  }

  useEffect(() => {
    if (!user || checkedUser !== user.id || !syncEnabled || !hasJourney) return;
    const timer = setTimeout(() => void saveJourney(serialized, user.id), 1200);
    return () => clearTimeout(timer);
  }, [user, checkedUser, syncEnabled, hasJourney, serialized]);

  async function loadSaved() {
    const supabase = browserSupabase();
    if (!supabase || !user) return;
    setBusy(true);
    setSyncEnabled(false);
    await writeQueue.current;
    const { data, error } = await supabase
      .from("saved_journeys")
      .select("journey")
      .eq("user_id", user.id)
      .maybeSingle();
    const parsed = journeySnapshotSchema.safeParse(data?.journey);
    if (error || !parsed.success || !(await actions.loadJourney(parsed.data)))
      setMessage("No se pudo abrir el viaje guardado.");
    else {
      setSyncEnabled(true);
      setMessage("Viaje guardado abierto.");
    }
    setBusy(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = browserSupabase();
    if (!supabase) {
      setMessage("Configura Supabase para activar las cuentas.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const emailRedirectTo = new URL(
        emailConfirmationPath,
        window.location.origin,
      ).href;
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.code === "invalid_credentials")
            setLoginFailures((count) => count + 1);
          if (error.code === "email_not_confirmed") setMode("confirm");
          throw error;
        }
        setLoginFailures(0);
        setPassword("");
        setOpen(false);
      } else if (mode === "register") {
        if (hasJourney) {
          try {
            sessionStorage.setItem(pendingJourneyKey, serialized);
          } catch {
            /* Optional tab-scoped handoff. */
          }
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        if (data.session) {
          try {
            sessionStorage.removeItem(pendingJourneyKey);
          } catch {
            /* Storage may be unavailable. */
          }
        }
        setPassword("");
        setMessage(
          data.session
            ? "Tu cuenta está lista."
            : "Abre el correo y pulsa «Confirmar mi correo». Volverás al planificador con tu cuenta confirmada.",
        );
        if (!data.session) setMode("confirm");
      } else if (mode === "confirm") {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo },
        });
        if (error) throw error;
        setMessage(
          "Si tu cuenta requiere confirmación, recibirás un enlace nuevo. Revisa también correo no deseado.",
        );
      } else if (mode === "forgot") {
        if (!passwordRecoveryEnabled) {
          setMessage(
            "La recuperación de contraseña estará disponible próximamente.",
          );
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: new URL(passwordRecoveryPath, window.location.origin)
              .href,
          },
        );
        if (error) throw error;
        setMessage(
          "Si existe una cuenta, recibirás un enlace para elegir una contraseña nueva.",
        );
      }
    } catch (error) {
      if (mode === "register") {
        try {
          sessionStorage.removeItem(pendingJourneyKey);
        } catch {
          /* Storage may be unavailable. */
        }
      }
      setMessage(authErrorMessage(error, mode));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await writeQueue.current;
    const { error } = await browserSupabase()!.auth.signOut();
    if (error) setMessage("No se pudo cerrar la sesión.");
    else {
      setSyncEnabled(false);
      setSavedAvailable(false);
      setCheckedUser(null);
      actions.reset();
      setMessage("");
    }
    setBusy(false);
  }

  return (
    <div className="account-area">
      <Button
        variant="outline"
        disabled={authLoading}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="account-panel"
      >
        <UserRound data-icon="inline-start" aria-hidden="true" />{" "}
        {authLoading
          ? "Comprobando sesión…"
          : user
            ? "Mi cuenta"
            : "Iniciar sesión"}
      </Button>
      {open ? (
        <section
          id="account-panel"
          className="account-panel"
          aria-label="Cuenta"
        >
          {user ? (
            <>
              <h2>Tu cuenta</h2>
              <p className="account-email">{user.email}</p>
              <div className="account-actions">
                <Button
                  disabled={busy || !hasJourney}
                  onClick={() => {
                    setSyncEnabled(true);
                    void saveJourney(serialized, user.id);
                  }}
                >
                  <Save data-icon="inline-start" /> Guardar viaje actual
                </Button>
                {savedAvailable ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void loadSaved()}
                  >
                    Abrir viaje guardado
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  disabled={busy || state.busy}
                  onClick={() => void signOut()}
                >
                  <LogOut data-icon="inline-start" /> Cerrar sesión
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2>
                {mode === "register"
                  ? "Crea tu cuenta"
                  : mode === "confirm"
                    ? "Verifica tu correo"
                    : mode === "forgot"
                      ? "Recupera tu acceso"
                      : "Qué bueno verte de nuevo"}
              </h2>
              <p>
                {mode === "confirm"
                  ? "Pulsa el botón del correo para confirmar tu cuenta. Desde aquí puedes solicitar otro enlace."
                  : mode === "forgot"
                    ? "Te enviaremos un enlace para crear una contraseña nueva."
                    : "Guarda tu viaje y retómalo cuando quieras."}
              </p>
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="account-email">
                      Correo electrónico
                    </FieldLabel>
                    <Input
                      id="account-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      disabled={busy}
                      maxLength={254}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  {mode !== "forgot" && mode !== "confirm" ? (
                    <Field>
                      <FieldLabel htmlFor="account-password">
                        Contraseña
                      </FieldLabel>
                      <Input
                        id="account-password"
                        name="password"
                        type="password"
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        minLength={mode === "login" ? 1 : 8}
                        disabled={busy}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>
                  ) : null}
                  <Button type="submit" disabled={busy}>
                    <LogIn data-icon="inline-start" />
                    {busy
                      ? "Un momento…"
                      : mode === "register"
                        ? "Crear cuenta"
                        : mode === "confirm"
                          ? "Reenviar enlace de confirmación"
                          : mode === "forgot"
                            ? "Enviar enlace de recuperación"
                            : "Iniciar sesión"}
                  </Button>
                </FieldGroup>
              </form>
              <div className="account-links">
                {mode === "login" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMode("confirm");
                        setPassword("");
                        setMessage("");
                      }}
                    >
                      Confirmar mi correo
                    </button>
                    {loginFailures >= 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!passwordRecoveryEnabled) {
                            setMessage(
                              "La recuperación de contraseña estará disponible próximamente.",
                            );
                            return;
                          }
                          setMode("forgot");
                          setMessage("");
                        }}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setMessage("");
                      }}
                    >
                      ¿Aún no tienes cuenta? Regístrate
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setMessage("");
                      }}
                    >
                      Volver a iniciar sesión
                    </button>
                  </>
                )}
              </div>
              <Button variant="outline" disabled className="account-google">
                Continuar con Google · Próximamente
              </Button>
            </>
          )}
          {message ? (
            <p className="account-message" role="status">
              {message}
            </p>
          ) : null}
          {!accountsConfigured ? (
            <p className="account-message">
              Las cuentas aún no están configuradas. Puedes seguir explorando
              sin iniciar sesión.
            </p>
          ) : null}
        </section>
      ) : message && user ? (
        <p className="account-status" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
