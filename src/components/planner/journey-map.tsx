"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowUpRight,
  LocateFixed,
  MapPin,
  LoaderCircle,
  Route,
  Navigation,
  Pause,
  Play,
  Check,
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
import { useJourneyNavigation } from "./use-journey-navigation";
import { arrivalRadiusMeters } from "@/lib/journey-navigation";
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
  dayStops,
}: {
  places: Place[];
  planned: boolean;
  stops: Place[];
  dayStops: Place[];
}) {
  const { state, location, actions } = usePlanner();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const basePosition = useMemo(
    () =>
      state.origin?.confirmed
        ? { coordinates: state.origin.coordinates, accuracy: 0 }
        : location.position,
    [state.origin, location.position],
  );
  const navigation = useJourneyNavigation({
    stops: dayStops,
    location,
    origin: basePosition?.coordinates ?? null,
    resetKey: `${state.mapRevision}:${state.routeRequest}:${state.routeDay}:${dayStops.map((stop) => stop.id).join(",")}`,
  });
  const { stop: stopNavigation } = navigation;
  const { setPinnedOrigin } = actions;
  const { clear: clearLocation } = location;
  const pickOrigin = useCallback(
    (coordinates: [number, number]) => {
      if (!coordinateSchema.safeParse(coordinates).success) {
        setPinError("Elige un punto dentro de la región de Nariño.");
        return;
      }
      clearLocation();
      stopNavigation();
      setPinnedOrigin(coordinates);
      setPickingOrigin(false);
      setPinError(null);
    },
    [setPinnedOrigin, clearLocation, stopNavigation],
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
    () =>
      navigation.progress.status === "completed"
        ? []
        : navigation.engaged
          ? navigation.currentStop
            ? [navigation.currentStop]
            : []
          : destination
            ? [destination]
            : stops,
    [
      stops,
      destination,
      navigation.progress.status,
      navigation.engaged,
      navigation.currentStop,
    ],
  );
  const position = useMemo(
    () =>
      navigation.progress.status !== "idle"
        ? (location.position ??
          (navigation.progress.origin
            ? { coordinates: navigation.progress.origin, accuracy: 0 }
            : basePosition))
        : basePosition,
    [
      navigation.progress.status,
      navigation.progress.origin,
      location.position,
      basePosition,
    ],
  );
  const originLabel =
    navigation.progress.status !== "idle"
      ? "Salida del recorrido"
      : state.origin?.confirmed
        ? state.origin.name
        : "Tu ubicación GPS";
  const blocked = targets.some(
    (p) =>
      p.availability === "restringido" || (mode === "driving" && !p.roadAccess),
  );
  const query =
    ((navigation.engaged ? navigation.progress.origin : position) ||
      targets.length >= 2) &&
    targets.length &&
    mode !== "transit" &&
    !blocked
      ? JSON.stringify({
          origin: navigation.engaged
            ? (navigation.progress.origin ?? undefined)
            : position?.coordinates,
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
              "No se pudo calcular la ruta. Prueba el enlace externo.",
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
                : "El servicio de rutas tardó demasiado. Prueba el enlace externo o reintenta.",
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
      {!navigation.engaged ? (
        <div className="map-location-actions">
          <Button
            variant="outline"
            onClick={() => {
              setPickingOrigin(false);
              stopNavigation();
              // Keep the chosen departure if GPS fails; prefer GPS once it succeeds.
              location.request(actions.clearOrigin);
            }}
            disabled={location.busy || navigation.engaged}
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
              stopNavigation();
              setPickingOrigin((value) => !value);
              setPinError(null);
            }}
            disabled={navigation.engaged}
          >
            <MapPin data-icon="inline-start" aria-hidden="true" />
            {pickingOrigin ? "Cancelar pin" : "Poner pin de salida"}
          </Button>
          {location.position && !navigation.engaged ? (
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
          {stops.length &&
          dayStops.length &&
          navigation.progress.status === "idle" ? (
            <Button
              className="col-span-full"
              onClick={navigation.start}
              disabled={state.busy || mode === "transit"}
            >
              <Navigation data-icon="inline-start" aria-hidden="true" />
              Iniciar recorrido ({dayStops.length}{" "}
              {dayStops.length === 1 ? "parada" : "paradas"})
            </Button>
          ) : null}
        </div>
      ) : null}
      {navigation.engaged ? (
        <Alert className="mb-4" role="status">
          <AlertDescription>
            <p>
              <strong>
                Parada {navigation.progress.index + 1} de{" "}
                {navigation.progress.stops.length}:{" "}
                {navigation.currentStop?.name}
              </strong>
            </p>
            {navigation.progress.index > 0 ? (
              <p>
                Llegaste a {dayStops[navigation.progress.index - 1]?.name}. La
                ruta continúa a la siguiente parada.
              </p>
            ) : null}
            <p>
              {navigation.progress.status === "paused"
                ? "GPS en pausa. Puedes reanudarlo o confirmar tu llegada."
                : location.busy
                  ? "Obteniendo GPS para seguir el recorrido…"
                  : `Al estar a unos ${arrivalRadiusMeters} m, el GPS confirmará la llegada y pasará a la siguiente parada. Mantén esta página abierta.`}
            </p>
            {navigation.inaccurate ? (
              <p>
                La señal de GPS es imprecisa. No se avanzará automáticamente
                hasta mejorar la precisión.
              </p>
            ) : null}
            {location.error ? <p>{location.error}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={navigation.arrived}>
                <Check data-icon="inline-start" aria-hidden="true" />
                Ya llegué
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={
                  navigation.progress.status === "paused"
                    ? navigation.resume
                    : navigation.pause
                }
              >
                {navigation.progress.status === "paused" ? (
                  <Play data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <Pause data-icon="inline-start" aria-hidden="true" />
                )}
                {navigation.progress.status === "paused"
                  ? "Reanudar GPS"
                  : "Pausar GPS"}
              </Button>
              <Button size="sm" variant="ghost" onClick={stopNavigation}>
                Salir del recorrido
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : navigation.progress.status === "completed" ? (
        <Alert className="mb-4" role="status">
          <AlertDescription>
            <p>
              <strong>Recorrido completado</strong>
            </p>
            <p>
              Llegaste a la última parada. El seguimiento de GPS se ha detenido.
            </p>
            <Button size="sm" variant="outline" onClick={stopNavigation}>
              Cerrar recorrido
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {state.origin && navigation.progress.status === "idle" ? (
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
      {location.error && navigation.progress.status === "idle" ? (
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
        places={navigation.progress.status !== "idle" ? dayStops : places}
        center={center}
        radius={state.search.radius}
        onSelect={navigation.engaged ? undefined : actions.togglePlace}
        selectedIds={state.selectedIds}
        selectionLabel="Añadir a mi itinerario"
        position={position}
        originLabel={originLabel}
        fitPosition={!!stops.length || !state.discovery}
        onPickOrigin={pickingOrigin ? pickOrigin : undefined}
        routeCoordinates={current?.data?.geometry.coordinates}
      />
      {stops.length && navigation.progress.status !== "completed" ? (
        <FieldGroup className="map-route-fields">
          {!navigation.engaged ? (
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
                  setSelectedId(
                    e.target.value === "day" ? null : e.target.value,
                  )
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
          ) : null}
          <Field>
            <FieldLabel htmlFor="route-mode">Cómo llegar</FieldLabel>
            <select
              id="route-mode"
              name="route-mode"
              value={mode}
              disabled={navigation.engaged}
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
        OpenStreetMap · OSRM
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
  const dayStops = useMemo(() => {
    const byId = new Map(state.places.map((place) => [place.id, place]));
    return (itinerary?.days[selectedDay]?.stops ?? [])
      .map((stop) => byId.get(stop.placeId))
      .filter((place): place is Place => !!place);
  }, [itinerary, selectedDay, state.places]);
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
        dayStops={dayStops}
      />
    </div>
  );
}
