"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MailCheck } from "lucide-react";
import { useEmailLink } from "./use-email-link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function EmailConfirmation() {
  const router = useRouter();
  const result = useEmailLink("signup");

  useEffect(() => {
    if (result?.ok) router.replace("/planificar?correo=confirmado");
  }, [result, router]);

  return (
    <section
      className="email-confirmation"
      aria-labelledby="confirmation-title"
    >
      <MailCheck aria-hidden="true" className="size-10 text-primary" />
      <h1 id="confirmation-title">
        Confirma tu correo.
        <br />
        Continúa tu viaje.
      </h1>
      {result && !result.ok ? (
        <>
          <Alert variant="destructive">
            <AlertTitle>No pudimos completar el acceso</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
          <Button render={<Link href="/planificar?cuenta=confirmar" />}>
            Volver a mi cuenta
          </Button>
        </>
      ) : (
        <p role="status" className="flex items-center gap-3">
          <LoaderCircle
            aria-hidden="true"
            className="size-4 motion-safe:animate-spin"
          />
          Comprobando tu acceso y abriendo el planificador…
        </p>
      )}
      <p>Explora Nariño a tu ritmo.</p>
    </section>
  );
}
