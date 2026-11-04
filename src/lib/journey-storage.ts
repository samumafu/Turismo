import { isGooglePlace, type Place, type SearchSpec } from "./places";
import type { Itinerary } from "./schemas";

type Snapshot = {
  results: Place[];
  places: Place[];
  search: SearchSpec;
  itinerary: Itinerary | null;
  acceptedIds: string[];
};
// Places content is session-only. Persist IDs, user choices, and the schedule,
// then re-fetch place details when opening a saved journey.
export function storedJourney<T extends Snapshot>(snapshot: T) {
  const googlePlaceIds = [
    ...new Set(snapshot.acceptedIds.filter((id) => id.startsWith("google:"))),
  ];
  const hasGoogle = snapshot.places.some(isGooglePlace);
  const search = snapshot.search.reference?.id.startsWith("google:")
    ? { ...snapshot.search, reference: undefined, center: undefined }
    : snapshot.search;
  return {
    ...snapshot,
    search,
    googlePlaceIds,
    results: snapshot.results.filter((p) => !isGooglePlace(p)),
    places: snapshot.places.filter((p) => !isGooglePlace(p)),
    itinerary:
      hasGoogle && snapshot.itinerary
        ? {
            ...snapshot.itinerary,
            title: "Mi recorrido",
            recommendations: [],
            days: snapshot.itinerary.days.map((day) => ({
              ...day,
              title: "Mis visitas elegidas",
              stops: day.stops.map((stop) =>
                stop.placeId.startsWith("google:")
                  ? {
                      ...stop,
                      activity:
                        "Visita elegida. Confirma acceso y horario antes de salir.",
                    }
                  : stop,
              ),
            })),
          }
        : snapshot.itinerary,
  };
}
