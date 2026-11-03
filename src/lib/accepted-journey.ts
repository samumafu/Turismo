import type { Place } from "./places";
import type { Itinerary } from "./schemas";

export function acceptedJourney(
  ids: string[],
  places: Place[],
  proposed?: Itinerary | null,
): Itinerary | null {
  const byId = new Map(places.map((p) => [p.id, p]));
  const stops = [...new Set(ids)]
    .map((id) => byId.get(id))
    .filter((p): p is Place => !!p && p.availability !== "restringido")
    .slice(0, 25);
  if (!stops.length) return null;
  if (
    proposed &&
    JSON.stringify(itineraryIds(proposed)) ===
      JSON.stringify(stops.map((p) => p.id)) &&
    proposed.days.every((day, index) => {
      let end = 0;
      return (
        day.day === index + 1 &&
        day.stops.every((s) => {
          const [h, m] = s.suggestedTime.split(":").map(Number);
          const start = h * 60 + m;
          if (start < end || start < 360 || start + s.durationMinutes > 1440)
            return false;
          end = start + s.durationMinutes;
          return true;
        })
      );
    })
  )
    return proposed;
  const days: Itinerary["days"] = [];
  for (let i = 0; i < stops.length; i += 5) {
    let minutes = 600;
    days.push({
      day: days.length + 1,
      title: "Mis visitas elegidas",
      stops: stops.slice(i, i + 5).map((p) => {
        const start = minutes;
        const duration = p.visitMinutes ?? 60;
        minutes += duration + 30;
        return {
          placeId: p.id,
          suggestedTime: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
          durationMinutes: duration,
          activity: `Visita a ${p.name}. Confirma acceso y horario antes de salir.`,
        };
      }),
    });
  }
  return {
    title: "Mi recorrido",
    days,
    recommendations: [
      "El orden corresponde a tus elecciones. Las horas y duraciones son orientativas; los intervalos no representan tiempos reales de traslado.",
    ],
  };
}

export function itineraryIds(plan: Itinerary | null) {
  return plan?.days.flatMap((d) => d.stops.map((s) => s.placeId)) ?? [];
}
