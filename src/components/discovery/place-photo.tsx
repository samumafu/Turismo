"use client";
import Image from "next/image";
import { useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { googleAuthorSchema, isGooglePlace, type Place } from "@/lib/places";
import { Button } from "@/components/ui/button";
const schema = z.object({
  photo: z
    .union([
      z.object({
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
      }),
      z.object({
        url: z
          .string()
          .url()
          .refine(
            (url) =>
              new URL(url).protocol === "https:" &&
              ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(
                new URL(url).hostname,
              ),
          ),
        page: z.string().url().startsWith("https://commons.wikimedia.org/"),
        author: z.string(),
        license: z.string(),
        licenseUrl: z.string().url(),
      }),
    ])
    .nullable(),
});
export function PlacePhoto({ place }: { place: Place }) {
  const [data, setData] = useState<z.infer<typeof schema> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/places/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(place),
        signal: AbortSignal.timeout(22000),
      });
      if (!r.ok) {
        const failure = z
          .object({ error: z.string().max(400) })
          .safeParse(await r.json());
        setError(
          failure.success
            ? failure.data.error
            : "No se pudo consultar la foto. Puedes ver imágenes en Google Maps.",
        );
        return;
      }
      setData(schema.parse(await r.json()));
    } catch {
      setError(
        "No se pudo consultar la foto. Puedes ver imágenes en Google Maps.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="place-photo-block">
      {data?.photo && "provider" in data.photo ? (
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
      ) : data?.photo && "author" in data.photo ? (
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
                setError("La foto no está disponible temporalmente.");
              }}
            />
          </a>
          <figcaption>
            {data.photo.author} ·{" "}
            <a
              href={data.photo.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {data.photo.license}
            </a>{" "}
            ·{" "}
            <a href={data.photo.page} target="_blank" rel="noopener noreferrer">
              Wikimedia Commons
            </a>
          </figcaption>
        </figure>
      ) : data ? (
        <p className="map-note">
          {isGooglePlace(place)
            ? "Google Maps no ofrece una foto para este lugar en esta consulta."
            : "Sin fotografía con licencia verificada. Puedes ver fotos en Google Maps."}
        </p>
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
          {busy ? "Consultando foto…" : "Ver foto del lugar"}
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
