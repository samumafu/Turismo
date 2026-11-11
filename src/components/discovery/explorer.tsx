"use client";
import { useState, type FormEvent } from "react";
import { Search, LoaderCircle } from "lucide-react";
import {
  categoryKeys,
  categoryLabels,
  searchZones,
  zoneKeys,
  type SearchSpec,
} from "@/lib/places";
import { usePlanner } from "@/components/planner/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";

export function DiscoveryExplorer({ onComplete }: { onComplete: () => void }) {
  const { state, actions } = usePlanner();
  const [spec, setSpec] = useState<SearchSpec>(state.search);
  const [text, setText] = useState("");
  const [distance, setDistance] = useState(String(state.search.radius));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await actions.searchPlaces({ ...spec, radius: Number(distance) }, text))
      onComplete();
  }
  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div className="discovery-intro">
        <h2 id="discovery-title">Busca a tu medida</h2>
        <p>
          Ajusta la zona y la distancia. Verás los resultados en el mapa
          principal.
        </p>
      </div>
      <form className="discovery-form" onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="place-search">
              Lugar o idea para tu viaje
            </FieldLabel>
            <Input
              id="place-search"
              name="place-search"
              autoComplete="off"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={300}
              placeholder="Una cafetería y un parque cerca…"
              disabled={state.busy}
            />
          </Field>
          <FieldGroup className="discovery-filters">
            <Field>
              <FieldLabel htmlFor="search-zone">Zona</FieldLabel>
              <select
                id="search-zone"
                value={spec.zone}
                disabled={state.busy}
                onChange={(event) =>
                  setSpec({
                    ...spec,
                    zone: event.target.value as SearchSpec["zone"],
                    center: undefined,
                    near: undefined,
                    reference: undefined,
                  })
                }
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
                value={spec.categories[0]}
                disabled={state.busy}
                onChange={(event) =>
                  setSpec({
                    ...spec,
                    categories: [
                      event.target.value as SearchSpec["categories"][number],
                    ],
                    name: "",
                    regionalFood: false,
                  })
                }
              >
                {categoryKeys.map((key) => (
                  <option key={key} value={key}>
                    {categoryLabels[key]}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="search-radius">
                Distancia máxima (metros)
              </FieldLabel>
              <Input
                id="search-radius"
                name="radius"
                type="number"
                min={100}
                max={25000}
                step={1}
                required
                value={distance}
                disabled={state.busy}
                onChange={(event) => setDistance(event.target.value)}
              />
              <FieldDescription>
                Desde 100 m hasta 25 km por calles.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="search-travel-mode">
                Cómo te desplazas
              </FieldLabel>
              <select
                id="search-travel-mode"
                value={spec.travelMode}
                disabled={state.busy}
                onChange={(event) =>
                  setSpec({
                    ...spec,
                    travelMode: event.target.value as SearchSpec["travelMode"],
                  })
                }
              >
                <option value="walking">A pie</option>
                <option value="driving">En carro</option>
              </select>
            </Field>
          </FieldGroup>
          <div className="discovery-submit">
            <p>
              Distancias desde{" "}
              {spec.reference?.name ??
                (spec.center
                  ? "tu punto de búsqueda"
                  : `el centro de ${searchZones[spec.zone].label}`)}
              . Para cambiar el punto, indica una referencia en la búsqueda.
            </p>
            <Button type="submit" disabled={state.busy}>
              {state.busy ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Search data-icon="inline-start" aria-hidden="true" />
              )}
              {state.busy ? "Buscando…" : "Buscar lugares"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </section>
  );
}
