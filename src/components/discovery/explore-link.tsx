"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { searchSpecSchema, type SearchSpec } from "@/lib/places";
import { useOptionalPlanner } from "@/components/planner/provider";

export function ExploreLink({
  zone,
  category,
  children,
}: {
  zone: SearchSpec["zone"];
  category: SearchSpec["categories"][number];
  children: ReactNode;
}) {
  const planner = useOptionalPlanner();
  return (
    <Link
      href={`/planificar?zona=${zone}&categoria=${category}`}
      aria-disabled={planner?.state.busy || undefined}
      onClick={(event) => {
        if (
          !planner ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        if (planner.state.busy) return;
        void planner.actions
          .searchPlaces(
            searchSpecSchema.parse({ zone, categories: [category] }),
          )
          .then(() =>
            document
              .getElementById("mi-itinerario")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          );
      }}
    >
      {children}
    </Link>
  );
}
