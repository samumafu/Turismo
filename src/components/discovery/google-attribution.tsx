import type { Place } from "@/lib/places";
export function GoogleAttribution({ places }: { places: Place[] }) {
  return places.length ? (
    <p className="google-maps-attribution">
      ©{" "}
      <a href="https://www.openstreetmap.org/copyright">
        OpenStreetMap contributors
      </a>
    </p>
  ) : null;
}
