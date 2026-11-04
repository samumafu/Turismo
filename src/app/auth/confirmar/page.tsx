import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { EmailConfirmation } from "@/components/auth/email-confirmation";

export const metadata: Metadata = {
  title: "Confirmar correo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmEmailPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="email-confirmation-page">
        <EmailConfirmation />
      </main>
      <SiteFooter />
    </>
  );
}
