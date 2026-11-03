"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import { z } from "zod";
import {
  ArrowUpRight,
  LocateFixed,
  LoaderCircle,
  Route,
  X,
} from "lucide-react";
import { directionsLink, searchZones, type Place } from "@/lib/places";
import PlaceMap from "@/components/discovery/place-map";
import { usePlanner } from "./provider";
import type { UserPosition } from "./use-user-location";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

const routeSchema = z.object({
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z
      .array(z.tuple([z.number(), z.number()]))
      .min(2)
      .max(30000),
  }),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
});
type RoadRoute = z.infer<typeof routeSchema>;
type Mode = "driving" | "walking" | "transit";

function RouteOverlay({
  position,
  stops,
  route,
}: {
  position: UserPosition | null;
  stops: Place[];
  route?: RoadRoute;
}) {
  const map = useMap();
  const points = useMemo(
    () =>
      route
        ? route.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          )
        : [
            ...(position ? [position.coordinates] : []),
            ...stops.map((p) => p.coordinates),
          ],
    [position, stops, route],
  );
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15, { animate: false });
    else if (points.length)
      map.fitBounds(latLngBounds(points), {
        padding: [35, 35],
        maxZoom: 15,
        animate: false,
      });
    map.invalidateSize();
  }, [map, points]);
  return (
    <>
      {position ? (
        <>
          <Circle
            center={position.coordinates}
            radius={position.accuracy}
            pathOptions={{ color: "#17678a", weight: 1, fillOpacity: 0.08 }}
            interactive={false}
          />
          <Marker
            position={position.coordinates}
            title="Tu ubicación aproximada"
            alt="Tu ubicación aproximada"
            icon={divIcon({
              className: "user-location-marker",
              html: "<span></span>",
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })}
          >
            <Popup>
              <strong>Tu ubicación aproximada</strong>
              <p>
                Precisión del dispositivo: ±{Math.round(position.accuracy)} m.
              </p>
            </Popup>
          </Marker>
        </>
      ) : null}
      {route ? (
        <Polyline
          positions={points}
          pathOptions={{ color: "#17678a", weight: 5, opacity: 0.9 }}
        />
      ) : null}
    </>
  );
}

function RoutingMap({
  places,
  planned,
}: {
  places: Place[];
  planned: boolean;
}) {
  const { state, location } = usePlanner();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(
    state.profile.transport === "a-pie"
      ? "walking"
      : state.profile.transport === "publico"
        ? "transit"
        : "driving",
  );
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{
    query: string;
    data?: RoadRoute;
    error?: string;
    busy?: boolean;
  } | null>(null);
  const destination = places.find((p) => p.id === selectedId);
  const targets = useMemo(
    () => (destination ? [destination] : planned ? places : places.slice(0, 1)),
    [places, planned, destination],
  );
  const position = location.position;
  const requestPosition = location.request;
  const blocked = targets.some(
    (p) =>
      p.availability === "restringido" || (mode === "driving" && !p.roadAccess),
  );
  const query =
    position && targets.length && mode !== "transit" && !blocked
      ? JSON.stringify({
          origin: position.coordinates,
          placeIds: targets.map((p) => p.id),
          mode,
        })
      : null;
  const current = response?.query === query ? response : null;
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    // Debounce rapid destination changes and Strict Mode effects. Never poll.
    const timer = setTimeout(async () => {
      setResponse({ query, busy: true });
      try {
        const result = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: query,
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(35000),
          ]),
        });
        const body = await result.json();
        if (!result.ok)
          throw new Error(
            body.error ||
              "No se pudo calcular la ruta. Prueba el enlace de Google Maps.",
          );
        const data = routeSchema.parse(body);
        if (!controller.signal.aborted) setResponse({ query, data });
      } catch (e) {
        if (!controller.signal.aborted)
          setResponse({
            query,
            error:
              e instanceof Error && e.name !== "TimeoutError"
                ? e.message
                : "El servicio de rutas tardó demasiado. Prueba Google Maps o reintenta.",
          });
      }
    }, 1100);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);
  const selectDestination = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (!position) requestPosition();
    },
    [position, requestPosition],
  );
  const center =
    position?.coordinates ??
    ([...(state.search.center ?? searchZones[state.search.zone].center)] as [
      number,
      number,
    ]);
  return (
    <>
      <div className="map-location-actions">
        <Button onClick={location.request} disabled={location.busy}>
          {location.busy ? (
            <LoaderCircle data-icon="inline-start" aria-hidden="true" />
          ) : (
            <LocateFixed data-icon="inline-start" aria-hidden="true" />
          )}
          {location.busy
            ? "Obteniendo ubicación…"
            : position
              ? "Actualizar mi ubicación"
              : "Usar mi ubicación y trazar ruta"}
        </Button>
        {position ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dejar de usar ubicación"
            title="Dejar de usar ubicación"
            onClick={location.clear}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {location.error ? (
        <Alert variant="destructive">
          <AlertDescription>{location.error}</AlertDescription>
        </Alert>
      ) : null}
      <PlaceMap
        places={places}
        center={center}
        radius={state.search.radius}
        onSelect={selectDestination}
        selectionLabel="Trazar ruta desde mi ubicación"
      >
        <RouteOverlay
          position={position}
          stops={position ? targets : places}
          route={current?.data}
        />
      </PlaceMap>
      {places.length ? (
        <FieldGroup className="map-route-fields">
          <Field>
            <FieldLabel htmlFor="route-destination">
              Destino de la ruta
            </FieldLabel>
            <select
              id="route-destination"
              name="route-destination"
              value={
                destination?.id ?? (planned ? "day" : (targets[0]?.id ?? ""))
              }
              onChange={(e) =>
                setSelectedId(e.target.value === "day" ? null : e.target.value)
              }
            >
              {planned ? (
                <option value="day">Recorrido del día, en orden</option>
              ) : null}
              {places.map((p, i) => (
                <option key={p.id} value={p.id}>
                  {i + 1}. {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="route-mode">Cómo llegar</FieldLabel>
            <select
              id="route-mode"
              name="route-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="driving">En carro</option>
              <option value="walking">A pie</option>
              <option value="transit">Transporte público (Google Maps)</option>
            </select>
          </Field>
        </FieldGroup>
      ) : null}
      <div className="map-actions">
        {targets.length ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={directionsLink(targets, mode, position?.coordinates)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Cómo llegar en Google Maps{" "}
            <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : null}
        {query && current?.error ? (
          <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
            <Route data-icon="inline-start" aria-hidden="true" /> Reintentar
            ruta
          </Button>
        ) : null}
      </div>
      {current?.busy || (query && !current) ? (
        <p className="map-note" aria-live="polite">
          Calculando ruta desde tu ubicación…
        </p>
      ) : current?.data ? (
        <p className="map-note" aria-live="polite">
          {(current.data.distanceMeters / 1000).toLocaleString("es-CO", {
            maximumFractionDigits: 1,
          })}{" "}
          km · {Math.round(current.data.durationSeconds / 60)} min aprox.
        </p>
      ) : blocked ? (
        <p className="map-note" aria-live="polite">
          No hay acceso válido para este modo de viaje.
        </p>
      ) : null}
      {current?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{current.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="map-attribution">
        <span>
          Rutas:{" "}
          <a
            href="https://routing.openstreetmap.de/about.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            FOSSGIS / OSRM
          </a>{" "}
          · datos ©{" "}
          <a href="https://www.openstreetmap.org/copyright">
            OpenStreetMap, ODbL
          </a>
        </span>
        <a
          href="https://www.openstreetmap.org/fixthemap"
          target="_blank"
          rel="noopener noreferrer"
        >
          Reportar un problema del mapa
        </a>
      </div>
    </>
  );
}

export default function JourneyMap() {
  const { state } = usePlanner();
  const [day, setDay] = useState(0);
  const itinerary = state.action === "explore" ? null : state.itinerary;
  const selectedDay = Math.min(day, (itinerary?.days.length ?? 1) - 1);
  const places = useMemo(() => {
    if (!itinerary) return state.results;
    const byId = new Map(state.places.map((p) => [p.id, p]));
    return itinerary.days[selectedDay].stops
      .map((s) => byId.get(s.placeId))
      .filter((p): p is Place => !!p);
  }, [itinerary, selectedDay, state.places, state.results]);
  return (
    <div className="map-panel">
      <div className="map-heading">
        <h2>{itinerary ? "Tu recorrido" : "Mapa de Nariño"}</h2>
        {itinerary ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="map-day">Jornada en el mapa</FieldLabel>
              <select
                id="map-day"
                name="map-day"
                value={selectedDay}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                {itinerary.days.map((d, i) => (
                  <option key={d.day} value={i}>
                    Día {d.day}: {d.title}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGroup>
        ) : null}
      </div>
      <RoutingMap
        key={`${selectedDay}:${state.profile.transport}:${itinerary ? "plan" : "explore"}`}
        places={places}
        planned={!!itinerary}
      />
    </div>
  );
}
