"use client";
import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { haversine, mapsLink } from "@/lib/places";
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
  routeCoordinates,
}: PlaceMapProps) {
  const element = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [error, setError] = useState<string | null>(null);
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
            500,
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
    if (!runtime) return;
    runtime.map.setCenter({ lat: latitude, lng: longitude });
    runtime.map.setZoom(radius > 15000 ? 10 : radius > 6000 ? 12 : 14);
  }, [runtime, latitude, longitude, radius]);
  useEffect(() => {
    if (!runtime) return;
    const info = new runtime.maps.InfoWindow();
    const markers = places.map((place, index) => {
      const content = document.createElement("button");
      content.type = "button";
      content.className =
        "google-place-marker" +
        (selectedIds.includes(place.id) ? " google-place-marker-selected" : "");
      content.textContent = String(index + 1);
      content.setAttribute("aria-label", place.name);
      const marker = new runtime.markers.AdvancedMarkerElement({
        map: runtime.map,
        position: { lat: place.coordinates[0], lng: place.coordinates[1] },
        title: place.name,
        content,
      });
      marker.addListener("click", () => {
        const popup = document.createElement("div");
        popup.className = "google-place-popup";
        const heading = document.createElement("strong");
        heading.textContent = place.name;
        popup.append(heading);
        const category = document.createElement("p");
        category.textContent = place.category;
        popup.append(category);
        const link = document.createElement("a");
        link.href = mapsLink(place);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Ver en Google Maps";
        popup.append(link);
        if (onSelect && place.availability !== "restringido") {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "map-pick-button";
          button.textContent = selectedIds.includes(place.id)
            ? "Quitar de mi itinerario"
            : selectionLabel;
          button.addEventListener("click", () => onSelect(place.id));
          popup.append(button);
        }
        info.setContent(popup);
        info.open({ map: runtime.map, anchor: marker });
      });
      return marker;
    });
    return () => {
      info.close();
      for (const marker of markers) {
        google.maps.event.clearInstanceListeners(marker);
        marker.map = null;
      }
    };
  }, [runtime, places, selectedIds, onSelect, selectionLabel]);
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
      content.className = "google-origin-marker";
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
          if ((runtime.map.getZoom() ?? 0) > 16) runtime.map.setZoom(16);
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
  return (
    <div
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
      {!runtime && !error ? (
        <p role="status" className="map-note">
          Cargando Google Maps…
        </p>
      ) : null}
    </div>
  );
}
