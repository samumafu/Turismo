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
  const [mobileSection, setMobileSection] = useState("chat");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    function followSectionLink(event?: MouseEvent) {
      const target = event?.target;
      const href =
        target instanceof Element
          ? target.closest("a")?.getAttribute("href")
          : window.location.href;
      if (!href) return;
      const url = new URL(href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname
      )
        return;
      const hash = url.hash;
      if (hash === "#chat-viaje") setMobileSection("chat");
      if (hash === "#mi-itinerario") {
        setMobileSection("map");
        setView("map");
      }
    }
    queueMicrotask(() => followSectionLink());
    document.addEventListener("click", followSectionLink);
    return () => document.removeEventListener("click", followSectionLink);
  }, []);
  useEffect(() => {
    if (!state.results.length) return;
    queueMicrotask(() => {
      setView("map");
      setMobileSection("map");
    });
  }, [state.results]);
  useEffect(() => {
    if (state.origin)
      queueMicrotask(() => {
        setView("map");
        setMobileSection("map");
      });
  }, [state.origin]);
  useEffect(() => {
    if (!state.routeRequest) return;
    queueMicrotask(() => {
      setView("map");
      setMobileSection("map");
      document
        .getElementById("mi-itinerario")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [state.routeRequest]);
  return (
    <div className="workspace" data-mobile-section={mobileSection}>
      <nav
        className="workspace-navigation"
        aria-label="Ir a una sección del planificador"
      >
        <Button
          variant={mobileSection === "chat" ? "secondary" : "ghost"}
          aria-current={mobileSection === "chat" ? "page" : undefined}
          aria-controls="chat-viaje"
          onClick={() => setMobileSection("chat")}
        >
          <MessageCircle data-icon="inline-start" aria-hidden="true" />{" "}
          Conversar
        </Button>
        <Button
          variant={mobileSection === "map" ? "secondary" : "ghost"}
          aria-current={mobileSection === "map" ? "page" : undefined}
          aria-controls="mi-itinerario"
          onClick={() => {
            setMobileSection("map");
            setView("map");
          }}
        >
          <Map data-icon="inline-start" aria-hidden="true" /> Mapa
        </Button>
        <Button
          variant={mobileSection === "itinerary" ? "secondary" : "ghost"}
          aria-current={mobileSection === "itinerary" ? "page" : undefined}
          aria-controls="mi-itinerario"
          onClick={() => {
            setMobileSection("itinerary");
            setView("itinerary");
          }}
        >
          <List data-icon="inline-start" aria-hidden="true" /> Itinerario
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
            </div>
            {advanced ? (
              <div className="advanced-search" id="advanced-search-panel">
                <AdvancedExplorer
                  onComplete={() => {
                    setView("map");
                    setMobileSection("map");
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
                  setMobileSection("itinerary");
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
