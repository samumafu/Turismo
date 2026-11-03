"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut, Save, UserRound } from "lucide-react";
import { accountsConfigured, browserSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { journeySnapshotSchema, usePlanner } from "./provider";

type FormMode = "login" | "register" | "forgot" | "code";
const pendingJourneyKey = "turismo-narino:pending-registration";

export function Account() {
  const { state, actions } = usePlanner();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
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
    () => ({
      action: state.action,
      results: state.results,
      places: state.places,
      search: state.search,
      profile: state.profile,
      itinerary: state.itinerary,
      mode: state.mode,
    }),
    [
      state.action,
      state.results,
      state.places,
      state.search,
      state.profile,
      state.itinerary,
      state.mode,
    ],
  );
  const serialized = JSON.stringify(snapshot);
  const hasJourney = !!state.itinerary || state.results.length > 0;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(pendingJourneyKey);
      if (!raw) return;
      const parsed = journeySnapshotSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        pendingRestored.current = current.current.actions.loadJourney(
          parsed.data,
        );
      }
      sessionStorage.removeItem(pendingJourneyKey);
    } catch {
      // Storage can be disabled; the planner still works in memory.
    }
  }, []);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
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
      setSavedAvailable(parsed.success);
      const existing = current.current.state;
      const hasOpenJourney =
        pendingRestored.current ||
        !!existing.itinerary ||
        existing.results.length > 0;
      pendingRestored.current = false;
      if (parsed.success && !hasOpenJourney) {
        if (current.current.actions.loadJourney(parsed.data)) {
          setSyncEnabled(true);
          setMessage("Tu viaje guardado está listo.");
        } else setMessage("No se pudo cargar el viaje guardado.");
      } else if (parsed.success) {
        setMessage(
          "Tienes un viaje guardado. Puedes abrirlo o guardar el actual.",
        );
      } else if (!hasOpenJourney) {
        setSyncEnabled(true);
      } else {
        setMessage("Guarda el viaje actual para conservarlo en tu cuenta.");
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
    if (error || !parsed.success || !actions.loadJourney(parsed.data))
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
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
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
            : "Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.",
        );
        if (!data.session) setMode("login");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
        );
        if (error) throw error;
        setMode("code");
        setMessage(
          "Si existe una cuenta, recibirás un código de recuperación.",
        );
      } else {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: "recovery",
        });
        if (error) throw error;
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;
        setPassword("");
        setCode("");
        setMode("login");
        setMessage("Contraseña actualizada.");
      }
    } catch {
      if (mode === "register") {
        try {
          sessionStorage.removeItem(pendingJourneyKey);
        } catch {
          /* Storage may be unavailable. */
        }
      }
      setMessage(
        mode === "login"
          ? "No se pudo iniciar sesión. Comprueba tus datos y la confirmación del correo."
          : mode === "code"
            ? "No se pudo cambiar la contraseña. Comprueba el código o solicita otro."
            : "No se pudo completar la solicitud. Revisa tus datos e inténtalo de nuevo.",
      );
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
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="account-panel"
      >
        <UserRound data-icon="inline-start" aria-hidden="true" />{" "}
        {user ? "Mi cuenta" : "Iniciar sesión"}
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
                  : mode === "forgot" || mode === "code"
                    ? "Recupera tu acceso"
                    : "Qué bueno verte de nuevo"}
              </h2>
              <p>Guarda tu viaje y retómalo cuando quieras.</p>
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
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  {mode === "code" ? (
                    <Field>
                      <FieldLabel htmlFor="account-code">
                        Código recibido
                      </FieldLabel>
                      <Input
                        id="account-code"
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </Field>
                  ) : null}
                  {mode !== "forgot" ? (
                    <Field>
                      <FieldLabel htmlFor="account-password">
                        {mode === "code" ? "Nueva contraseña" : "Contraseña"}
                      </FieldLabel>
                      <Input
                        id="account-password"
                        name="password"
                        type="password"
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        minLength={mode === "login" ? 1 : 8}
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
                        : mode === "forgot"
                          ? "Enviar código"
                          : mode === "code"
                            ? "Cambiar contraseña"
                            : "Iniciar sesión"}
                  </Button>
                </FieldGroup>
              </form>
              <div className="account-links">
                {mode === "login" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setMessage("");
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
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
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setMessage("");
                    }}
                  >
                    Volver a iniciar sesión
                  </button>
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
