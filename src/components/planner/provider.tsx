"use client";

import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import {
  chatResponseSchema,
  emptyProfile,
  type ChatMessage,
  type ChatResponse,
  type Itinerary,
  type Profile,
} from "@/lib/schemas";
import { acceptedJourney } from "@/lib/accepted-journey";
import { useUserLocation } from "./use-user-location";
import {
  placeSchema,
  searchSpecSchema,
  searchResponseSchema,
  type Place,
  type SearchResponse,
  type SearchSpec,
} from "@/lib/places";
import { type JourneySnapshot } from "@/lib/journey-storage";

const greeting: ChatMessage = {
  role: "assistant",
  content:
    "Hola. Cuéntame qué quieres hacer en Nariño. Puedo buscar lugares, organizar tu itinerario y ajustarlo contigo.",
};
type State = {
  action: ChatResponse["action"];
  results: Place[];
  discovery: ChatResponse["discovery"];
  places: Place[];
  search: SearchSpec;
  selectedIds: string[];
  origin: ChatResponse["origin"] | null;
  messages: ChatMessage[];
  profile: Profile;
  itinerary: Itinerary | null;
  mode: ChatResponse["mode"] | null;
  notice: string | null;
  busy: boolean;
  error: string | null;
  routeDay: number;
  routeRequest: number;
};
type PlannerContextValue = {
  location: ReturnType<typeof useUserLocation>;
  state: State;
  actions: {
    send: (text: string, demo?: boolean) => Promise<boolean>;
    searchPlaces: (spec: SearchSpec, text?: string) => Promise<boolean>;
    showRoute: (day: number) => void;
    togglePlace: (id: string) => void;
    movePlace: (id: string, direction: number) => void;
    confirmOrigin: () => void;
    clearOrigin: () => void;
    reset: () => void;
    restore: () => void;
    loadJourney: (snapshot: JourneySnapshot) => Promise<boolean>;
    discover: (result: SearchResponse) => void;
    morePlaces: () => Promise<void>;
    selectPlaces: (ids: string[], search: SearchSpec) => void;
  };
  meta: { maxMessageLength: number };
};
const PlannerContext = createContext<PlannerContextValue | null>(null);
const initial: State = {
  action: "explore",
  results: [],
  discovery: undefined,
  places: [],
  search: searchSpecSchema.parse({}),
  selectedIds: [],
  origin: null,
  messages: [greeting],
  profile: emptyProfile,
  itinerary: null,
  mode: null,
  notice: null,
  busy: false,
  error: null,
  routeDay: 0,
  routeRequest: 0,
};

export function PlannerProvider({ children }: { children: ReactNode }) {
  const location = useUserLocation();
  const [state, setState] = useState<State>(initial);
  const lock = useRef(false);
  const undo = useRef<State | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let linkedSearch: SearchSpec | undefined;
    try {
      const parsed = searchSpecSchema.safeParse(
        JSON.parse(params.get("busqueda") ?? "null"),
      );
      if (parsed.success) linkedSearch = parsed.data;
    } catch {
      /* Invalid deep link ignored. */
    }
    if (!linkedSearch && (params.has("zona") || params.has("categoria"))) {
      const parsed = searchSpecSchema.safeParse({
        zone: params.get("zona") || "pasto",
        categories: [params.get("categoria") || "turismo"],
      });
      if (parsed.success) linkedSearch = parsed.data;
    }
    queueMicrotask(() =>
      setState((s) => ({
        ...s,
        ...(linkedSearch ? { search: linkedSearch } : {}),
      })),
    );
  }, []);
  async function send(text: string, demo = false) {
    if (lock.current || !text.trim()) return false;
    lock.current = true;
    const messages: ChatMessage[] = [
      ...state.messages,
      { role: "user" as const, content: text.trim() },
    ].slice(-15);
    setState((s) => ({
      ...s,
      messages,
      busy: true,
      error: null,
      notice: null,
    }));
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          profile: state.profile,
          itinerary: state.itinerary,
          demo,
          search: state.search,
          selectedIds: state.selectedIds,
          knownPlaces: state.places,
          origin: state.origin?.confirmed
            ? state.origin
            : location.position
              ? {
                  query: "Tu ubicación",
                  name: "Tu ubicación",
                  coordinates: location.position.coordinates,
                  confirmed: true,
                }
              : undefined,
        }),
        signal: AbortSignal.timeout(80000),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          `${body.error ?? "No se pudo crear el plan."}${response.status === 429 ? ` Reintenta en ${response.headers.get("Retry-After") ?? 60} segundos.` : ""}`,
        );
      const result = chatResponseSchema.parse(body);
      setState((s) => {
        const selectedIds = result.selectedIds ?? s.selectedIds;
        const places = [
          ...new Map(
            [...result.places, ...s.places].map((p) => [p.id, p]),
          ).values(),
        ]
          .filter(
            (p) =>
              result.places.some((v) => v.id === p.id) ||
              selectedIds.includes(p.id) ||
              s.results.some((v) => v.id === p.id),
          )
          .slice(0, 100);
        return {
          ...s,
          action: result.action,
          results: result.discovery ? result.places : s.results,
          routeRequest: result.discovery ? 0 : s.routeRequest,
          discovery: result.discovery ?? s.discovery,
          places,
          selectedIds,
          search: result.search ?? s.search,
          profile: result.profile,
          itinerary: acceptedJourney(selectedIds, places, result.itinerary),
          origin: result.origin ?? s.origin,
          messages: [
            ...messages,
            { role: "assistant", content: result.message },
          ].slice(-16) as ChatMessage[],
          mode: result.mode,
          notice: result.notice,
          busy: false,
        };
      });
      return true;
    } catch (error) {
      setState((s) => ({
        ...s,
        messages: s.messages.slice(0, -1),
        busy: false,
        error:
          error instanceof Error && error.name !== "TimeoutError"
            ? error.message
            : "La respuesta tardó demasiado. Vuelve a enviar tu mensaje o prueba una búsqueda más pequeña.",
      }));
      return false;
    } finally {
      lock.current = false;
    }
  }
  async function searchPlaces(spec: SearchSpec, text = "") {
    if (lock.current) return false;
    lock.current = true;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, spec }),
        signal: AbortSignal.timeout(70000),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo completar la búsqueda.");
      const result = searchResponseSchema.parse(body);
      lock.current = false;
      discover(result);
      const url = new URL(window.location.href);
      url.searchParams.set("zona", result.spec.zone);
      url.searchParams.set("categoria", result.spec.categories[0]);
      window.history.replaceState(window.history.state, "", url);
      return true;
    } catch (error) {
      setState((s) => ({
        ...s,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar la búsqueda.",
      }));
      return false;
    } finally {
      lock.current = false;
      setState((s) => ({ ...s, busy: false }));
    }
  }
  function showRoute(day: number) {
    setState((s) => ({
      ...s,
      routeDay: day,
      routeRequest: s.routeRequest + 1,
    }));
  }
  function reset() {
    if (!lock.current) {
      undo.current = state;
      setState(initial);
    }
  }
  function restore() {
    if (undo.current && !lock.current) {
      setState(undo.current);
      undo.current = null;
    }
  }
  async function loadJourney(snapshot: JourneySnapshot) {
    if (lock.current) return false;
    if (snapshot.googlePlaceIds.length) {
      lock.current = true;
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        const response = await fetch("/api/places/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: snapshot.googlePlaceIds }),
          signal: AbortSignal.timeout(80000),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error ||
              "No se pudieron actualizar los lugares de Google Maps.",
          );
        const places = z
          .object({ places: z.array(placeSchema).max(25) })
          .parse(body).places;
        snapshot = { ...snapshot, places: [...snapshot.places, ...places] };
      } catch (error) {
        setState((s) => ({
          ...s,
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo abrir el viaje.",
        }));
        return false;
      } finally {
        lock.current = false;
      }
    }
    const acceptedIds = snapshot.acceptedIds.filter((id) =>
      snapshot.places.some(
        (p) => p.id === id && p.availability !== "restringido",
      ),
    );
    setState((s) => ({
      ...s,
      ...snapshot,
      action: snapshot.action ?? (snapshot.itinerary ? "plan" : "explore"),
      selectedIds: acceptedIds,
      itinerary: acceptedJourney(
        acceptedIds,
        snapshot.places,
        snapshot.itinerary,
      ),
      origin: null,
      discovery: undefined,
      messages: [greeting],
      notice:
        snapshot.itinerary && !acceptedIds.length
          ? "El viaje anterior contiene propuestas sin confirmar. Elige las visitas que quieras conservar."
          : null,
      error: null,
      busy: false,
    }));
    return true;
  }
  function discover(result: SearchResponse) {
    if (lock.current) return;
    setState((s) => ({
      ...s,
      action: "explore",
      results: result.places,
      routeRequest: 0,
      places: [
        ...new Map(
          [...s.places, ...result.places].map((p) => [p.id, p]),
        ).values(),
      ]
        .filter(
          (p) =>
            result.places.some((v) => v.id === p.id) ||
            s.selectedIds.includes(p.id),
        )
        .slice(0, 100),
      search: result.spec,
      notice: result.notice,
      error: null,
      discovery: {
        total: result.total,
        source: result.source,
        observedAt: result.observedAt,
        nextPageToken: result.nextPageToken,
      },
    }));
  }
  async function morePlaces() {
    const token = state.discovery?.nextPageToken;
    if (lock.current || !token || state.results.length >= 60) return;
    lock.current = true;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: state.search, pageToken: token }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "No se pudieron cargar más lugares.");
      const result = searchResponseSchema.parse(body);
      const places = [
        ...new Map(
          [...state.results, ...result.places].map((p) => [p.id, p]),
        ).values(),
      ].slice(0, 60);
      setState((s) => ({ ...s, busy: false }));
      lock.current = false;
      discover({
        ...result,
        places,
        total: places.length,
        nextPageToken: places.length >= 60 ? null : result.nextPageToken,
      });
    } catch (error) {
      setState((s) => ({
        ...s,
        busy: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar más lugares.",
      }));
    } finally {
      lock.current = false;
    }
  }
  function selectPlaces(ids: string[], search: SearchSpec) {
    if (lock.current) return;
    setState((s) => {
      const selectedIds = [...new Set([...s.selectedIds, ...ids])]
        .filter((id) =>
          s.places.some((p) => p.id === id && p.availability !== "restringido"),
        )
        .slice(0, 25);
      return {
        ...s,
        action: "plan",
        selectedIds,
        search,
        itinerary: acceptedJourney(selectedIds, s.places),
      };
    });
  }
  function togglePlace(id: string) {
    if (lock.current) return;
    setState((s) => {
      if (
        !s.places.some((p) => p.id === id && p.availability !== "restringido")
      )
        return s;
      const selectedIds = s.selectedIds.includes(id)
        ? s.selectedIds.filter((v) => v !== id)
        : [...s.selectedIds, id].slice(0, 25);
      return {
        ...s,
        selectedIds,
        itinerary: acceptedJourney(selectedIds, s.places),
      };
    });
  }
  function movePlace(id: string, direction: number) {
    if (lock.current) return;
    setState((s) => {
      const ids = [...s.selectedIds];
      const from = ids.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return s;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      return {
        ...s,
        selectedIds: ids,
        itinerary: acceptedJourney(ids, s.places),
      };
    });
  }
  function confirmOrigin() {
    setState((s) => ({
      ...s,
      origin: s.origin ? { ...s.origin, confirmed: true } : null,
    }));
  }
  function clearOrigin() {
    setState((s) => ({ ...s, origin: null }));
  }
  return (
    <PlannerContext
      value={{
        location,
        state,
        actions: {
          send,
          searchPlaces,
          showRoute,
          reset,
          restore,
          loadJourney,
          discover,
          morePlaces,
          selectPlaces,
          togglePlace,
          movePlace,
          confirmOrigin,
          clearOrigin,
        },
        meta: { maxMessageLength: 2500 },
      }}
    >
      {children}
    </PlannerContext>
  );
}
export function usePlanner() {
  const value = use(PlannerContext);
  if (!value) throw new Error("PlannerProvider is required");
  return value;
}
export function useOptionalPlanner() {
  return use(PlannerContext);
}
