"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type UserPosition = { coordinates: [number, number]; accuracy: number };
export function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const request = useCallback(() => {
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
      ({ coords }) => {
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
        });
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
  const clear = useCallback(() => {
    generation.current++;
    pending.current = false;
    setBusy(false);
    setPosition(null);
    setError(null);
  }, []);
  return { position, busy, error, request, clear };
}
