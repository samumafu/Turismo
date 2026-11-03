import { haversine, normalize, type Place } from "@/lib/places";
import {
  missingFields,
  type ChatRequest,
  type Itinerary,
  type Profile,
} from "@/lib/schemas";

const numberWords: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
};
const count = (value: string) => numberWords[value] ?? Number(value);

export function extractDemoProfile(text: string, previous: Profile): Profile {
  const t = normalize(text);
  const p = { ...previous, interests: [...previous.interests] };
  const days = t.match(
    /(\d+|un|uno|dos|tres|cuatro|cinco|seis|siete)\s*dias?\b/,
  );
  if (days) p.days = Math.min(5, Math.max(1, count(days[1])));
  if (/medio dia/.test(t)) {
    p.days = 1;
    p.hoursPerDay = 4;
  }
  const hours = t.match(/(\d+)\s*horas?\b/);
  if (hours) {
    p.hoursPerDay = Math.min(10, Math.max(2, Number(hours[1])));
    p.days ??= 1;
  }
  const budget =
    t.match(
      /(?:presupuesto(?: de| a)?\s*|\$\s*)([\d.,]+)\s*(millones?|mil|k)?/,
    ) ?? t.match(/([\d.,]+)\s*(millones?|mil|k)?\s*(?:cop|pesos)\b/);
  if (budget) {
    const raw = budget[1];
    const n = budget[2]
      ? Number(raw.replace(",", "."))
      : Number(raw.replace(/[.,]/g, ""));
    p.budgetCOP = Math.min(
      50000000,
      Math.max(
        0,
        Math.round(
          n * (/millon/.test(budget[2] ?? "") ? 1000000 : budget[2] ? 1000 : 1),
        ),
      ),
    );
  }
  if (/sin (?:gastar|presupuesto)|presupuesto cero/.test(t)) p.budgetCOP = 0;
  if (/por persona|cada uno/.test(t)) p.budgetScope = "persona";
  if (/para (?:todo )?el grupo|en total|presupuesto total|para ambos/.test(t))
    p.budgetScope = "grupo";
  const travelers =
    t.match(
      /(?:somos|viajamos|para)\s*(\d+|uno|dos|tres|cuatro|cinco|seis)\b/,
    ) ?? t.match(/(\d+)\s*personas/);
  if (travelers) p.travelers = Math.min(30, Math.max(1, count(travelers[1])));
  if (/viajo sol[oa]|voy sol[oa]/.test(t)) p.travelers = 1;
  if (/pareja|ambos/.test(t)) p.travelers = 2;
  if (/a pie|caminando/.test(t)) p.transport = "a-pie";
  if (/carro|coche|vehiculo/.test(t)) p.transport = "carro";
  if (/transporte publico|en bus|autobus/.test(t)) p.transport = "publico";
  if (/naturaleza|laguna|cocha|paisaje|aire libre/.test(t))
    p.interests.push("naturaleza");
  if (/cultura|museo|arte|carnaval/.test(t)) p.interests.push("cultura");
  if (/lajas|iglesia|templo|arquitectura|patrimonio/.test(t))
    p.interests.push("patrimonio");
  if (/gastronomia|comida|comer/.test(t)) p.interests.push("gastronomía");
  p.interests = [...new Set(p.interests)].slice(-8);
  p.preferences = text.slice(0, 700);
  return p;
}

export function makeDynamicPlan(
  p: Profile,
  candidates: Place[],
  previous: Itinerary | null,
  text: string,
): Itinerary | null {
  const t = normalize(text);
  let available = candidates.filter((v) => v.availability !== "restringido");
  const excluded = available
    .filter((v) =>
      [
        ...t.matchAll(/(?:quita|elimina|reemplaza|cambia|sin|evita)[^.!?]*/g),
      ].some((m) => m[0].split(/ por /)[0].includes(normalize(v.name))),
    )
    .map((v) => v.id);
  available = available.filter((v) => !excluded.includes(v.id));
  const byId = new Map(available.map((v) => [v.id, v]));
  if (!available.length) return null;
  const reused =
    previous?.days.flatMap((d) =>
      d.stops.map((s) => byId.get(s.placeId)).filter((v): v is Place => !!v),
    ) ?? [];
  const ordered = [
    ...new Map([...reused, ...available].map((v) => [v.id, v])).values(),
  ];
  const groups: Place[][] = [];
  let queue = [...ordered];
  const limit = (p.hoursPerDay ?? 8) <= 4 ? 2 : 3;
  for (let d = 0; d < (p.days ?? 1); d++) {
    const first = queue.shift() ?? ordered[d % ordered.length];
    const group = [first];
    const maxDistance = p.transport === "a-pie" ? 3000 : 15000;
    for (const next of [...queue]) {
      if (group.length >= limit) break;
      if (haversine(first.coordinates, next.coordinates) <= maxDistance) {
        group.push(next);
        queue = queue.filter((v) => v.id !== next.id);
      }
    }
    groups.push(group);
  }
  return {
    title: "Tu recorrido entre lugares de Nariño",
    days: groups.map((group, index) => {
      let elapsed = 0;
      const stops = group.flatMap((place) => {
        const duration = Math.min(place.visitMinutes ?? 60, 90);
        if (elapsed + duration > (p.hoursPerDay ?? 8) * 60) return [];
        const start = 540 + elapsed;
        elapsed += duration + 45;
        return [
          {
            placeId: place.id,
            suggestedTime:
              String(Math.floor(start / 60)).padStart(2, "0") +
              ":" +
              String(start % 60).padStart(2, "0"),
            durationMinutes: duration,
            activity: place.description,
          },
        ];
      });
      return { day: index + 1, title: "Explorar " + group[0].region, stops };
    }),
    recommendations: [
      "Los lugares provienen de OpenStreetMap. Sus etiquetas comunitarias no prueban apertura, calidad ni disponibilidad.",
      "Los horarios de este plan son sugeridos; confirma horarios reales, tarifas, accesos y transporte.",
      "La separación entre visitas es un margen de planificación, no un tiempo de viaje calculado. Consulta la ruta vial o el enlace externo.",
      "Las provisiones se reparten desde tu presupuesto; no son precios verificados y no garantizan que cubran el viaje.",
      "Si faltan resultados, amplía o cambia la zona de búsqueda. No se completa el plan con lugares inventados.",
    ],
  };
}

export function dynamicReply(request: ChatRequest, candidates: Place[]) {
  const text = request.messages.at(-1)!.content;
  const profile = extractDemoProfile(text, request.profile);
  const countDays = normalize(text).match(/(\d+|seis|siete)\s*dias?\b/);
  if (countDays && (count(countDays[1]) < 1 || count(countDays[1]) > 5))
    return {
      message: "Elige de 1 a 5 días para organizar esta propuesta.",
      profile: request.profile,
      itinerary: null,
    };
  const missing = missingFields(profile);
  if (missing.length)
    return {
      message: `Para organizar tu plan, cuéntame ${missing.join("; ")}. También puedes buscar lugares mientras completas esos datos.`,
      profile,
      itinerary: null,
    };
  const itinerary = makeDynamicPlan(
    profile,
    candidates,
    request.itinerary,
    text,
  );
  return {
    message: itinerary
      ? `Propuesta de ${profile.days} días creada con lugares consultados en OpenStreetMap. ${profile.hoursPerDay ? "La agenda usa " + profile.hoursPerDay + " horas por día." : "La agenda usa hasta 8 horas por día como referencia."} Puedes cambiar el presupuesto, reducir días o buscar otros lugares. Si hay pocos resultados, se pueden repetir destinos entre jornadas; amplía la búsqueda para variar.`
      : "No se encontraron candidatos aptos para este plan. Cambia de categoría, zona o radio.",
    profile,
    itinerary,
  };
}
export function validatePlan(
  plan: Itinerary,
  profile: Profile,
  candidates: Place[] = [],
): boolean {
  if (missingFields(profile).length || plan.days.length !== profile.days)
    return false;
  const byId = new Map(candidates.map((v) => [v.id, v]));
  return plan.days.every((day, index) => {
    if (day.day !== index + 1 || !day.stops.length) return false;
    let end = 0;
    const ids = new Set<string>();
    const firstTime = day.stops[0].suggestedTime.split(":").map(Number);
    const firstPlace = byId.get(day.stops[0].placeId);
    if (!firstPlace) return false;
    return day.stops.every((s) => {
      const place = byId.get(s.placeId);
      if (!place || place.availability === "restringido" || ids.has(s.placeId))
        return false;
      if (
        haversine(firstPlace.coordinates, place.coordinates) >
        (profile.transport === "a-pie" ? 3500 : 25000)
      )
        return false;
      ids.add(s.placeId);
      const [h, m] = s.suggestedTime.split(":").map(Number);
      const start = h * 60 + m;
      if (start < end || start < 420 || start + s.durationMinutes > 1140)
        return false;
      end = start + s.durationMinutes;
      return (
        end - (firstTime[0] * 60 + firstTime[1]) <=
        (profile.hoursPerDay ?? 8) * 60
      );
    });
  });
}
