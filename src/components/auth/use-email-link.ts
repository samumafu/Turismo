"use client";

import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase";
import {
  completeEmailLink,
  type EmailConfirmationResult,
} from "@/lib/auth-links";

export function useEmailLink(purpose: "signup" | "recovery") {
  const attempt = useRef<Promise<EmailConfirmationResult> | null>(null);
  const [result, setResult] = useState<EmailConfirmationResult | null>(null);

  useEffect(() => {
    let active = true;
    if (!attempt.current) {
      const href = window.location.href;
      const supabase = browserSupabase();
      attempt.current = (
        supabase
          ? completeEmailLink(supabase.auth, href, purpose)
          : Promise.resolve<EmailConfirmationResult>({
              ok: false,
              message:
                "El servicio de cuentas no está configurado. Puedes seguir usando el planificador como invitado.",
            })
      ).finally(() => {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname,
        );
      });
    }
    void attempt.current.then((value) => {
      if (active) setResult(value);
    });
    return () => {
      active = false;
    };
  }, [purpose]);

  return result;
}
