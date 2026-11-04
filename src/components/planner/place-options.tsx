"use client";
import { Check, Plus, LoaderCircle } from "lucide-react";
import { usePlanner } from "./provider";
import { mapsLink } from "@/lib/places";
import { PlacePhoto } from "@/components/discovery/place-photo";
import { GoogleAttribution } from "@/components/discovery/google-attribution";
import { Button } from "@/components/ui/button";
export function PlaceOptions() {
  const { state, actions } = usePlanner();
  if (!state.results.length) return null;
  const groups = Map.groupBy(state.results, (p) => p.category);
  return (
    <section className="place-options" aria-labelledby="place-options-title">
      <h2 id="place-options-title">Elige tus visitas</h2>
      <GoogleAttribution places={state.results} />
      <p className="map-note">
        {state.results.length} lugares encontrados. Añade los que quieras
        visitar y abre sus fotos.
      </p>
      {[...groups].map(([category, records]) => (
        <section key={category}>
          <h3>{category}</h3>
          <ul>
            {records.map((place) => {
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
                      Ver ficha en Google Maps
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
                    {place.availability === "restringido"
                      ? "Acceso por confirmar"
                      : accepted
                        ? "Añadido · quitar"
                        : "Añadir a mi itinerario"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {state.action === "explore" &&
      state.discovery?.nextPageToken &&
      state.results.length < 60 ? (
        <Button
          variant="outline"
          disabled={state.busy}
          onClick={() => void actions.morePlaces()}
        >
          {state.busy ? (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin"
              aria-hidden="true"
            />
          ) : null}
          {state.busy ? "Cargando lugares…" : "Ver más lugares"}
        </Button>
      ) : null}
    </section>
  );
}
