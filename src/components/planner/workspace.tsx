"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Map, List, SlidersHorizontal } from "lucide-react";
import { PlannerProvider, usePlanner } from "./provider";
import { ChatPanel } from "./chat";
import { ItineraryPanel } from "./itinerary";
import { Account } from "./account";
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
  const { state, actions } = usePlanner();
  const [view, setView] = useState("map");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    if (state.action !== "clarify")
      queueMicrotask(() =>
        setView(
          state.action === "plan" && state.itinerary ? "itinerary" : "map",
        ),
      );
  }, [state.action, state.itinerary]);
  return (
    <div className="workspace">
      <div className="workspace-top">
        <div>
          <h1>Planifica tu viaje por Nariño</h1>
          <p>Conversa, descubre lugares y organiza tu recorrido.</p>
        </div>
        <Account />
      </div>
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
            </div>
            <TabsContent value="itinerary">
              <ItineraryPanel />
            </TabsContent>
            <TabsContent value="map">
              {view === "map" ? <JourneyMap /> : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <div className="advanced-search">
        <Button
          variant="outline"
          aria-expanded={advanced}
          aria-controls="advanced-search-panel"
          onClick={() => setAdvanced((v) => !v)}
        >
          <SlidersHorizontal data-icon="inline-start" aria-hidden="true" />
          {advanced ? "Cerrar búsqueda avanzada" : "Búsqueda avanzada"}
        </Button>
        {advanced ? (
          <div id="advanced-search-panel">
            <AdvancedExplorer
              onResults={actions.discover}
              onUseSelection={(ids, search) => {
                actions.selectPlaces(ids, search);
                setAdvanced(false);
                queueMicrotask(() => setView("itinerary"));
                document
                  .getElementById("mi-itinerario")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
export function PlannerWorkspace() {
  return (
    <PlannerProvider>
      <Workspace />
    </PlannerProvider>
  );
}
