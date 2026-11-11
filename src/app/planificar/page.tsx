import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { PlannerWorkspace } from "@/components/planner/workspace";
import { PlannerProvider } from "@/components/planner/provider";
import { Account } from "@/components/planner/account";

export const metadata: Metadata = { title: "Diseña tu viaje" };
export default function PlanPage() {
  return (
    <PlannerProvider>
      <SiteHeader planner>
        <Account />
      </SiteHeader>
      <main id="main" className="planner-page">
        <PlannerWorkspace />
      </main>
      <SiteFooter />
    </PlannerProvider>
  );
}
