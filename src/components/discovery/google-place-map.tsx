"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { haversine } from "@/lib/places";
import { PlacePreview } from "./place-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PlaceMapProps } from "./place-map";

let libraries:
  | Promise<{
      maps: google.maps.MapsLibrary;
      markers: google.maps.MarkerLibrary;
    }>
  | undefined;
function loadMaps() {
  if (!libraries) {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      v: "quarterly",
      language: "es",
      region: "CO",
    });
    libraries = Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
    ]).then(([maps, markers]) => ({ maps, markers }));
  }
  return libraries;
}
type Runtime = Awaited<ReturnType<typeof loadMaps>> & { map: google.maps.Map };

export default function GooglePlaceMap({
  places,
  center,
  radius,
  onMove,
  onSelect,
  selectionLabel = "Añadir a mi itinerario",
  selectedIds = [],
  position,
  originLabel = "Tu ubicación",
  onPickOrigin,
  routeCoordinates,
}: PlaceMapProps) {
  const element = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const closeDetail = useRef<HTMLButtonElement>(null);
  const markerNodes = useRef(new Map<string, HTMLSpanElement>());
  const [latitude, longitude] = center;
  const initial = useRef({ latitude, longitude, radius });
  useEffect(() => {
    let active = true;
    let map: google.maps.Map | undefined;
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()) {
      queueMicrotask(() =>
        setError(
          "Falta configurar la clave del mapa de Google. Completa las variables del proyecto y reinicia la aplicación.",
        ),
      );
      return;
    }
    void loadMaps()
      .then((api) => {
        if (!active || !element.current) return;
        map = new api.maps.Map(element.current, {
          center: {
            lat: initial.current.latitude,
            lng: initial.current.longitude,
          },
          zoom: 12,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
          gestureHandling: "cooperative",
          streetViewControl: false,
          mapTypeControl: false,
        });
        setRuntime({ ...api, map });
      })
      .catch(() => {
        if (active)
          setError(
            "No se pudo cargar Google Maps. Comprueba la conexión, la clave del navegador y sus dominios autorizados.",
          );
      });
    return () => {
      active = false;
      if (map) google.maps.event.clearInstanceListeners(map);
    };
  }, []);
  useEffect(() => {
    if (!runtime || !onMove) return;
    const listener = runtime.map.addListener("idle", () => {
      const c = runtime.map.getCenter();
      const corner = runtime.map.getBounds()?.getNorthEast();
      if (c && corner)
        onMove({
          center: [c.lat(), c.lng()],
          radius: Math.max(
            100,
            Math.min(
              25000,
              Math.round(
                haversine([c.lat(), c.lng()], [corner.lat(), corner.lng()]),
              ),
            ),
          ),
        });
    });
    return () => listener.remove();
  }, [runtime, onMove]);
  useEffect(() => {
    if (!runtime || !onPickOrigin) return;
    runtime.map.setOptions({
      draggableCursor: "crosshair",
      clickableIcons: false,
    });
    const listener = runtime.map.addListener(
      "click",
      (event: google.maps.MapMouseEvent) => {
        if (event.latLng)
          onPickOrigin([event.latLng.lat(), event.latLng.lng()]);
      },
    );
    return () => {
      listener.remove();
      runtime.map.setOptions({ draggableCursor: null, clickableIcons: true });
    };
  }, [runtime, onPickOrigin]);
  useEffect(() => {
    if (!runtime) return;
    runtime.map.setCenter({ lat: latitude, lng: longitude });
    runtime.map.setZoom(radius > 15000 ? 10 : radius > 6000 ? 12 : 14);
  }, [runtime, latitude, longitude, radius]);
  useEffect(() => {
    if (!runtime) return;
    const nodes = markerNodes.current;
    const markers = places.map((place, index) => {
      const content = document.createElement("span");
      content.className = "google-place-marker";
      nodes.set(place.id, content);
      content.textContent = String(index + 1);
      content.setAttribute("aria-label", place.name);
      const marker = new runtime.markers.AdvancedMarkerElement({
        map: runtime.map,
        position: { lat: place.coordinates[0], lng: place.coordinates[1] },
        title: place.name,
        content,
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => {
        if (onPickOrigin) onPickOrigin(place.coordinates);
        else setPopup((current) => (current === place.id ? null : place.id));
      });
      return marker;
    });
    return () => {
      nodes.clear();
      for (const marker of markers) {
        google.maps.event.clearInstanceListeners(marker);
        marker.map = null;
      }
    };
  }, [runtime, places, onPickOrigin]);
  useEffect(() => {
    for (const [id, content] of markerNodes.current)
      content.classList.toggle(
        "google-place-marker-selected",
        selectedIds.includes(id),
      );
  }, [runtime, places, selectedIds, onPickOrigin]);
  useEffect(() => {
    if (!runtime) return;
    const overlays: { setMap: (map: google.maps.Map | null) => void }[] = [];
    const points =
      routeCoordinates?.map(([lng, lat]) => ({ lat, lng })) ??
      places.map((p) => ({ lat: p.coordinates[0], lng: p.coordinates[1] }));
    if (routeCoordinates)
      overlays.push(
        new runtime.maps.Polyline({
          map: runtime.map,
          path: points,
          strokeColor: "#17678a",
          strokeWeight: 5,
          strokeOpacity: 0.9,
        }),
      );
    if (position) {
      const point = {
        lat: position.coordinates[0],
        lng: position.coordinates[1],
      };
      points.push(point);
      overlays.push(
        new runtime.maps.Circle({
          map: runtime.map,
          center: point,
          radius: Math.max(position.accuracy, 8),
          strokeColor: "#17678a",
          fillColor: "#17678a",
          fillOpacity: 0.2,
        }),
      );
      const content = document.createElement("span");
      content.className =
        position.accuracy === 0
          ? "google-origin-marker google-origin-pin"
          : "google-origin-marker";
      content.setAttribute("aria-label", originLabel);
      const marker = new runtime.markers.AdvancedMarkerElement({
        map: runtime.map,
        position: point,
        title: originLabel,
        content,
      });
      overlays.push({
        setMap: (map) => {
          marker.map = map;
        },
      });
    }
    if (points.length) {
      const bounds = new google.maps.LatLngBounds();
      for (const point of points) bounds.extend(point);
      runtime.map.fitBounds(bounds, 40);
      const listener = google.maps.event.addListenerOnce(
        runtime.map,
        "idle",
        () => {
          const maxZoom = routeCoordinates ? 18 : 17;
          if ((runtime.map.getZoom() ?? 0) > maxZoom)
            runtime.map.setZoom(maxZoom);
        },
      );
      return () => {
        listener.remove();
        for (const overlay of overlays) overlay.setMap(null);
      };
    }
    return () => {
      for (const overlay of overlays) overlay.setMap(null);
    };
  }, [runtime, places, position, originLabel, routeCoordinates]);
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
      aria-label="Mapa de lugares en Google Maps"
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div ref={element} className="google-map" />
      {onPickOrigin && runtime ? (
        <div className="map-pin-picker" role="status">
          <p>Toca el mapa para colocar tu punto de partida.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const point = runtime.map.getCenter();
              if (point) onPickOrigin([point.lat(), point.lng()]);
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
          Cargando Google Maps…
        </p>
      ) : null}
    </div>
  );
}
