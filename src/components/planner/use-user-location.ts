"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type UserPosition = {
  coordinates: [number, number];
  accuracy: number;
  timestamp: number;
};
export function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef<number | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
      if (watchId.current !== null)
        navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );
  const request = useCallback((onLocated?: () => void) => {
    if (pending.current) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(
        "Tu ubicación requiere HTTPS (como en Vercel) o localhost y un navegador compatible.",
      );
      return;
    }
    const current = ++generation.current;
    pending.current = true;
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => {
        if (current !== generation.current) return;
        pending.current = false;
        setBusy(false);
        if (
          ![coords.latitude, coords.longitude, coords.accuracy].every(
            Number.isFinite,
          ) ||
          Math.abs(coords.latitude) > 90 ||
          Math.abs(coords.longitude) > 180 ||
          coords.accuracy < 0
        ) {
          setError(
            "El dispositivo no devolvió una ubicación válida. Vuelve a intentar.",
          );
          return;
        }
        setPosition({
          coordinates: [coords.latitude, coords.longitude],
          accuracy: coords.accuracy,
          timestamp,
        });
        onLocated?.();
      },
      (e) => {
        if (current !== generation.current) return;
        pending.current = false;
        setBusy(false);
        if (e.code === 1) setPosition(null);
        setError(
          e.code === 1
            ? "Permiso de ubicación denegado. Puedes habilitarlo en los permisos del sitio y volver a intentar."
            : e.code === 3
              ? "La ubicación tardó demasiado. Comprueba el GPS y vuelve a intentar."
              : "No se pudo obtener tu ubicación. Comprueba el GPS o los permisos del dispositivo.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, []);
  const stopWatching = useCallback(() => {
    if (watchId.current === null) return;
    navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    generation.current++;
    pending.current = false;
    setBusy(false);
    setWatching(false);
  }, []);
  const startWatching = useCallback(() => {
    stopWatching();
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(
        "Para avanzar con GPS, abre la app con HTTPS o localhost y permite la ubicación. También puedes usar Ya llegué.",
      );
      return false;
    }
    const current = ++generation.current;
    pending.current = false;
    setError(null);
    setBusy(true);
    setWatching(true);
    try {
      watchId.current = navigator.geolocation.watchPosition(
        ({ coords, timestamp }) => {
          if (current !== generation.current) return;
          setBusy(false);
          if (
            ![
              coords.latitude,
              coords.longitude,
              coords.accuracy,
              timestamp,
            ].every(Number.isFinite) ||
            Math.abs(coords.latitude) > 90 ||
            Math.abs(coords.longitude) > 180 ||
            coords.accuracy < 0
          ) {
            setError(
              "El GPS no devolvió un punto válido. Puedes avanzar con Ya llegué.",
            );
            return;
          }
          setError(null);
          setPosition({
            coordinates: [coords.latitude, coords.longitude],
            accuracy: coords.accuracy,
            timestamp,
          });
        },
        (e) => {
          if (current !== generation.current) return;
          setBusy(false);
          if (e.code === 1) {
            stopWatching();
            setPosition(null);
          }
          setError(
            e.code === 1
              ? "No hay permiso de GPS. Permite la ubicación para continuar automáticamente o usa Ya llegué."
              : null,
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    } catch {
      setBusy(false);
      setWatching(false);
      setError("No se pudo activar el GPS. Puedes continuar con Ya llegué.");
      return false;
    }
    return true;
  }, [stopWatching]);
  const clear = useCallback(() => {
    stopWatching();
    generation.current++;
    pending.current = false;
    setBusy(false);
    setPosition(null);
    setError(null);
  }, [stopWatching]);
  return {
    position,
    busy,
    error,
    request,
    clear,
    watching,
    startWatching,
    stopWatching,
  };
}
