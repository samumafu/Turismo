"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImageOff, LoaderCircle, RefreshCw } from "lucide-react";
import type { Place } from "@/lib/places";
import { loadPlacePhoto, type PlacePhotoData } from "@/lib/place-photos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function PlacePhoto({
  place,
  eager = false,
}: {
  place: Place;
  eager?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<PlacePhotoData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!place.googlePhoto) return;
    let active = true;
    let started = false;
    const load = () => {
      if (started || !active) return;
      started = true;
      setStatus("loading");
      void loadPlacePhoto(place)
        .then((value) => {
          if (active) {
            setPhoto(value);
            setStatus("ready");
          }
        })
        .catch(() => {
          if (active) setStatus("error");
        });
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        load();
        observer.disconnect();
      }
    });
    if (eager) queueMicrotask(load);
    else if (element.current) observer.observe(element.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [place, eager, attempt]);
  const caption = photo ? (
    <>
      <span translate="no">Google Maps</span>
      {photo.authors.map((author, index) => (
        <span key={index}>
          {" "}
          ·{" "}
          {author.uri ? (
            <a href={author.uri} target="_blank" rel="noopener noreferrer">
              {author.displayName}
            </a>
          ) : (
            author.displayName
          )}
        </span>
      ))}
    </>
  ) : null;
  return (
    <div className="place-photo-block" ref={element}>
      <figure>
        <div className="place-photo-frame">
          {photo ? (
            <button
              type="button"
              className="place-photo-zoom"
              aria-label={`Ampliar imagen de ${place.name}`}
              onClick={() => setExpanded(true)}
            >
              <Image
                unoptimized
                src={photo.url}
                alt={place.name}
                width={640}
                height={400}
                className="place-photo-image"
                onError={() => {
                  setPhoto(null);
                  setStatus("error");
                }}
              />
            </button>
          ) : (
            <div className="place-photo-placeholder">
              {place.googlePhoto && status !== "error" && status !== "ready" ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  <span>Cargando imagen</span>
                </>
              ) : (
                <>
                  <ImageOff aria-hidden="true" />
                  <span>
                    {status === "error"
                      ? "Imagen no disponible"
                      : "Sin imagen disponible"}
                  </span>
                </>
              )}
              {status === "error" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAttempt((value) => value + 1)}
                  aria-label={`Reintentar imagen de ${place.name}`}
                >
                  <RefreshCw aria-hidden="true" /> Reintentar
                </Button>
              ) : null}
            </div>
          )}
        </div>
        <figcaption>{caption}</figcaption>
      </figure>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="photo-dialog">
          <DialogTitle>{place.name}</DialogTitle>
          <DialogDescription>Imagen del lugar</DialogDescription>
          {photo ? (
            <Image
              unoptimized
              src={photo.url}
              alt={place.name}
              width={960}
              height={640}
              className="photo-expanded"
            />
          ) : null}
          <p className="photo-credit">{caption}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
