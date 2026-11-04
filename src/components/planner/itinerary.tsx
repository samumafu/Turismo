"use client";
import { ArrowDown, ArrowUp, Clock3, Download, MapPin, X } from "lucide-react";
import { usePlanner } from "./provider";
import { mapsLink } from "@/lib/places";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { PlacePhoto } from "@/components/discovery/place-photo";
import { GoogleAttribution } from "@/components/discovery/google-attribution";
import { storedJourney } from "@/lib/journey-storage";
export function ItineraryPanel() {
  const { state, actions } = usePlanner();
  const { itinerary } = state;
  if (!itinerary)
    return (
      <Empty className="itinerary-panel itinerary-pending">
        <EmptyHeader>
          <EmptyTitle>Tu itinerario empieza con una elección</EmptyTitle>
          <EmptyDescription>
            Añade los lugares que quieras visitar desde las opciones del mapa.
            Aquí aparecerán únicamente las visitas que aceptes.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  const byId = new Map(state.places.map((p) => [p.id, p]));
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            storedJourney({
              itinerary,
              results: [],
              search: state.search,
              acceptedIds: state.selectedIds,
              places: state.places.filter((p) =>
                state.selectedIds.includes(p.id),
              ),
              notice: "Horas orientativas. Confirma acceso y horarios.",
            }),
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-viaje-narino.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="itinerary-panel">
      <GoogleAttribution
        places={state.places.filter((p) => state.selectedIds.includes(p.id))}
      />
      <div className="itinerary-heading">
        <div>
          <Badge variant="secondary">Visitas aceptadas</Badge>
          <h2>Mi recorrido</h2>
          <p>
            {state.selectedIds.length}{" "}
            {state.selectedIds.length === 1 ? "visita" : "visitas"} · en el
            orden que elegiste
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Descargar itinerario"
          onClick={download}
        >
          <Download aria-hidden="true" />
        </Button>
      </div>
      {itinerary.days.map((day) => (
        <section className="day-section" key={day.day}>
          <div className="day-heading">
            <span className="day-number">
              {String(day.day).padStart(2, "0")}
            </span>
            <div>
              <h3>Día {day.day}</h3>
              <p>Horarios orientativos, sujetos a apertura y traslados.</p>
            </div>
          </div>
          <ol className="stop-list">
            {day.stops.map((stop) => {
              const place = byId.get(stop.placeId);
              if (!place) return null;
              const index = state.selectedIds.indexOf(place.id);
              return (
                <li key={place.id} className="stop-row">
                  <div className="stop-clock">
                    <time>{stop.suggestedTime}</time>
                    <span className="stop-dot">{index + 1}</span>
                  </div>
                  <article className="stop-place">
                    <div className="stop-meta">
                      {place.category} · {place.region}
                    </div>
                    <h4>{place.name}</h4>
                    <div className="stop-duration">
                      <Clock3 size={14} aria-hidden="true" />
                      {stop.durationMinutes} min sugeridos
                    </div>
                    <PlacePhoto key={place.id} place={place} />
                    <div className="visit-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={state.busy || index === 0}
                        aria-label={"Subir " + place.name}
                        onClick={() => actions.movePlace(place.id, -1)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          state.busy || index === state.selectedIds.length - 1
                        }
                        aria-label={"Bajar " + place.name}
                        onClick={() => actions.movePlace(place.id, 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={state.busy}
                        onClick={() => actions.togglePlace(place.id)}
                      >
                        <X data-icon="inline-start" aria-hidden="true" />
                        Quitar visita
                      </Button>
                      <a
                        className="maps-link"
                        href={mapsLink(place)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin size={14} aria-hidden="true" /> Google Maps y
                        fotos
                      </a>
                    </div>
                    <details>
                      <summary>Acceso y fuentes</summary>
                      <p>{place.note}</p>
                      <p>
                        Horario declarado:{" "}
                        {place.openingHours ?? "por confirmar"}. Tarifas: por
                        confirmar.
                      </p>
                      {place.sources.map((s) => (
                        <a
                          href={s.url}
                          key={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {s.label}
                        </a>
                      ))}
                    </details>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="map-note">{itinerary.recommendations[0]}</p>
    </div>
  );
}
