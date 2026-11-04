import type { Place, SearchSpec } from "./places";
import type { Itinerary } from "./schemas";
type Snapshot = {
  results: Place[];
  places: Place[];
  search: SearchSpec;
  itinerary: Itinerary | null;
  acceptedIds: string[];
};
// Persist the traveler's choices, never a copy of Google's place catalog.
export function storedJourney<T extends Snapshot>(snapshot: T) {
  return {
    ...snapshot,
    googlePlaceIds: [...new Set(snapshot.acceptedIds)],
    results: [],
    places: [],
    search: snapshot.search.reference
      ? { ...snapshot.search, reference: undefined, center: undefined }
      : snapshot.search,
    itinerary: snapshot.itinerary
      ? {
          ...snapshot.itinerary,
          title: "Mi recorrido",
          recommendations: [],
          days: snapshot.itinerary.days.map((day) => ({
            ...day,
            title: "Mis visitas elegidas",
            stops: day.stops.map((stop) => ({
              ...stop,
              activity:
                "Visita elegida. Confirma acceso y horario antes de salir.",
            })),
          })),
        }
      : null,
  };
}
