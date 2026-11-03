"use client";
import { useEffect, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { mapsLink, haversine, type Place } from "@/lib/places";

export type Viewport = { center: [number, number]; radius: number };
function ViewportTracker({ onMove }: { onMove: (v: Viewport) => void }) {
  const map = useMap();
  useEffect(() => {
    function report() {
      const center = map.getCenter();
      onMove({
        center: [center.lat, center.lng],
        radius: Math.max(
          500,
          Math.min(
            25000,
            Math.round(
              haversine(
                [center.lat, center.lng],
                [
                  map.getBounds().getNorthEast().lat,
                  map.getBounds().getNorthEast().lng,
                ],
              ),
            ),
          ),
        ),
      });
    }
    report();
    map.on("moveend", report);
    return () => {
      map.off("moveend", report);
    };
  }, [map, onMove]);
  return null;
}
function Recenter({
  center,
  radius,
}: {
  center: [number, number];
  radius: number;
}) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.setView([lat, lng], radius > 15000 ? 10 : radius > 6000 ? 12 : 14, {
      animate: false,
    });
  }, [map, lat, lng, radius]);
  return null;
}
function Clusters({
  places,
  onSelect,
  selectionLabel,
}: {
  places: Place[];
  onSelect?: (id: string) => void;
  selectionLabel: string;
}) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      maxClusterRadius: 45,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          className: "discovery-cluster",
          html: `<span>${cluster.getChildCount()}</span>`,
          iconSize: [38, 38],
        }),
    });
    group.addLayers(
      places.map((place, index) => {
        const marker = L.marker(place.coordinates, {
          title: place.name,
          alt: place.name,
          icon: L.divIcon({
            className: "numbered-marker",
            html: `<span><b>${index + 1}</b></span>`,
            iconSize: [32, 38],
            iconAnchor: [16, 38],
          }),
        });
        const content = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = place.name;
        content.append(title);
        const category = document.createElement("p");
        category.textContent = place.category;
        content.append(category);
        const link = document.createElement("a");
        link.href = mapsLink(place);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Ver en Google Maps";
        content.append(link);
        if (onSelect && place.availability !== "restringido") {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "map-pick-button";
          button.textContent = selectionLabel;
          button.addEventListener("click", () => onSelect(place.id));
          content.append(button);
        }
        marker.bindPopup(content);
        return marker;
      }),
    );
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      group.clearLayers();
    };
  }, [map, places, onSelect, selectionLabel]);
  return null;
}
export default function PlaceMap({
  places,
  center,
  radius,
  onMove,
  onSelect,
  selectionLabel = "Seleccionar para mi viaje",
  children,
}: {
  places: Place[];
  center: [number, number];
  radius: number;
  onMove?: (v: Viewport) => void;
  onSelect?: (id: string) => void;
  selectionLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="discovery-map"
      role="region"
      aria-label="Mapa de lugares encontrados en OpenStreetMap"
    >
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        className="leaflet-map"
      >
        <TileLayer
          url={
            process.env.NEXT_PUBLIC_OSM_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
          keepBuffer={1}
        />
        <Recenter center={center} radius={radius} />
        {onMove ? <ViewportTracker onMove={onMove} /> : null}
        <Clusters
          places={places}
          onSelect={onSelect}
          selectionLabel={selectionLabel}
        />
        {children}
      </MapContainer>
    </div>
  );
}
