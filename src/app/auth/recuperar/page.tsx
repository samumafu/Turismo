import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { PasswordRecovery } from "@/components/auth/password-recovery";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RecoverPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="email-confirmation-page">
        <PasswordRecovery />
      </main>
      <SiteFooter />
    </>
  );
}
