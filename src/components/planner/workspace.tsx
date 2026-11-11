"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Map, List, MessageCircle, SlidersHorizontal } from "lucide-react";
import { usePlanner } from "./provider";
import { ChatPanel } from "./chat";
import { ItineraryPanel } from "./itinerary";
import { PlaceOptions } from "./place-options";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
const AdvancedExplorer = dynamic(
  () =>
    import("@/components/discovery/explorer").then((m) => m.DiscoveryExplorer),
  { loading: () => <Skeleton className="h-48 w-full" /> },
);

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[500px] w-full" />,
});
function Workspace() {
  const { state } = usePlanner();
  const [view, setView] = useState("map");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setView("map"));
  }, [state.results]);
  useEffect(() => {
    if (state.origin && !state.origin.confirmed)
      queueMicrotask(() => setView("map"));
  }, [state.origin]);
  useEffect(() => {
    if (!state.routeRequest) return;
    queueMicrotask(() => {
      setView("map");
      document
        .getElementById("mi-itinerario")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [state.routeRequest]);
  return (
    <div className="workspace">
      <nav
        className="workspace-navigation"
        aria-label="Ir a una sección del planificador"
      >
        <Button variant="outline" render={<a href="#chat-viaje" />}>
          <MessageCircle aria-hidden="true" /> Conversar
        </Button>
        <Button variant="outline" render={<a href="#mi-itinerario" />}>
          <Map aria-hidden="true" /> Ver mapa
          {state.results.length ? ` (${state.results.length})` : ""}
        </Button>
      </nav>
      <div className="planner-layout">
        <ChatPanel />
        <div className="journey-panel" id="mi-itinerario">
          <Tabs value={view} onValueChange={(value) => setView(String(value))}>
            <div className="journey-toolbar">
              <TabsList variant="line" aria-label="Ver tu viaje">
                <TabsTrigger value="map">
                  <Map data-icon="inline-start" aria-hidden="true" /> Mapa
                </TabsTrigger>
                <TabsTrigger value="itinerary">
                  <List data-icon="inline-start" aria-hidden="true" />{" "}
                  Itinerario
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                aria-expanded={advanced}
                aria-controls="advanced-search-panel"
                onClick={() => setAdvanced((value) => !value)}
              >
                <SlidersHorizontal
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                {advanced ? "Cerrar filtros" : "Filtros de búsqueda"}
              </Button>
              <a className="mobile-chat-link" href="#chat-viaje">
                Volver al chat
              </a>
            </div>
            {advanced ? (
              <div className="advanced-search" id="advanced-search-panel">
                <AdvancedExplorer
                  onComplete={() => {
                    setView("map");
                    setAdvanced(false);
                    document
                      .getElementById("mi-itinerario")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              </div>
            ) : null}
            <TabsContent value="itinerary">
              <ItineraryPanel />
            </TabsContent>
            <TabsContent value="map" keepMounted>
              <JourneyMap />
              <PlaceOptions
                onViewItinerary={() => {
                  setView("itinerary");
                  document
                    .getElementById("mi-itinerario")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
export function PlannerWorkspace() {
  return <Workspace />;
}
