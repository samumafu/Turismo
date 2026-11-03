"use client";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  Search,
  LoaderCircle,
  Check,
  MapPin,
} from "lucide-react";
import {
  categoryKeys,
  categoryLabels,
  interpretSearch,
  mapsLink,
  searchResponseSchema,
  searchSpecSchema,
  searchZones,
  zoneKeys,
  type SearchResponse,
  type SearchSpec,
} from "@/lib/places";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { Viewport } from "./place-map";
const PlaceMap = dynamic(() => import("./place-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[480px] w-full" />,
});
export function DiscoveryExplorer({
  onResults,
  onUseSelection,
}: {
  onResults: (result: SearchResponse) => void;
  onUseSelection: (ids: string[], search: SearchSpec) => void;
}) {
  const [spec, setSpec] = useState<SearchSpec>(searchSpecSchema.parse({}));
  const [text, setText] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<Viewport | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = searchSpecSchema.safeParse({
      zone: params.get("zona") || "pasto",
      categories: [params.get("categoria") || "turismo"],
    });
    if (parsed.success)
      queueMicrotask(() => {
        setSpec(parsed.data);
        setText(params.get("q") || "");
      });
    return () => controller.current?.abort();
  }, []);
  const toggle = useCallback(
    (id: string) =>
      setSelected((items) =>
        items.includes(id)
          ? items.filter((v) => v !== id)
          : items.length < 5
            ? [...items, id]
            : items,
      ),
    [],
  );
  async function search(next: SearchSpec = spec, offset = 0, input = text) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setSelected([]);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, spec: next, offset }),
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(22000)]),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo consultar OpenStreetMap.");
      const data = searchResponseSchema.parse(body);
      if (current.signal.aborted) return;
      setResult(data);
      setSpec(data.spec);
      onResults(data);
      const url = new URL(window.location.href);
      url.search = new URLSearchParams({
        zona: data.spec.zone,
        categoria: data.spec.categories[0],
        q: input,
      }).toString();
      window.history.replaceState(null, "", url);
    } catch (e) {
      if (!current.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "La búsqueda no respondió. Vuelve a intentar.",
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setSelected([]);
    void search(interpretSearch(text, spec));
  }
  const active = result?.spec ?? spec;
  const center = [...(active.center ?? searchZones[active.zone].center)] as [
    number,
    number,
  ];
  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div className="discovery-intro">
        <h2 id="discovery-title">Encuentra tu próximo lugar</h2>
        <p>
          Busca en los datos abiertos de OpenStreetMap. Explora por zona, nombre
          o categoría; cada consulta carga una página de hasta 50 lugares.
        </p>
      </div>
      <form className="discovery-form" onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="place-search">
              ¿Qué te gustaría encontrar?
            </FieldLabel>
            <Input
              id="place-search"
              name="place-search"
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              placeholder="Cascadas cerca de Pasto…"
            />
          </Field>
          <FieldGroup className="discovery-filters">
            <Field>
              <FieldLabel htmlFor="search-zone">Zona</FieldLabel>
              <select
                id="search-zone"
                name="zone"
                value={spec.zone}
                onChange={(e) => {
                  setSpec({
                    ...spec,
                    zone: e.target.value as SearchSpec["zone"],
                    center: undefined,
                  });
                  setText("");
                }}
              >
                {zoneKeys.map((key) => (
                  <option value={key} key={key}>
                    {searchZones[key].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="search-category">Categoría</FieldLabel>
              <select
                id="search-category"
                name="category"
                value={spec.categories[0]}
                onChange={(e) => {
                  setSpec({
                    ...spec,
                    categories: [
                      e.target.value as SearchSpec["categories"][number],
                    ],
                    regionalFood: false,
                    name: "",
                  });
                  setText("");
                }}
              >
                {categoryKeys.map((key) => (
                  <option key={key} value={key}>
                    {categoryLabels[key]}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="search-radius">Radio</FieldLabel>
              <select
                id="search-radius"
                name="radius"
                value={spec.radius}
                onChange={(e) =>
                  setSpec({ ...spec, radius: Number(e.target.value) })
                }
              >
                {![1000, 3000, 8000, 15000, 25000].includes(spec.radius) ? (
                  <option value={spec.radius}>
                    {(spec.radius / 1000).toFixed(1)} km (mapa)
                  </option>
                ) : null}
                {[1000, 3000, 8000, 15000, 25000].map((r) => (
                  <option key={r} value={r}>
                    {r / 1000} km
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle data-icon="inline-start" aria-hidden="true" />
              ) : (
                <Search data-icon="inline-start" aria-hidden="true" />
              )}
              {busy ? "Buscando…" : "Buscar lugares"}
            </Button>
          </FieldGroup>
        </FieldGroup>
      </form>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo completar la búsqueda</AlertTitle>
          <AlertDescription>
            {error}{" "}
            <button className="inline-link" onClick={() => search()}>
              Reintentar
            </button>
          </AlertDescription>
        </Alert>
      ) : null}
      {busy ? (
        <p role="status" className="discovery-status">
          Consultando OpenStreetMap por zona y categoría…
        </p>
      ) : null}
      {result?.notice ? (
        <Alert>
          <AlertDescription>{result.notice}</AlertDescription>
        </Alert>
      ) : null}
      <div className="discovery-layout">
        <div className="discovery-results">
          <div className="discovery-results-heading" aria-live="polite">
            <strong>
              {result
                ? `${result.total}${result.truncated ? "+" : ""} resultados en esta consulta`
                : "Busca para descubrir lugares"}
            </strong>
            {result ? (
              <span>
                {result.source === "overpass"
                  ? "Consulta OSM"
                  : result.source === "stale-cache"
                    ? "Caché temporal anterior"
                    : "Caché temporal OSM"}
              </span>
            ) : null}
          </div>
          {result?.places.length ? (
            <ol className="discovery-list">
              {result.places.map((place, index) => (
                <li key={place.id}>
                  <article>
                    <div className="discovery-result-top">
                      <span>{index + 1}</span>
                      <div>
                        <small>{place.category}</small>
                        <h3>{place.name}</h3>
                      </div>
                    </div>
                    <p>
                      {place.region}
                      {place.cuisine
                        ? ` · Cocina declarada en OSM: ${place.cuisine}`
                        : ""}
                    </p>
                    <details>
                      <summary>Datos y procedencia</summary>
                      <p>{place.description}</p>
                      <p>{place.note}</p>
                      <p>
                        Horarios declarados en OSM:{" "}
                        {place.openingHours ?? "sin datos"}. Tarifas y
                        disponibilidad por confirmar.
                      </p>
                      <p>
                        Coordenadas: {place.coordinates.join(", ")}
                        {place.coordinateKind === "center"
                          ? " (centro del objeto, no entrada)"
                          : " (nodo OSM)"}
                        .
                      </p>
                      <a
                        href={place.sources[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {place.id} <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    </details>
                    <div className="discovery-result-actions">
                      <a
                        href={mapsLink(place)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google Maps{" "}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                      <Button
                        size="sm"
                        variant={
                          selected.includes(place.id) ? "secondary" : "outline"
                        }
                        disabled={
                          place.availability === "restringido" ||
                          (!selected.includes(place.id) && selected.length >= 5)
                        }
                        onClick={() => toggle(place.id)}
                      >
                        {selected.includes(place.id) ? (
                          <Check data-icon="inline-start" aria-hidden="true" />
                        ) : null}
                        {place.availability === "restringido"
                          ? "Acceso restringido"
                          : selected.includes(place.id)
                            ? "Seleccionado"
                            : "Añadir al viaje"}
                      </Button>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          ) : !busy ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {result
                    ? "Sin coincidencias en esta zona"
                    : "Busca lugares en OpenStreetMap"}
                </EmptyTitle>
                <EmptyDescription>
                  {result
                    ? "Cambia el radio, la categoría o el nombre. OSM puede no tener registrado lo que buscas."
                    : "Usa los filtros para buscar lugares en OpenStreetMap."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
          {result ? (
            <div className="discovery-pagination">
              <Button
                variant="outline"
                disabled={
                  busy ||
                  !result ||
                  (result.nextOffset === null && result.places.length === 0) ||
                  (result.nextOffset ?? result.total) - result.places.length <=
                    0
                }
                onClick={() =>
                  search(
                    result.spec,
                    Math.max(
                      0,
                      (result.nextOffset ?? result.total) -
                        result.places.length -
                        50,
                    ),
                    "",
                  )
                }
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={busy || result.nextOffset === null}
                onClick={() => search(result.spec, result.nextOffset!, "")}
              >
                Siguiente página
              </Button>
            </div>
          ) : null}
        </div>
        <aside className="discovery-map-panel">
          <PlaceMap
            places={result?.places ?? []}
            center={center}
            radius={active.radius}
            onMove={setView}
            onSelect={toggle}
          />
          <Button
            className="w-full mt-3"
            variant="outline"
            disabled={busy || !view}
            onClick={() => {
              if (view) {
                setSelected([]);
                void search(
                  {
                    ...spec,
                    center: view.center,
                    radius: view.radius,
                    name: "",
                  },
                  0,
                  "",
                );
              }
            }}
          >
            <MapPin data-icon="inline-start" aria-hidden="true" />
            Buscar en esta zona del mapa
          </Button>
          {selected.length ? (
            <div className="discovery-selection">
              <strong>{selected.length} lugares seleccionados</strong>
              <Button onClick={() => onUseSelection(selected, active)}>
                Planear desde esta selección{" "}
                <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
