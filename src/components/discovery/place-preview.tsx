"use client";
import { Check, Plus, ArrowUpRight } from "lucide-react";
import { formatTravel, mapsLink, type Place } from "@/lib/places";
import { Button } from "@/components/ui/button";
import { PlacePhoto } from "./place-photo";
export function PlacePreview({
  place,
  selected,
  onSelect,
  selectionLabel,
}: {
  place: Place;
  selected: boolean;
  onSelect?: (id: string) => void;
  selectionLabel: string;
}) {
  return (
    <article className="place-preview">
      <div className="place-preview-photo">
        <PlacePhoto key={place.id} place={place} eager />
      </div>
      <div className="place-preview-body">
        <p className="place-category">{place.category}</p>
        <h3>{place.name}</h3>
        <p className="place-address">{place.region}</p>
        {place.travel ? (
          <p className="place-travel">
            {formatTravel(place.travel)}
            <span>Por calles desde {place.travel.originName}</span>
          </p>
        ) : null}
        {onSelect && place.availability !== "restringido" ? (
          <Button
            variant={selected ? "secondary" : "default"}
            aria-pressed={selected}
            onClick={() => onSelect(place.id)}
          >
            {selected ? (
              <Check data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Plus data-icon="inline-start" aria-hidden="true" />
            )}
            {selected ? "Añadido · quitar" : selectionLabel}
          </Button>
        ) : null}
        <a
          className="place-external-link"
          href={mapsLink(place)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver en Google Maps <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
