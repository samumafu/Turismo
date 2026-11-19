"use client";
import type { Place } from "@/lib/places";
import dynamic from "next/dynamic";
export default dynamic(() => import("./osm-place-map"), { ssr: false });
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
  fitPosition?: boolean;
  onPickOrigin?: (coordinates: [number, number]) => void;
  routeCoordinates?: [number, number][];
};
