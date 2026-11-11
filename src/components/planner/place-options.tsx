"use client";
import { ArrowUpRight, Check, Plus, LoaderCircle, List } from "lucide-react";
import { usePlanner } from "./provider";
import { mapsLink, formatTravel } from "@/lib/places";
import { PlacePhoto } from "@/components/discovery/place-photo";
import { GoogleAttribution } from "@/components/discovery/google-attribution";
import { Button } from "@/components/ui/button";
export function PlaceOptions({
  onViewItinerary,
}: {
  onViewItinerary: () => void;
}) {
  const { state, actions } = usePlanner();
  if (!state.results.length) return null;
  const groups = Map.groupBy(state.results, (place) => place.category);
  return (
    <section className="place-options" aria-labelledby="place-options-title">
      <div className="place-options-heading">
        <div>
          <h2 id="place-options-title">Elige tus visitas</h2>
          <p>
            {state.results.length} lugares para descubrir. Tú decides cuáles
            visitar.
          </p>
        </div>
        {state.selectedIds.length ? (
          <Button variant="secondary" size="sm" onClick={onViewItinerary}>
            <List data-icon="inline-start" aria-hidden="true" />
            Mi itinerario ({state.selectedIds.length})
          </Button>
        ) : null}
      </div>
      {[...groups].map(([category, records]) => (
        <section className="place-group" key={category}>
          <h3>
            {category}
            <span>{records.length}</span>
          </h3>
          <ul className="place-list">
            {records.map((place) => {
              const accepted = state.selectedIds.includes(place.id);
              return (
                <li key={place.id} className="place-option">
                  <PlacePhoto place={place} />
                  <div className="place-option-body">
                    <h4 title={place.name}>{place.name}</h4>
                    <p className="place-address">{place.region}</p>
                    {place.travel ? (
                      <p className="place-travel">
                        {formatTravel(place.travel)}
                        <span>Por calles desde {place.travel.originName}</span>
                      </p>
                    ) : (
                      <p className="place-travel">Distancia por confirmar</p>
                    )}
                    <Button
                      variant={accepted ? "secondary" : "default"}
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
                    <a
                      className="place-external-link"
                      href={mapsLink(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver en Google Maps <ArrowUpRight aria-hidden="true" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <GoogleAttribution places={state.results} />
      {state.action === "explore" &&
      state.discovery?.nextPageToken &&
      state.results.length < 60 ? (
        <Button
          className="load-more-places"
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
          ) : (
            <Plus data-icon="inline-start" aria-hidden="true" />
          )}
          {state.busy ? "Cargando lugares…" : "Ver más lugares"}
        </Button>
      ) : null}
    </section>
  );
}
