import { z } from "zod";
import { osmIdSchema, placeSchema, searchSpecSchema } from "./places";

export const profileSchema = z.object({
  days: z.number().int().min(1).max(5).nullable(),
  hoursPerDay: z.number().int().min(2).max(10).nullable(),
  budgetCOP: z.number().int().min(0).max(50000000).nullable(),
  budgetScope: z.enum(["grupo", "persona"]).nullable(),
  travelers: z.number().int().min(1).max(30).nullable(),
  interests: z.array(z.string().max(70)).max(8),
  transport: z.enum(["a-pie", "carro", "publico"]).nullable(),
  preferences: z.string().max(700),
});
export const emptyProfile: z.infer<typeof profileSchema> = {
  days: null,
  hoursPerDay: null,
  budgetCOP: null,
  budgetScope: null,
  travelers: null,
  interests: [],
  transport: null,
  preferences: "",
};
export const stopSchema = z.object({
  placeId: osmIdSchema,
  suggestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(240),
  activity: z.string().min(1).max(400),
});
export const itinerarySchema = z.object({
  title: z.string().min(1).max(120),
  days: z
    .array(
      z.object({
        day: z.number().int().min(1).max(5),
        title: z.string().max(100),
        stops: z.array(stopSchema).min(1).max(5),
      }),
    )
    .min(1)
    .max(5),
  recommendations: z.array(z.string().max(400)).max(8),
});
export const modelResponseSchema = z.object({
  message: z.string().min(1).max(1800),
  profile: profileSchema,
  itinerary: itinerarySchema.nullable(),
});
export const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2500),
});
export const agreedOriginSchema = z.object({
  query: z.string().max(160),
  name: z.string().max(180),
  coordinates: z.tuple([
    z.number().min(-0.1).max(3),
    z.number().min(-79.5).max(-76.3),
  ]),
  confirmed: z.boolean(),
});
export const chatRequestSchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(16),
    profile: profileSchema.default(emptyProfile),
    itinerary: itinerarySchema.nullable().default(null),
    demo: z.boolean().default(false),
    search: searchSpecSchema.optional(),
    selectedIds: z.array(osmIdSchema).max(25).default([]),
    knownPlaces: z.array(placeSchema).max(75).optional(),
  })
  .refine(
    (v) => v.messages.at(-1)?.role === "user",
    "El último mensaje debe ser del viajero.",
  );
export const chatResponseSchema = modelResponseSchema.extend({
  action: z.enum(["explore", "plan", "clarify"]).default("plan"),
  mode: z.enum(["gemini", "demo"]),
  notice: z.string().max(400).nullable(),
  places: z.array(placeSchema).max(50).default([]),
  search: searchSpecSchema.optional(),
  selectedIds: z.array(osmIdSchema).max(25).optional(),
  origin: agreedOriginSchema.optional(),
  discovery: z
    .object({ total: z.number(), source: z.string(), observedAt: z.string() })
    .optional(),
});
export type Profile = z.infer<typeof profileSchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ChatMessage = z.infer<typeof messageSchema>;

export function missingFields(p: Profile) {
  return [
    p.days === null && "cuántos días tienes (de 1 a 5)",
    p.budgetCOP === null && "tu presupuesto en COP",
    p.budgetScope === null &&
      "si ese presupuesto es por persona o para todo el grupo",
    p.travelers === null && "cuántas personas viajan",
    !p.interests.length && "qué te gustaría conocer",
    p.transport === null && "si irás a pie, en carro o en transporte público",
  ].filter(Boolean) as string[];
}
