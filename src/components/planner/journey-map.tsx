"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowUpRight,
  LocateFixed,
  MapPin,
  LoaderCircle,
  Route,
  X,
} from "lucide-react";
import {
  directionsLink,
  searchZones,
  formatDistance,
  coordinateSchema,
  type Place,
} from "@/lib/places";
import PlaceMap from "@/components/discovery/place-map";
import { usePlanner } from "./provider";
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
  steps: z
    .array(z.object({ instruction: z.string(), distanceMeters: z.number() }))
    .default([]),
});
type RoadRoute = z.infer<typeof routeSchema>;
type Mode = "driving" | "walking" | "transit";

function RoutingMap({
  places,
  planned,
  stops,
}: {
  places: Place[];
  planned: boolean;
  stops: Place[];
}) {
  const { state, location, actions } = usePlanner();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const { setPinnedOrigin } = actions;
  const { clear: clearLocation } = location;
  const pickOrigin = useCallback(
    (coordinates: [number, number]) => {
      if (!coordinateSchema.safeParse(coordinates).success) {
        setPinError("Elige un punto dentro de la región de Nariño.");
        return;
      }
      clearLocation();
      setPinnedOrigin(coordinates);
      setPickingOrigin(false);
      setPinError(null);
    },
    [setPinnedOrigin, clearLocation],
  );
  const [mode, setMode] = useState<Mode>(
    state.profile.transport === "carro"
      ? "driving"
      : state.profile.transport === "publico"
        ? "transit"
        : "walking",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    queueMicrotask(() => {
      setSelectedId(null);
      setPickingOrigin(false);
    });
  }, [state.mapRevision, state.routeRequest]);
  useEffect(() => {
    const transport = state.profile.transport;
    queueMicrotask(() =>
      setMode(
        transport === "carro"
          ? "driving"
          : transport === "publico"
            ? "transit"
            : "walking",
      ),
    );
  }, [state.profile.transport]);
  const [response, setResponse] = useState<{
    query: string;
    data?: RoadRoute;
    error?: string;
    busy?: boolean;
  } | null>(null);
  const destination = stops.find((p) => p.id === selectedId);
  const targets = useMemo(
    () => (destination ? [destination] : stops),
    [stops, destination],
  );
  const position = useMemo(
    () =>
      state.origin?.confirmed
        ? { coordinates: state.origin.coordinates, accuracy: 0 }
        : location.position,
    [state.origin, location.position],
  );
  const originLabel = state.origin?.confirmed
    ? state.origin.name
    : "Tu ubicación GPS";
  const blocked = targets.some(
    (p) =>
      p.availability === "restringido" || (mode === "driving" && !p.roadAccess),
  );
  const query =
    (position || targets.length >= 2) &&
    targets.length &&
    mode !== "transit" &&
    !blocked
      ? JSON.stringify({
          origin: position?.coordinates,
          placeIds: targets.map((p) => p.id),
          knownPlaces: targets,
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
            AbortSignal.timeout(55000),
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
  const center =
    (stops.length || !state.discovery ? position?.coordinates : undefined) ??
    ([...(state.search.center ?? searchZones[state.search.zone].center)] as [
      number,
      number,
    ]);
  return (
    <>
      <div className="map-location-actions">
        <Button
          variant="outline"
          onClick={() => {
            setPickingOrigin(false);
            // Keep the chosen departure if GPS fails; prefer GPS once it succeeds.
            location.request(actions.clearOrigin);
          }}
          disabled={location.busy}
        >
          {location.busy ? (
            <LoaderCircle data-icon="inline-start" aria-hidden="true" />
          ) : (
            <LocateFixed data-icon="inline-start" aria-hidden="true" />
          )}
          {location.busy
            ? "Obteniendo ubicación…"
            : location.position
              ? "Usar mi GPS"
              : "Usar mi ubicación"}
        </Button>
        <Button
          variant={pickingOrigin ? "secondary" : "outline"}
          aria-pressed={pickingOrigin}
          onClick={() => {
            setPickingOrigin((value) => !value);
            setPinError(null);
          }}
        >
          <MapPin data-icon="inline-start" aria-hidden="true" />
          {pickingOrigin ? "Cancelar pin" : "Poner pin de salida"}
        </Button>
        {location.position ? (
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
      {state.origin ? (
        <Alert className="mb-3.5" role="status">
          <AlertDescription className="flex items-center gap-3">
            <span className="min-w-0">
              Salida: <strong>{state.origin.name}</strong>
            </span>
            {!state.origin.confirmed ? (
              <Button size="sm" onClick={actions.confirmOrigin}>
                Usar como punto de partida
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Quitar punto de partida"
              title="Quitar punto de partida"
              className="ml-auto shrink-0"
              onClick={actions.clearOrigin}
            >
              <X aria-hidden="true" />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {!position && stops.length ? (
        <p className="map-note">
          {stops.length >= 2
            ? "El recorrido empieza en tu primera visita. Para incluir el trayecto desde donde estás, "
            : "Para trazar la ruta hasta esta visita, "}
          usa tu ubicación, coloca un pin o indica en el chat desde dónde
          saldrás.
        </p>
      ) : null}
      {pinError ? (
        <Alert variant="destructive">
          <AlertDescription>{pinError}</AlertDescription>
        </Alert>
      ) : null}
      {location.error ? (
        <Alert variant={state.origin?.confirmed ? "default" : "destructive"}>
          <AlertDescription>
            {location.error}
            {state.origin?.confirmed
              ? " Se conserva el punto de partida elegido."
              : " Puedes colocar un pin en el mapa."}
          </AlertDescription>
        </Alert>
      ) : null}
      <PlaceMap
        places={places}
        center={center}
        radius={state.search.radius}
        onSelect={actions.togglePlace}
        selectedIds={state.selectedIds}
        selectionLabel="Añadir a mi itinerario"
        position={position}
        originLabel={originLabel}
        fitPosition={!!stops.length || !state.discovery}
        onPickOrigin={pickingOrigin ? pickOrigin : undefined}
        routeCoordinates={current?.data?.geometry.coordinates}
      />
      {stops.length ? (
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
              {stops.map((p, i) => (
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
            Abrir en Google Maps{" "}
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
          Calculando tu ruta…
        </p>
      ) : current?.data ? (
        <p className="map-note" aria-live="polite">
          {formatDistance(current.data.distanceMeters)} ·{" "}
          {Math.max(1, Math.round(current.data.durationSeconds / 60))} min
          aprox.
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
      {current?.data?.steps.length ? (
        <details className="route-directions">
          <summary>Ver indicaciones del recorrido</summary>
          <ol>
            {current.data.steps.map((step, index) => (
              <li key={index}>
                <span>{step.instruction}</span>
                <small>{formatDistance(step.distanceMeters)}</small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      <p className="map-attribution" translate="no">
        Google Maps
      </p>
    </>
  );
}

export default function JourneyMap() {
  const { state } = usePlanner();
  const { actions } = usePlanner();
  const itinerary = state.itinerary;
  const selectedDay = Math.min(
    state.routeDay,
    (itinerary?.days.length ?? 1) - 1,
  );
  const stops = useMemo(() => {
    const byId = new Map(state.places.map((p) => [p.id, p]));
    return state.routeIds
      .map((id) => byId.get(id))
      .filter((p): p is Place => !!p);
  }, [state.routeIds, state.places]);
  const places = useMemo(() => {
    if (state.routeRequest && stops.length) return stops;
    if (
      stops.every((place) =>
        state.results.some((result) => result.id === place.id),
      )
    )
      return state.results;
    return [
      ...new Map(
        [...state.results, ...stops].map((place) => [place.id, place]),
      ).values(),
    ];
  }, [state.results, state.routeRequest, stops]);
  return (
    <div className="map-panel">
      <div className="map-heading">
        <h2>{stops.length ? "Tu recorrido" : "Mapa de Nariño"}</h2>
        {itinerary && itinerary.days.length > 1 ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="map-day">Jornada en el mapa</FieldLabel>
              <select
                id="map-day"
                name="map-day"
                value={selectedDay}
                onChange={(e) => actions.showRoute(Number(e.target.value))}
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
        places={places}
        planned={stops.length > 1 || !!state.routeRequest}
        stops={stops}
      />
    </div>
  );
}
