"use client";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { usePlanner } from "./provider";
import { mapsLink } from "@/lib/places";
import { PlacePhoto } from "@/components/discovery/place-photo";
import { Button } from "@/components/ui/button";
export function PlaceOptions() {
  const { state, actions } = usePlanner();
  const [expanded, setExpanded] = useState(false);
  if (!state.results.length) return null;
  const groups = Map.groupBy(state.results, (p) => p.category);
  return (
    <section className="place-options" aria-labelledby="place-options-title">
      <h2 id="place-options-title">Elige tus visitas</h2>
      <p className="map-note">
        Añade solo los lugares que quieras incluir en tu recorrido.
      </p>
      {[...groups].map(([category, records]) => (
        <section key={category}>
          <h3>{category}</h3>
          <ul>
            {(expanded ? records : records.slice(0, 3)).map((place) => {
              const accepted = state.selectedIds.includes(place.id);
              return (
                <li key={place.id} className="place-option">
                  <div>
                    <h4>{place.name}</h4>
                    <p className="map-note">{place.region}</p>
                    <PlacePhoto place={place} />
                    <a
                      className="maps-link"
                      href={mapsLink(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Maps y fotos
                    </a>
                  </div>
                  <Button
                    variant={accepted ? "secondary" : "outline"}
                    size="sm"
                    disabled={
                      state.busy ||
                      place.availability === "restringido" ||
                      (!accepted && state.selectedIds.length >= 25)
                    }
                    onClick={() => actions.togglePlace(place.id)}
                    aria-pressed={accepted}
                  >
                    {accepted ? (
                      <Check data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <Plus data-icon="inline-start" aria-hidden="true" />
                    )}
                    {accepted ? "Añadido · quitar" : "Añadir a mi itinerario"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!expanded && [...groups.values()].some((g) => g.length > 3) ? (
        <Button variant="ghost" onClick={() => setExpanded(true)}>
          Ver más opciones
        </Button>
      ) : null}
    </section>
  );
}
