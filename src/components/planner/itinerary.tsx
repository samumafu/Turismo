"use client";

import Image from "next/image";
import { Clock3, MapPin, Wallet, Download, Compass } from "lucide-react";
import { usePlanner } from "./provider";
import { cop, mapsLink } from "@/lib/places";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ItineraryPanel() {
  const { state } = usePlanner();
  const { itinerary, profile } = state;
  const placeById = new Map(state.places.map((p) => [p.id, p]));
  function download() {
    if (!itinerary) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            itinerary,
            profile,
            notice:
              "Agenda y provisiones orientativas. Tarifas y apertura por confirmar.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-viaje-narino.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  if ((!itinerary || state.action === "explore") && state.results.length)
    return (
      <div className="itinerary-panel">
        <div className="itinerary-heading">
          <div>
            <Badge variant="secondary">Lugares encontrados</Badge>
            <h2>Tu selección para explorar</h2>
            <p>
              Para organizar horarios y días, cuéntale al chat cómo quieres
              viajar.
            </p>
          </div>
        </div>
        <ol className="stop-list">
          {state.results.map((place, index) => (
            <li key={place.id} className="stop-row">
              <div className="stop-clock">
                <span className="stop-dot">{index + 1}</span>
              </div>
              <article className="stop-place">
                <div className="stop-meta">
                  {place.category} <span>{place.region}</span>
                </div>
                <h4>{place.name}</h4>
                <p>{place.description}</p>
                <a
                  className="maps-link"
                  href={mapsLink(place)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={14} aria-hidden="true" /> Ver lugar en Google
                  Maps
                  <span className="sr-only"> (abre otra pestaña)</span>
                </a>
              </article>
            </li>
          ))}
        </ol>
      </div>
    );
  if (!itinerary)
    return (
      <div className="planner-empty">
        <Image
          src="/images/las-lajas.jpg"
          fill
          sizes="(max-width: 760px) 100vw, 65vw"
          alt="Montañas y campos del entorno de Las Lajas"
        />
        <div className="planner-empty-content">
          <Compass size={34} strokeWidth={1.3} aria-hidden="true" />
          <h2>
            El sur está lleno
            <br />
            de posibilidades.
          </h2>
          <p>Tu itinerario aparecerá aquí cuando lo construyas en el chat.</p>
        </div>
      </div>
    );
  const groupBudget =
    profile.budgetCOP! *
    (profile.budgetScope === "persona" ? profile.travelers! : 1);
  const dayBudget = Math.floor(groupBudget / itinerary.days.length);
  return (
    <div className="itinerary-panel">
      <div className="itinerary-heading">
        <div>
          <Badge variant="secondary">
            {state.mode === "demo"
              ? "Propuesta por reglas · lugares OSM"
              : "Propuesta con IA"}
          </Badge>
          <h2>{itinerary.title}</h2>
          <p>
            {profile.days} {profile.days === 1 ? "día" : "días"} para{" "}
            {profile.travelers}{" "}
            {profile.travelers === 1 ? "viajero" : "viajeros"} ·{" "}
            {profile.transport === "a-pie"
              ? "A pie"
              : profile.transport === "carro"
                ? "En carro"
                : "Transporte público"}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Descargar itinerario en JSON"
          onClick={download}
        >
          <Download aria-hidden="true" />
        </Button>
      </div>
      <div className="budget-summary">
        <Wallet aria-hidden="true" />
        <div>
          <span>Tu presupuesto declarado</span>
          <strong>
            {cop(profile.budgetCOP!)}{" "}
            <small>
              {profile.budgetScope === "persona"
                ? "por persona"
                : "para el grupo"}
            </small>
          </strong>
        </div>
        <p>
          La viabilidad depende de cotizaciones reales.
          <br />
          No es una reserva ni un precio garantizado.
        </p>
      </div>
      {itinerary.days.map((day) => (
        <section
          className="day-section"
          key={day.day}
          aria-labelledby={`day-${day.day}`}
        >
          <div className="day-heading">
            <span className="day-number">
              {String(day.day).padStart(2, "0")}
            </span>
            <div>
              <span>Día {day.day}</span>
              <h3 id={`day-${day.day}`}>{day.title}</h3>
            </div>
          </div>
          <ol className="stop-list">
            {day.stops.map((stop, index) => {
              const place = placeById.get(stop.placeId);
              if (!place) return null;
              return (
                <li key={`${place.id}-${index}`} className="stop-row">
                  <div className="stop-clock">
                    <time>{stop.suggestedTime}</time>
                    <span className="stop-dot">{index + 1}</span>
                  </div>
                  <article className="stop-place">
                    <div className="stop-place-main">
                      <div>
                        <div className="stop-meta">
                          {place.category} <span>{place.region}</span>
                        </div>
                        <h4>{place.name}</h4>
                        <p>{stop.activity}</p>
                        <div className="stop-duration">
                          <Clock3 size={14} aria-hidden="true" />{" "}
                          {stop.durationMinutes} min sugeridos{" "}
                          <span>Entrada: por confirmar</span>
                        </div>
                      </div>
                      {place.image ? (
                        <Image
                          src={place.image}
                          width={104}
                          height={104}
                          alt={place.name}
                          className="stop-photo"
                        />
                      ) : null}
                    </div>
                    <details>
                      <summary>Antes de ir y fuentes</summary>
                      <p>{place.note}</p>
                      <p>
                        Horario declarado en OSM:{" "}
                        {place.openingHours ?? "sin datos; por confirmar"}.
                        Coordenadas de referencia:{" "}
                        {place.coordinates.map((c) => c.toFixed(5)).join(", ")}.
                      </p>
                      {place.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.label}{" "}
                          <span className="sr-only"> (abre otra pestaña)</span>
                        </a>
                      ))}
                    </details>
                    <a
                      className="maps-link"
                      href={mapsLink(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={14} aria-hidden="true" /> Ver lugar en
                      Google Maps
                      <span className="sr-only"> (abre otra pestaña)</span>
                    </a>
                  </article>
                </li>
              );
            })}
          </ol>
          <details className="day-budget">
            <summary>
              Provisión orientativa del día: {cop(dayBudget)} para el grupo
            </summary>
            <p>
              Reparto aritmético de tu presupuesto, no una estimación de
              tarifas. Puedes destinar aproximadamente{" "}
              {cop(Math.floor(dayBudget * 0.35))} a alimentación,{" "}
              {cop(Math.floor(dayBudget * 0.35))} a traslados y{" "}
              {cop(dayBudget - 2 * Math.floor(dayBudget * 0.35))} a actividades
              e imprevistos. Alojamiento no incluido. Las cotizaciones pueden
              superar estas provisiones.
            </p>
          </details>
        </section>
      ))}
      <Alert>
        <AlertDescription>
          Los horarios son una agenda sugerida, no horarios de apertura. Los
          costos de cada lugar son desconocidos; confirma tarifas,
          desplazamientos y disponibilidad antes de salir.
        </AlertDescription>
      </Alert>
      <section className="recommendations">
        <h3>Para llevar en la bitácora</h3>
        <ul>
          {itinerary.recommendations.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
