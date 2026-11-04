"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { isGooglePlace, type Place } from "@/lib/places";
import { usesGoogleMaps } from "@/lib/maps-config";
import { Skeleton } from "@/components/ui/skeleton";
const GooglePlaceMap = dynamic(() => import("./google-place-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[480px] w-full" />,
});
const OsmPlaceMap = dynamic(() => import("./osm-place-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[480px] w-full" />,
});
export type Viewport = { center: [number, number]; radius: number };
export type PlaceMapProps = {
  places: Place[];
  center: [number, number];
  radius: number;
  onMove?: (v: Viewport) => void;
  onSelect?: (id: string) => void;
  selectionLabel?: string;
  selectedIds?: string[];
  children?: ReactNode;
  position?: { coordinates: [number, number]; accuracy: number } | null;
  originLabel?: string;
  routeCoordinates?: [number, number][];
};
export default function PlaceMap(props: PlaceMapProps) {
  // Never put Google Places content or Google route geometry on an OSM map.
  if (usesGoogleMaps() || props.places.some(isGooglePlace))
    return <GooglePlaceMap {...props} />;
  return <OsmPlaceMap {...props} />;
}
