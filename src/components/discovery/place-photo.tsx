"use client";
import Image from "next/image";
import { useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { googleAuthorSchema, type Place } from "@/lib/places";
import { Button } from "@/components/ui/button";
const schema = z.object({
  photo: z
    .object({
      provider: z.literal("google"),
      url: z
        .string()
        .url()
        .refine((value) => {
          const u = new URL(value);
          return (
            u.protocol === "https:" &&
            (u.hostname === "googleusercontent.com" ||
              u.hostname.endsWith(".googleusercontent.com"))
          );
        }),
      page: z.string().url().startsWith("https://www.google.com/maps/"),
      authors: z.array(googleAuthorSchema),
    })
    .nullable(),
});
export function PlacePhoto({ place }: { place: Place }) {
  const [data, setData] = useState<z.infer<typeof schema> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/places/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(place),
        signal: AbortSignal.timeout(22000),
      });
      const body = await response.json();
      if (!response.ok) {
        const failure = z
          .object({ error: z.string().max(400) })
          .safeParse(body);
        setError(
          failure.success
            ? failure.data.error
            : "No se pudo cargar la foto. Intenta de nuevo.",
        );
        return;
      }
      setData(schema.parse(body));
    } catch {
      setError(
        "No se pudo cargar la foto. Comprueba la conexión e intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="place-photo-block">
      {data?.photo ? (
        <figure>
          <a href={data.photo.page} target="_blank" rel="noopener noreferrer">
            <Image
              unoptimized
              src={data.photo.url}
              alt={place.name}
              width={640}
              height={360}
              className="place-photo-image"
              onError={() => {
                setData(null);
                setError(
                  "La foto caducó o no se pudo cargar. Vuelve a consultar el lugar.",
                );
              }}
            />
          </a>
          <figcaption>
            <a
              href={data.photo.page}
              target="_blank"
              rel="noopener noreferrer"
              translate="no"
            >
              Google Maps
            </a>
            {data.photo.authors.map((author, index) => (
              <span key={index}>
                {" · "}
                {author.uri ? (
                  <a
                    href={author.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {author.displayName}
                  </a>
                ) : (
                  author.displayName
                )}
              </span>
            ))}
          </figcaption>
        </figure>
      ) : data ? (
        <p className="map-note">No hay foto disponible para este lugar.</p>
      ) : (
        <Button variant="ghost" size="sm" onClick={load} disabled={busy}>
          {busy ? (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Camera data-icon="inline-start" aria-hidden="true" />
          )}
          {busy ? "Cargando foto…" : "Ver foto del lugar"}
        </Button>
      )}
      {error ? (
        <p role="status" className="map-note">
          {error}
        </p>
      ) : null}
    </div>
  );
}
