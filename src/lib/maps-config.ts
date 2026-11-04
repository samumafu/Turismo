// Public selection only. The Places/Routes server key never belongs in this module.
export const usesGoogleMaps = () =>
  process.env.NEXT_PUBLIC_PLACES_PROVIDER === "google";
