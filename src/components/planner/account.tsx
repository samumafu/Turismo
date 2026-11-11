"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  LogIn,
  LogOut,
  Save,
  UserRound,
  Eye,
  EyeOff,
  MailCheck,
  LockKeyhole,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
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
import { usePlanner } from "./provider";
import { storedJourney, readStoredJourney } from "@/lib/journey-storage";

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
  const [showPassword, setShowPassword] = useState(false);
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
        const parsed = readStoredJourney(JSON.parse(raw));
        if (parsed) {
          pendingRestored.current = true;
          pendingRestored.current = await current.current.actions.loadJourney(
            parsed.snapshot,
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
      const parsed = readStoredJourney(data?.journey);
      if (data && !parsed) {
        setMessage(
          "No se pudo recuperar el recorrido guardado. Puedes guardar el actual desde tu cuenta.",
        );
        return;
      }
      setSavedAvailable(!!parsed);
      const existing = current.current.state;
      const hasOpenJourney =
        pendingRestored.current ||
        !!existing.itinerary ||
        existing.results.length > 0;
      pendingRestored.current = false;
      if (parsed && !hasOpenJourney) {
        if (await current.current.actions.loadJourney(parsed.snapshot)) {
          setSyncEnabled(true);
          setMessage(
            parsed.legacyVisits
              ? "Recuperamos tus preferencias. Elige de nuevo las visitas del mapa anterior para continuar con Google Maps."
              : "Tu viaje guardado está listo.",
          );
        } else setMessage("No se pudo cargar el viaje guardado.");
      } else if (parsed) {
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
    const parsed = readStoredJourney(data?.journey);
    if (error || !parsed || !(await actions.loadJourney(parsed.snapshot)))
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
          if (error.code === "email_not_confirmed") setMode("confirm");
          throw error;
        }
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
            : "Te enviamos un correo de verificación. Abre Gmail o tu servicio de correo y sigue las instrucciones para activar tu cuenta.",
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={user ? "secondary" : "default"}
            disabled={authLoading}
          />
        }
      >
        {authLoading ? (
          <LoaderCircle
            data-icon="inline-start"
            className="animate-spin"
            aria-hidden="true"
          />
        ) : (
          <UserRound data-icon="inline-start" aria-hidden="true" />
        )}
        {authLoading ? "Conectando…" : user ? "Mi cuenta" : "Iniciar sesión"}
      </DialogTrigger>
      <DialogContent className="account-dialog">
        <DialogHeader>
          <div className="account-symbol">
            {user ? (
              <UserRound aria-hidden="true" />
            ) : mode === "confirm" ? (
              <MailCheck aria-hidden="true" />
            ) : (
              <LockKeyhole aria-hidden="true" />
            )}
          </div>
          <DialogTitle>
            {user
              ? "Tu espacio de viaje"
              : mode === "register"
                ? "Crea tu cuenta"
                : mode === "confirm"
                  ? "Revisa tu correo"
                  : mode === "forgot"
                    ? "Recupera tu acceso"
                    : "Inicia sesión"}
          </DialogTitle>
          <DialogDescription>
            {user
              ? user.email
              : mode === "confirm"
                ? `Abre Gmail o tu servicio de correo y sigue las instrucciones de verificación${email ? " que enviamos a " + email : ""}. Revisa también la carpeta de spam.`
                : mode === "forgot"
                  ? "Te enviaremos un enlace para elegir una contraseña nueva."
                  : "Guarda tus lugares y retoma tu recorrido cuando quieras."}
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <div className="account-actions">
            <Button
              disabled={busy || !hasJourney}
              onClick={async () => {
                setBusy(true);
                setSyncEnabled(true);
                await saveJourney(serialized, user.id);
                setBusy(false);
              }}
            >
              <Save data-icon="inline-start" aria-hidden="true" />
              Guardar recorrido actual
            </Button>
            {savedAvailable ? (
              <Button
                variant="outline"
                disabled={busy || state.busy}
                onClick={() => void loadSaved()}
              >
                Abrir recorrido guardado
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={busy || state.busy}
              onClick={() => void signOut()}
            >
              <LogOut data-icon="inline-start" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        ) : (
          <>
            {mode !== "confirm" ? (
              <form onSubmit={submit} className="account-form">
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
                      inputMode="email"
                      placeholder="tu@correo.com"
                      disabled={busy}
                      maxLength={254}
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </Field>
                  {mode !== "forgot" ? (
                    <Field>
                      <div className="password-label">
                        <FieldLabel htmlFor="account-password">
                          Contraseña
                        </FieldLabel>
                        {mode === "login" && passwordRecoveryEnabled ? (
                          <button
                            type="button"
                            className="text-action"
                            disabled={busy}
                            onClick={() => {
                              setMode("forgot");
                              setPassword("");
                              setMessage("");
                            }}
                          >
                            ¿La olvidaste?
                          </button>
                        ) : null}
                      </div>
                      <InputGroup>
                        <InputGroupInput
                          id="account-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={
                            mode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          minLength={mode === "login" ? 1 : 8}
                          disabled={busy}
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={
                            mode === "register"
                              ? "Al menos 8 caracteres"
                              : "Tu contraseña"
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={
                              showPassword
                                ? "Ocultar contraseña"
                                : "Mostrar contraseña"
                            }
                            onClick={() => setShowPassword((value) => !value)}
                          >
                            {showPassword ? (
                              <EyeOff aria-hidden="true" />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}
                          </Button>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                  ) : null}
                  <Button type="submit" disabled={busy}>
                    {busy ? (
                      <LoaderCircle
                        data-icon="inline-start"
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <LogIn data-icon="inline-start" aria-hidden="true" />
                    )}
                    {busy
                      ? "Un momento…"
                      : mode === "register"
                        ? "Crear cuenta"
                        : mode === "forgot"
                          ? "Enviar enlace"
                          : "Iniciar sesión"}
                  </Button>
                </FieldGroup>
              </form>
            ) : email ? (
              <form onSubmit={submit}>
                <Button type="submit" variant="outline" disabled={busy}>
                  {busy ? "Enviando…" : "Reenviar correo"}
                </Button>
              </form>
            ) : null}
            <div className="account-switch">
              {mode === "login" ? (
                <>
                  <span>¿Es tu primera visita?</span>
                  <button
                    type="button"
                    className="text-action"
                    disabled={busy}
                    onClick={() => {
                      setMode("register");
                      setMessage("");
                    }}
                  >
                    Crear una cuenta <ArrowRight aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-action"
                  disabled={busy}
                  onClick={() => {
                    setMode("login");
                    setPassword("");
                    setMessage("");
                  }}
                >
                  Volver a iniciar sesión
                </button>
              )}
            </div>
          </>
        )}
        {message ? (
          <p className="account-message" role="status">
            {message}
          </p>
        ) : null}
        {!accountsConfigured ? (
          <p className="account-message">
            Las cuentas aún no están configuradas. Puedes explorar sin iniciar
            sesión.
          </p>
        ) : null}
        {!user ? (
          <p className="account-footnote">
            Puedes seguir explorando sin cuenta.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
