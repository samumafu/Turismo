import { z } from "zod";
import {
  googleIdSchema,
  placeSchema,
  searchSpecSchema,
  type Place,
  type SearchSpec,
} from "./places";
import {
  emptyProfile,
  itinerarySchema,
  profileSchema,
  type Itinerary,
} from "./schemas";

export const journeySnapshotSchema = z.object({
  version: z.literal(2).default(2),
  action: z.enum(["explore", "plan", "clarify"]).optional(),
  results: z.array(placeSchema).max(60).default([]),
  places: z.array(placeSchema).max(100).default([]),
  search: searchSpecSchema,
  profile: profileSchema,
  itinerary: itinerarySchema.nullable(),
  mode: z.enum(["gemini", "demo"]).nullable().default(null),
  acceptedIds: z.array(googleIdSchema).max(25).default([]),
  googlePlaceIds: z.array(googleIdSchema).max(25).default([]),
});
export type JourneySnapshot = z.infer<typeof journeySnapshotSchema>;

// Old snapshots included provider-specific place records. Recover the user's
// choices and preferences without trusting stale catalog content or guessing IDs.
export function readStoredJourney(
  value: unknown,
): { snapshot: JourneySnapshot; legacyVisits: boolean } | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const envelope = z
    .object({
      version: z.number().optional(),
      action: z.enum(["explore", "plan", "clarify"]).optional(),
      search: z.record(z.string(), z.unknown()),
      profile: z.record(z.string(), z.unknown()),
      itinerary: z.unknown().optional(),
      acceptedIds: z.array(z.string()).max(25).optional(),
      googlePlaceIds: z.array(z.string()).max(25).optional(),
      mode: z.enum(["gemini", "demo"]).nullable().optional(),
    })
    .safeParse(value);
  if (!envelope.success || (envelope.data.version ?? 1) > 2) return null;
  const data = envelope.data;
  const profile = profileSchema.safeParse({ ...emptyProfile, ...data.profile });
  const search = searchSpecSchema.safeParse({
    ...data.search,
    reference: undefined,
  });
  if (!profile.success || !search.success) return null;
  const previousIds = data.acceptedIds ?? data.googlePlaceIds ?? [];
  const acceptedIds = [
    ...new Set(
      previousIds.filter((id) => googleIdSchema.safeParse(id).success),
    ),
  ];
  const legacyVisits = previousIds.some(
    (id) => !googleIdSchema.safeParse(id).success,
  );
  const itinerary = itinerarySchema.safeParse(data.itinerary);
  return {
    legacyVisits,
    snapshot: journeySnapshotSchema.parse({
      version: 2,
      action: data.action,
      results: [],
      places: [],
      search: {
        ...search.data,
        ...(data.search.reference
          ? { center: undefined, near: undefined }
          : {}),
      },
      profile: profile.data,
      itinerary:
        itinerary.success &&
        itinerary.data.days.every((day) =>
          day.stops.every((stop) => acceptedIds.includes(stop.placeId)),
        )
          ? itinerary.data
          : null,
      mode: data.mode ?? null,
      acceptedIds,
      googlePlaceIds: acceptedIds,
    }),
  };
}
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
    version: 2 as const,
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
