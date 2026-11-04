"use client";
import type { Place } from "@/lib/places";
export { default } from "./google-place-map";
export type Viewport = { center: [number, number]; radius: number };
export type PlaceMapProps = {
  places: Place[];
  center: [number, number];
  radius: number;
  onMove?: (v: Viewport) => void;
  onSelect?: (id: string) => void;
  selectionLabel?: string;
  selectedIds?: string[];
  position?: { coordinates: [number, number]; accuracy: number } | null;
  originLabel?: string;
  routeCoordinates?: [number, number][];
};
