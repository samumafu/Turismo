import {
  chatRequestSchema,
  missingFields,
  type ChatResponse,
} from "@/lib/schemas";
import { dynamicReply, validatePlan } from "@/lib/planning";
import { deduplicatePlaces } from "@/lib/osm";
import {
  interpretSearch,
  searchSpecSchema,
  normalize,
  haversine,
  searchZones,
  categoryLabels,
  type SearchSpec,
} from "@/lib/places";
import { discoverPlaces, resolvePlaces } from "@/lib/server/discovery";
import {
  errorResponse,
  guardRequest,
  HttpError,
  readJson,
} from "@/lib/server/guard";
import {
  geminiReply,
  interpretDiscovery,
  geminiFailureNotice,
} from "@/lib/server/gemini";

export const maxDuration = 75;
const json = (body: ChatResponse) =>
  Response.json(body, { headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    guardRequest(request, "chat");
    const parsed = chatRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Revisa los datos de la conversación y del viaje.",
      );
    const input = parsed.data;
    const previousProfile = input.profile;
    const previousSearch = input.search ?? searchSpecSchema.parse({});
    const text = normalize(input.messages.at(-1)!.content);
    let search = interpretSearch(
      input.messages.at(-1)!.content,
      previousSearch,
    );
    const draft = dynamicReply(input, []);
    let action: ChatResponse["action"] =
      /itinerario|plan|agenda|recorrido|presupuesto|\bdias?\b|reemplaza|sustituye|anade|agrega/.test(
        text,
      )
        ? "plan"
        : /restaurante|museo|natural|cocha|cascada|mirador|cafeteria|hotel|parque|iglesia|lugar|busca|encuentra/.test(
              text,
            )
          ? "explore"
          : "clarify";
    let message = draft.message;
    input.profile = draft.profile;
    const key = input.demo ? undefined : process.env.GEMINI_API_KEY?.trim();
    let canUseGemini = !!key;
    let notice: string | null = key
      ? null
      : "Asistente sin IA: búsqueda real en OpenStreetMap y planificación por reglas.";
    if (key) {
      try {
        const intent = await interpretDiscovery(input, key, search);
        search = intent.search;
        input.profile = intent.profile;
        action = intent.action;
        message = intent.message;
      } catch (error) {
        canUseGemini = false;
        notice = geminiFailureNotice(error);
      }
    }
    if (
      action === "clarify" ||
      (action === "plan" && missingFields(input.profile).length)
    ) {
      const missing = missingFields(input.profile);
      return json({
        message:
          canUseGemini && action === "clarify"
            ? message
            : missing.length
              ? `Para organizar tu itinerario, cuéntame ${missing.join("; ")}. También puedes pedirme buscar lugares sin completar un plan.`
              : "¿Qué te gustaría buscar o cambiar de tu viaje?",
        profile: input.profile,
        itinerary: null,
        action: "clarify",
        mode: canUseGemini ? "gemini" : "demo",
        notice,
        places: [],
        search,
      });
    }
    const found = await discoverPlaces(search);
    if (action === "explore") {
      const context = `${search.categories.map((c) => categoryLabels[c].toLowerCase()).join(", ")} en ${searchZones[search.zone].label}${search.center ? " (zona del mapa)" : ""}`;
      return json({
        message: found.total
          ? `Encontré ${found.total}${found.truncated ? "+" : ""} coincidencias de ${context}. Te muestro ${found.places.length} lugares con sus ubicaciones. Puedes cambiar la zona, el radio o el tipo de lugar conversando; si quieres un itinerario, dímelo.`
          : `No encontré coincidencias de ${context} con estos filtros. Podemos ampliar el radio o buscar otra categoría. OSM puede no tener todos los lugares registrados.`,
        profile: input.profile,
        itinerary: null,
        action,
        mode: canUseGemini ? "gemini" : "demo",
        notice:
          [notice, found.notice].filter(Boolean).join(" ").slice(0, 400) ||
          null,
        places: found.places,
        search: found.spec,
        discovery: {
          total: found.total,
          source: found.source,
          observedAt: found.observedAt,
        },
      });
    }
    const signature = (s: SearchSpec) =>
      JSON.stringify([
        s.zone,
        s.center ?? null,
        s.radius,
        [...s.categories].sort(),
        s.name,
        s.regionalFood,
      ]);
    const retainPrevious =
      signature(search) === signature(previousSearch) ||
      /reemplaza|sustituye|anade|agrega|incluye/.test(text);
    if (!retainPrevious) input.itinerary = null;
    const previousIds =
      input.itinerary?.days.flatMap((d) => d.stops.map((s) => s.placeId)) ?? [];
    const selected = await resolvePlaces([
      ...new Set([...previousIds, ...input.selectedIds]),
    ]);
    if (
      input.itinerary &&
      !validatePlan(input.itinerary, previousProfile, selected)
    )
      throw new HttpError(
        409,
        "No se pudieron validar los destinos anteriores. Inicia una nueva búsqueda.",
      );
    const center = search.center ?? searchZones[search.zone].center;
    const relevant = retainPrevious
      ? selected
      : selected.filter(
          (p) => haversine([...center], p.coordinates) <= search.radius,
        );
    const candidates = deduplicatePlaces([...relevant, ...found.places])
      .filter((p) => p.availability !== "restringido")
      .slice(0, 50);
    let reply = dynamicReply(input, candidates);
    let mode: ChatResponse["mode"] = "demo";
    if (key && canUseGemini) {
      try {
        reply = await geminiReply(input, key, candidates);
        mode = "gemini";
        if (
          !reply.itinerary &&
          !missingFields(reply.profile).length &&
          candidates.length
        ) {
          reply = dynamicReply(
            { ...input, profile: reply.profile },
            candidates,
          );
          mode = "demo";
          notice =
            "La IA no generó la agenda. Se organizó una propuesta por reglas con los mismos lugares consultados.";
        }
      } catch (error) {
        notice = geminiFailureNotice(error);
      }
    }
    return json({
      ...reply,
      action: "plan",
      mode,
      notice:
        [
          notice,
          found.notice,
          !candidates.length
            ? "No hay lugares aptos con estos filtros. Prueba otra zona, nombre o radio."
            : null,
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 400) || null,
      places: candidates,
      search: found.spec,
      discovery: {
        total: found.total,
        source: found.source,
        observedAt: found.observedAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
