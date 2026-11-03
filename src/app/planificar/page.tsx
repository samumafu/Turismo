import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { PlannerWorkspace } from "@/components/planner/workspace";

export const metadata: Metadata = { title: "Diseña tu viaje" };
export default function PlanPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="planner-page">
        <PlannerWorkspace />
      </main>
      <SiteFooter />
    </>
  );
}
