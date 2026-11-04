import { type Place } from "@/lib/places";
export function GoogleAttribution({ places }: { places: Place[] }) {
  const google = places;
  if (!google.length) return null;
  const providers = [
    ...new Map(
      google
        .flatMap((p) => p.googleAttributions ?? [])
        .map((p) => [p.provider + p.providerUri, p]),
    ).values(),
  ];
  return (
    <p className="google-maps-attribution">
      <strong translate="no">Google Maps</strong>
      {providers.map((p) => (
        <span key={p.provider + p.providerUri}>
          {" · "}
          {p.providerUri ? (
            <a href={p.providerUri} target="_blank" rel="noopener noreferrer">
              {p.provider}
            </a>
          ) : (
            p.provider
          )}
        </span>
      ))}
    </p>
  );
}
