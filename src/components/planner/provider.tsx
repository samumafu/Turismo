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
  itinerarySchema,
  profileSchema,
  type ChatMessage,
  type ChatResponse,
  type Itinerary,
  type Profile,
} from "@/lib/schemas";
import { validatePlan } from "@/lib/planning";
import { useUserLocation } from "./use-user-location";
import {
  osmIdSchema,
  placeSchema,
  searchSpecSchema,
  type Place,
  type SearchResponse,
  type SearchSpec,
} from "@/lib/places";

const greeting: ChatMessage = {
  role: "assistant",
  content:
    "Hola. Cuéntame qué quieres hacer en Nariño. Puedo buscar lugares, organizar tu itinerario y ajustarlo contigo.",
};
export const journeySnapshotSchema = z.object({
  action: z.enum(["explore", "plan", "clarify"]).optional(),
  results: z.array(placeSchema).max(50),
  places: z.array(placeSchema).max(75),
  search: searchSpecSchema,
  profile: profileSchema,
  itinerary: itinerarySchema.nullable(),
  mode: z.enum(["gemini", "demo"]).nullable(),
});
export type JourneySnapshot = z.infer<typeof journeySnapshotSchema>;
type State = {
  action: ChatResponse["action"];
  results: Place[];
  discovery: ChatResponse["discovery"];
  places: Place[];
  search: SearchSpec;
  selectedIds: string[];
  messages: ChatMessage[];
  profile: Profile;
  itinerary: Itinerary | null;
  mode: ChatResponse["mode"] | null;
  notice: string | null;
  busy: boolean;
  error: string | null;
};
type PlannerContextValue = {
  location: ReturnType<typeof useUserLocation>;
  state: State;
  actions: {
    send: (text: string, demo?: boolean) => Promise<boolean>;
    reset: () => void;
    restore: () => void;
    loadJourney: (snapshot: JourneySnapshot) => boolean;
    discover: (result: SearchResponse) => void;
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
  messages: [greeting],
  profile: emptyProfile,
  itinerary: null,
  mode: null,
  notice: null,
  busy: false,
  error: null,
};

export function PlannerProvider({ children }: { children: ReactNode }) {
  const location = useUserLocation();
  const [state, setState] = useState<State>(initial);
  const lock = useRef(false);
  const undo = useRef<State | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const picked = z
      .array(osmIdSchema)
      .max(25)
      .safeParse((params.get("lugares") ?? "").split(",").filter(Boolean));
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
        ...(picked.success && picked.data.length
          ? {
              selectedIds: picked.data,
              search: linkedSearch ?? s.search,
              itinerary: null,
              places: [],
            }
          : {}),
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
        }),
        signal: AbortSignal.timeout(80000),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          `${body.error ?? "No se pudo crear el plan."}${response.status === 429 ? ` Reintenta en ${response.headers.get("Retry-After") ?? 60} segundos.` : ""}`,
        );
      const result = chatResponseSchema.parse(body);
      setState((s) => ({
        ...s,
        action: result.action,
        results:
          result.discovery || result.places.length ? result.places : s.results,
        discovery: result.discovery ?? s.discovery,
        places: [
          ...new Map(
            [
              ...result.places,
              ...s.places.filter(
                (p) => !result.places.some((v) => v.id === p.id),
              ),
            ].map((p) => [p.id, p]),
          ).values(),
        ]
          .filter(
            (p) =>
              result.places.some((v) => v.id === p.id) ||
              s.itinerary?.days.some((d) =>
                d.stops.some((stop) => stop.placeId === p.id),
              ),
          )
          .slice(0, 75),
        search: result.search ?? s.search,
        profile: result.profile,
        itinerary:
          result.itinerary ??
          ((result.action === "clarify" || result.action === "plan") &&
          s.itinerary &&
          !validatePlan(s.itinerary, result.profile, s.places)
            ? null
            : s.itinerary),
        messages: [
          ...messages,
          { role: "assistant", content: result.message },
        ].slice(-16) as ChatMessage[],
        mode: result.mode,
        notice: result.notice,
        busy: false,
      }));
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
  function loadJourney(snapshot: JourneySnapshot) {
    if (lock.current) return false;
    if (
      snapshot.itinerary &&
      !validatePlan(snapshot.itinerary, snapshot.profile, snapshot.places)
    )
      return false;
    setState((s) => ({
      ...s,
      ...snapshot,
      action: snapshot.action ?? (snapshot.itinerary ? "plan" : "explore"),
      selectedIds: [],
      discovery: undefined,
      messages: [greeting],
      notice: null,
      error: null,
    }));
    return true;
  }
  function discover(result: SearchResponse) {
    if (lock.current) return;
    setState((s) => ({
      ...s,
      action: "explore",
      results: result.places,
      places: [
        ...new Map(
          [...s.places, ...result.places].map((p) => [p.id, p]),
        ).values(),
      ]
        .filter(
          (p) =>
            result.places.some((v) => v.id === p.id) ||
            s.itinerary?.days.some((d) =>
              d.stops.some((stop) => stop.placeId === p.id),
            ),
        )
        .slice(0, 75),
      search: result.spec,
      selectedIds: [],
      notice: result.notice,
      error: null,
      discovery: {
        total: result.total,
        source: result.source,
        observedAt: result.observedAt,
      },
    }));
  }
  function selectPlaces(ids: string[], search: SearchSpec) {
    if (lock.current) return;
    setState((s) => ({
      ...s,
      action: "explore",
      selectedIds: ids,
      search,
      results: s.places.filter((p) => ids.includes(p.id)),
    }));
  }
  return (
    <PlannerContext
      value={{
        location,
        state,
        actions: { send, reset, restore, loadJourney, discover, selectPlaces },
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
