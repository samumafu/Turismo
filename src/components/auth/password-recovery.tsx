"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { browserSupabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useEmailLink } from "./use-email-link";

export function PasswordRecovery() {
  const result = useEmailLink("recovery");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result?.ok || busy) return;
    if (password !== repeat) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    const supabase = browserSupabase();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setRepeat("");
      router.replace("/planificar?correo=recuperado");
    } catch (error) {
      setMessage(authErrorMessage(error, "password"));
      setBusy(false);
    }
  }

  return (
    <section className="email-confirmation" aria-labelledby="recovery-title">
      <LockKeyhole aria-hidden="true" className="size-10 text-primary" />
      <h1 id="recovery-title">
        Un nuevo acceso.
        <br />
        El mismo viaje.
      </h1>
      {!result ? (
        <p role="status" className="flex items-center gap-3">
          <LoaderCircle
            aria-hidden="true"
            className="size-4 motion-safe:animate-spin"
          />
          Comprobando tu enlace…
        </p>
      ) : result.ok ? (
        <form onSubmit={submit} className="w-full">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field data-invalid={!!message && password !== repeat}>
              <FieldLabel htmlFor="repeat-password">
                Repite la contraseña
              </FieldLabel>
              <Input
                id="repeat-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                disabled={busy}
                aria-invalid={!!message && password !== repeat}
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
              />
            </Field>
            {message ? (
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar nueva contraseña"}
            </Button>
          </FieldGroup>
        </form>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>No pudimos abrir el enlace</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
      <Button variant="outline" render={<Link href="/planificar" />}>
        Volver al planificador
      </Button>
    </section>
  );
}
