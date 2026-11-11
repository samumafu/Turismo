import { chatRequestSchema, type ChatResponse } from "@/lib/schemas";
import { dynamicReply } from "@/lib/planning";
import { acceptedJourney } from "@/lib/accepted-journey";
import {
  interpretSearch,
  searchSpecSchema,
  normalize,
  formatTravel,
  searchZones,
  categoryLabels,
  locationReference,
} from "@/lib/places";
import { resolvePlaces } from "@/lib/server/discovery";
import { discoverReachablePlaces } from "@/lib/server/route-discovery";
import { isVerifiedPlace } from "@/lib/server/place-verification";
import { resolveSearchReference } from "@/lib/server/search-reference";
import {
  errorResponse,
  guardRequest,
  HttpError,
  readJson,
} from "@/lib/server/guard";
import { interpretDiscovery, geminiFailureNotice } from "@/lib/server/gemini";

export const maxDuration = 75;
const json = (body: ChatResponse) =>
  Response.json(body, { headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    guardRequest(request, "chat");
    const parsed = chatRequestSchema.safeParse(await readJson(request, 500000));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Revisa los datos de la conversación y del viaje.",
      );
    const input = parsed.data;
    const last = input.messages.at(-1)!.content;
    const text = normalize(last);
    let search = interpretSearch(
      last,
      input.search ?? searchSpecSchema.parse({}),
    );
    const draft = dynamicReply(input, []);
    input.profile = draft.profile;
    let action: ChatResponse["action"] =
      /cafe|restaurante|museo|natural|cocha|cascada|mirador|hotel|parque|iglesia|lugar|busca|encuentra/.test(
        text,
      )
        ? "explore"
        : /itinerario|plan|agenda|recorrido|presupuesto|elige|elijo|acepto|quita|agrega|anade|prefiero/.test(
              text,
            )
          ? "plan"
          : "clarify";
    let message = draft.message;
    const key = input.demo ? undefined : process.env.GEMINI_API_KEY?.trim();
    let mode: ChatResponse["mode"] = key ? "gemini" : "demo";
    let notice: string | null = key ? null : "Modo sin IA.";
    const known = (input.knownPlaces ?? []).filter(isVerifiedPlace);
    input.knownPlaces = known;
    let add: string[] = [];
    let remove: string[] = [];
    const namedReference = locationReference(last);
    let originQuery: string | undefined = namedReference;
    let proposedItinerary = input.itinerary;
    const originIntent =
      /salgo|salimos|saldre|parto|partimos|punto de partida|comenzamos desde|inicio desde|mi direccion|salida es|saldremos|como salida|(?:estoy|estamos|me encuentro|nos encontramos) (?:en|cerca|junto)/.test(
        text,
      ) ||
      (!!namedReference &&
        (input.selectedIds.length > 0 || action === "clarify"));
    const selectionIntent =
      /elijo|elige|acepto|escojo|me quedo|prefiero|quiero visitar|agrega|anade|incluye|quita|retira|elimina/.test(
        text,
      );
    if (key) {
      try {
        const intent = await interpretDiscovery(input, key, search);
        search = intent.search;
        input.profile = intent.profile;
        action = intent.action;
        message = intent.message;
        proposedItinerary = intent.itinerary ?? input.itinerary;
        if (selectionIntent) {
          add = intent.selection?.add ?? [];
          remove = intent.selection?.remove ?? [];
        }
        if (originIntent) originQuery ||= intent.originQuery || undefined;
      } catch (error) {
        mode = "demo";
        notice = geminiFailureNotice(error);
      }
    }
    // Keep explicit distances and category combinations even if the model rounds.
    const explicit = interpretSearch(last, search);
    search = {
      ...search,
      radius: explicit.radius,
      travelMode: explicit.travelMode,
      categories: explicit.categories,
      ...(namedReference
        ? {
            near: namedReference,
            center: undefined,
            reference: undefined,
            name: "",
          }
        : {}),
      ...(explicit.categories.length > 1
        ? { categories: explicit.categories, name: "" }
        : {}),
    };
    if (
      input.origin?.confirmed &&
      /cerca|cercan|aqui|mi ubicacion/.test(text) &&
      !search.near &&
      !Object.values(searchZones).some((zone) =>
        text.includes(normalize(zone.label.split(" / ")[0])),
      )
    )
      search.center = input.origin.coordinates;
    if (selectionIntent && !add.length && !remove.length) {
      const matches = known
        .filter((p) => text.includes(normalize(p.name)))
        .sort(
          (a, b) =>
            text.indexOf(normalize(a.name)) - text.indexOf(normalize(b.name)),
        );
      if (/quita|retira|elimina/.test(text)) remove = matches.map((p) => p.id);
      else add = matches.map((p) => p.id);
    }
    // A generic wish to visit a cafe is not acceptance of a specific model-chosen cafe.
    const named = new Set(
      known.filter((p) => text.includes(normalize(p.name))).map((p) => p.id),
    );
    const ordinal = text.match(
      /\b(?:el|la) (primero|primera|segundo|segunda|tercero|tercera)\b/,
    );
    if (ordinal) {
      const index = /primer/.test(ordinal[1])
        ? 0
        : /segund/.test(ordinal[1])
          ? 1
          : 2;
      if (known[index]) named.add(known[index].id);
    }
    add = add.filter((id) => named.has(id));
    remove = remove.filter((id) => named.has(id));
    const knownIds = new Set(known.map((p) => p.id));
    const selectedIds = [
      ...new Set([
        ...input.selectedIds.filter((id) => !remove.includes(id)),
        ...add.filter((id) => knownIds.has(id)),
      ]),
    ].slice(0, 25);
    const selected = selectedIds.length
      ? await resolvePlaces(selectedIds, known)
      : [];
    const itinerary = acceptedJourney(selectedIds, selected, proposedItinerary);
    let origin: ChatResponse["origin"];
    if (originIntent) {
      originQuery ||= last
        .match(
          /(?:desde|(?:salgo|salimos|parto|partimos) de|mi direcci[oó]n es|punto de partida (?:es|sera))\s+(.+?)(?:,|\s+y\s+(?:quiero|busca|luego)|$)/i,
        )?.[1]
        ?.trim()
        .slice(0, 160);
      if (originQuery) {
        const resolved = await resolveSearchReference({
          ...search,
          near: originQuery,
        });
        origin = {
          query: originQuery,
          name: resolved.reference!.name,
          coordinates: resolved.center!,
          confirmed: true,
        };
        search = {
          ...search,
          center: resolved.center,
          near: undefined,
          reference: undefined,
          name: "",
        };
      }
    }
    if (add.length || remove.length || (action === "plan" && selected.length)) {
      return json({
        message: origin
          ? `La ruta saldrá desde ${origin.name} hacia las visitas que elijas. Puedes cambiar la salida con un pin en el mapa.`
          : itinerary
            ? "Tu itinerario contiene únicamente las visitas que aceptaste. Puedes quitar o reordenar sus paradas."
            : "Tu itinerario está vacío. Elige los lugares que quieras visitar entre las opciones del mapa.",
        profile: input.profile,
        itinerary,
        action: origin ? "clarify" : "plan",
        mode,
        notice,
        places: selected,
        search,
        selectedIds,
        origin,
      });
    }
    if (action === "plan") action = "explore";
    if (
      action === "clarify" &&
      /cafe|parque|restaurante|museo|busca|encuentra/.test(text) &&
      !selectionIntent
    )
      action = "explore";
    if (
      action === "clarify" ||
      (origin &&
        !/busca|encuentra|recomienda|quiero (?:ir|visitar|un|una)|me gustaria/.test(
          text,
        ))
    ) {
      return json({
        message: origin
          ? `La ruta saldrá desde ${origin.name} hacia las visitas que elijas. Puedes cambiar la salida con un pin en el mapa.`
          : mode === "gemini"
            ? /\b\d+(?:[.,]\d+)?\s*(?:km|kilometros?|metros?)\b|linea recta/.test(
                normalize(message),
              )
              ? "Para comprobar la distancia por calles, dime desde dónde sales y a qué lugar quieres ir."
              : message
            : "¿Qué te gustaría buscar? Puedes elegir los lugares antes de organizar tu recorrido.",
        profile: input.profile,
        itinerary,
        action: "clarify",
        mode,
        notice,
        places: selected,
        search,
        selectedIds,
        origin,
      });
    }
    const found = await discoverReachablePlaces(search);
    search = found.spec;
    if (!origin && namedReference && search.reference && search.center) {
      origin = {
        query: namedReference,
        name: search.reference.name,
        coordinates: search.center,
        confirmed: true,
      };
    }
    const context =
      search.categories.map((c) => categoryLabels[c].toLowerCase()).join(", ") +
      (search.reference
        ? " cerca de " + search.reference.name
        : " en " + searchZones[search.zone].label);
    const suggestions = found.places
      .slice(0, 3)
      .map(
        (p) =>
          p.name +
          (p.travel
            ? " — " +
              formatTravel(p.travel) +
              " por calles desde " +
              p.travel.originName
            : ""),
      )
      .join("; ");
    return json({
      message: found.total
        ? "Encontré " +
          found.total +
          " coincidencias de " +
          context +
          ". " +
          suggestions +
          ". " +
          (origin ? `La ruta saldrá desde ${origin.name}. ` : "") +
          "Elige las que quieras visitar y visualiza tu recorrido dentro de la app."
        : "No encontré coincidencias con estos filtros. Podemos ampliar el radio o cambiar la zona.",
      profile: input.profile,
      itinerary,
      action: "explore",
      mode,
      notice:
        [notice, found.notice].filter(Boolean).join(" ").slice(0, 400) || null,
      places: found.places,
      search,
      selectedIds,
      origin,
      discovery: {
        total: found.total,
        source: found.source,
        observedAt: found.observedAt,
        nextPageToken: found.nextPageToken,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
