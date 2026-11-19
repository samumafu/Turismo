"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haversine } from "@/lib/places";
import { PlacePreview } from "./place-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PlaceMapProps } from "./place-map";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function OsmPlaceMap({
  places,
  center,
  radius,
  onMove,
  onSelect,
  selectionLabel = "Añadir a mi itinerario",
  selectedIds = [],
  position,
  originLabel = "Tu ubicación",
  fitPosition = true,
  onPickOrigin,
  routeCoordinates,
}: PlaceMapProps) {
  const element = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<L.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const closeDetail = useRef<HTMLButtonElement>(null);

  const [latitude, longitude] = center;
  const initial = useRef({ latitude, longitude, radius });
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { scrollWheelZoom: false }).setView(
      [initial.current.latitude, initial.current.longitude],
      12,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
      .on("tileerror", () =>
        setError(
          "No se pudo cargar una parte del mapa. Comprueba la conexión.",
        ),
      )
      .on("tileload", () => setError(null))
      .addTo(map);
    map.zoomControl
      .getContainer()
      ?.querySelector(".leaflet-control-zoom-in")
      ?.setAttribute("aria-label", "Acercar");
    map.zoomControl
      .getContainer()
      ?.querySelector(".leaflet-control-zoom-out")
      ?.setAttribute("aria-label", "Alejar");
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(element.current);
    queueMicrotask(() => setRuntime(map));
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, []);
  useEffect(() => {
    if (!runtime) return;
    runtime.setView(
      [latitude, longitude],
      radius > 15000 ? 10 : radius > 6000 ? 12 : 14,
    );
  }, [runtime, latitude, longitude, radius]);
  useEffect(() => {
    if (!runtime || !onMove) return;
    function report() {
      if (!runtime || !onMove) return;
      const c = runtime.getCenter(),
        corner = runtime.getBounds().getNorthEast();
      onMove({
        center: [c.lat, c.lng],
        radius: Math.max(
          100,
          Math.min(
            25000,
            Math.round(haversine([c.lat, c.lng], [corner.lat, corner.lng])),
          ),
        ),
      });
    }
    report();
    runtime.on("moveend", report);
    return () => {
      runtime.off("moveend", report);
    };
  }, [runtime, onMove]);
  useEffect(() => {
    if (!runtime || !onPickOrigin) return;
    const click = (e: L.LeafletMouseEvent) =>
      onPickOrigin([e.latlng.lat, e.latlng.lng]);
    runtime.on("click", click);
    return () => {
      runtime.off("click", click);
    };
  }, [runtime, onPickOrigin]);
  useEffect(() => {
    if (!runtime) return;
    const layer = L.layerGroup().addTo(runtime);
    places.forEach((place, i) => {
      const marker = L.marker(place.coordinates, {
        title: place.name,
        alt: place.name,
        icon: L.divIcon({
          className: "place-marker-anchor",
          html:
            '<span class="place-marker-number' +
            (selectedIds.includes(place.id) ? " place-marker-selected" : "") +
            '">' +
            (i + 1) +
            "</span>",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      }).addTo(layer);
      marker.on("click", () =>
        onPickOrigin ? onPickOrigin(place.coordinates) : setPopup(place.id),
      );
    });
    return () => {
      layer.remove();
    };
  }, [places, runtime, onPickOrigin, selectedIds]);
  useEffect(() => {
    if (!runtime) return;
    const layer = L.layerGroup().addTo(runtime);
    const points: L.LatLngTuple[] =
      routeCoordinates?.map(([lon, lat]) => [lat, lon]) ??
      places.map((p) => p.coordinates);
    if (routeCoordinates?.length)
      L.polyline(points, { color: "#17678a", weight: 5 }).addTo(layer);
    if (position) {
      L.circle(position.coordinates, {
        radius: Math.max(8, position.accuracy),
        interactive: false,
      }).addTo(layer);
      const label = document.createElement("span");
      label.textContent = originLabel;
      L.circleMarker(position.coordinates, {
        radius: 8,
        color: "white",
        fillColor: "#17678a",
        fillOpacity: 1,
      })
        .bindTooltip(label)
        .addTo(layer);
      if (fitPosition) points.push(position.coordinates);
    }
    if (points.length)
      runtime.fitBounds(L.latLngBounds(points), {
        padding: [30, 30],
        maxZoom: 17,
      });
    return () => {
      layer.remove();
    };
  }, [runtime, places, position, originLabel, routeCoordinates, fitPosition]);
  const activePlace = places.find((place) => place.id === popup);
  useEffect(() => {
    if (popup)
      queueMicrotask(() => closeDetail.current?.focus({ preventScroll: true }));
  }, [popup]);
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape") setPopup(null);
      }}
      className="discovery-map"
      role="region"
      aria-label="Mapa de lugares en OpenStreetMap"
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div ref={element} className="google-map" style={{ zIndex: 0 }} />
      {onPickOrigin && runtime ? (
        <div className="map-pin-picker" role="status">
          <p>Toca el mapa para colocar tu punto de partida.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const point = runtime.getCenter();
              if (point) onPickOrigin([point.lat, point.lng]);
            }}
          >
            Usar el centro del mapa
          </Button>
        </div>
      ) : null}
      {activePlace && !onPickOrigin ? (
        <aside
          className="map-place-detail"
          aria-label={"Ficha de " + activePlace.name}
        >
          <Button
            ref={closeDetail}
            className="map-detail-close"
            size="icon-sm"
            variant="secondary"
            aria-label="Cerrar ficha del lugar"
            onClick={() => setPopup(null)}
          >
            <X aria-hidden="true" />
          </Button>
          <div className="map-detail-scroll">
            <PlacePreview
              place={activePlace}
              selected={selectedIds.includes(activePlace.id)}
              onSelect={onSelect}
              selectionLabel={selectionLabel}
            />
          </div>
        </aside>
      ) : null}
      {!runtime && !error ? (
        <p role="status" className="map-note">
          Cargando OpenStreetMap…
        </p>
      ) : null}
    </div>
  );
}
