import { haversine } from "./places";

export const arrivalRadiusMeters = 20;
export type NavigationFix = {
  coordinates: [number, number];
  accuracy: number;
  timestamp: number;
};
type Stop = { id: string; coordinates: [number, number] };
export type NavigationState = {
  status: "idle" | "active" | "paused" | "completed";
  stops: Stop[];
  index: number;
  origin: [number, number] | null;
  originSource: "departure" | "gps" | "stop";
  previousStop: [number, number] | null;
  startedAt: number;
  candidateAt: number | null;
  lastFixAt: number;
};
export const idleNavigation: NavigationState = {
  status: "idle",
  stops: [],
  index: 0,
  origin: null,
  originSource: "departure",
  previousStop: null,
  startedAt: 0,
  candidateAt: null,
  lastFixAt: 0,
};
export function freshNavigationFix(
  fix: NavigationFix | null,
  now: number,
): fix is NavigationFix {
  return (
    !!fix &&
    [...fix.coordinates, fix.accuracy, fix.timestamp].every(Number.isFinite) &&
    Math.abs(fix.coordinates[0]) <= 90 &&
    Math.abs(fix.coordinates[1]) <= 180 &&
    fix.accuracy >= 0 &&
    fix.accuracy <= arrivalRadiusMeters &&
    fix.timestamp <= now + 1000 &&
    now - fix.timestamp <= 15000
  );
}
export function startNavigation(
  stops: Stop[],
  origin: [number, number] | null,
  now: number,
): NavigationState {
  if (!stops.length) return idleNavigation;
  return { ...idleNavigation, status: "active", stops, origin, startedAt: now };
}
export function advanceNavigation(
  state: NavigationState,
  fix: NavigationFix | null,
  now: number,
): NavigationState {
  if (state.status !== "active" && state.status !== "paused") return state;
  const current = state.stops[state.index];
  const gps =
    freshNavigationFix(fix, now) &&
    haversine(fix.coordinates, current.coordinates) <= arrivalRadiusMeters
      ? fix
      : null;
  return {
    ...state,
    status: state.index + 1 === state.stops.length ? "completed" : state.status,
    index: state.index + 1,
    previousStop: current.coordinates,
    origin: gps?.coordinates ?? current.coordinates,
    originSource: gps ? "gps" : "stop",
    startedAt: now,
    candidateAt: null,
    lastFixAt: Math.max(state.lastFixAt, gps?.timestamp ?? 0),
  };
}
export function observeNavigation(
  state: NavigationState,
  fix: NavigationFix,
  now: number,
): NavigationState {
  if (state.status !== "active") return state;
  if (!freshNavigationFix(fix, now) || fix.timestamp < state.startedAt)
    return { ...state, candidateAt: null };
  if (fix.timestamp <= state.lastFixAt) return state;
  const next = {
    ...state,
    origin: state.originSource === "departure" ? fix.coordinates : state.origin,
    originSource:
      state.originSource === "departure"
        ? ("gps" as const)
        : state.originSource,
    lastFixAt: fix.timestamp,
  };
  const distance = haversine(
    fix.coordinates,
    state.stops[state.index].coordinates,
  );
  // Nearby venues require evidence that the traveller moved toward the next one.
  const approachedNext =
    !state.previousStop ||
    distance + fix.accuracy < haversine(fix.coordinates, state.previousStop);
  if (distance > arrivalRadiusMeters || !approachedNext)
    return { ...next, candidateAt: null };
  const candidateAt =
    fix.timestamp - state.lastFixAt > 15000
      ? fix.timestamp
      : (state.candidateAt ?? fix.timestamp);
  if (fix.timestamp - candidateAt >= 3000)
    return advanceNavigation(next, fix, now);
  return { ...next, candidateAt };
}
