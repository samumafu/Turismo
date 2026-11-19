"use client";

import { useCallback, useEffect, useState } from "react";
import type { Place } from "@/lib/places";
import {
  advanceNavigation,
  arrivalRadiusMeters,
  freshNavigationFix,
  idleNavigation,
  observeNavigation,
  startNavigation,
} from "@/lib/journey-navigation";
import type { useUserLocation } from "./use-user-location";

export function useJourneyNavigation({
  stops,
  resetKey,
  location,
  origin,
}: {
  stops: Place[];
  resetKey: string;
  location: ReturnType<typeof useUserLocation>;
  origin: [number, number] | null;
}) {
  const [progress, setProgress] = useState(idleNavigation);
  const { startWatching, stopWatching, position, watching, error } = location;
  useEffect(() => {
    stopWatching();
    queueMicrotask(() => setProgress(idleNavigation));
  }, [resetKey, stopWatching]);
  useEffect(() => () => stopWatching(), [stopWatching]);
  useEffect(() => {
    if (!position || !watching) return;
    queueMicrotask(() =>
      setProgress((s) => observeNavigation(s, position, Date.now())),
    );
  }, [position, watching]);
  useEffect(() => {
    if (progress.status === "completed") stopWatching();
    if (progress.status === "active" && error)
      queueMicrotask(() =>
        setProgress((s) =>
          s.status === "active"
            ? {
                ...s,
                status: watching ? "active" : "paused",
                candidateAt: null,
              }
            : s,
        ),
      );
  }, [progress.status, watching, error, stopWatching]);
  function start() {
    const now = Date.now();
    setProgress(startNavigation(stops, origin, now));
    if (!startWatching()) setProgress((s) => ({ ...s, status: "paused" }));
  }
  function pause() {
    stopWatching();
    setProgress((s) => ({ ...s, status: "paused", candidateAt: null }));
  }
  function resume() {
    if (!startWatching()) return;
    setProgress((s) => ({
      ...s,
      status: "active",
      originSource: "departure",
      candidateAt: null,
      startedAt: Date.now(),
    }));
  }
  const stop = useCallback(() => {
    stopWatching();
    setProgress(idleNavigation);
  }, [stopWatching]);
  function arrived() {
    const now = Date.now();
    setProgress((s) =>
      advanceNavigation(
        s,
        freshNavigationFix(position, now) ? position : null,
        now,
      ),
    );
  }
  return {
    progress,
    start,
    pause,
    resume,
    stop,
    arrived,
    engaged: progress.status === "active" || progress.status === "paused",
    currentStop: stops.find(
      (stop) => stop.id === progress.stops[progress.index]?.id,
    ),
    inaccurate: !!position && position.accuracy > arrivalRadiusMeters,
  };
}
