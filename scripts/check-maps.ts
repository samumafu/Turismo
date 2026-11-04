// Explicit live check: one search, no photos or routes.
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { searchSpecSchema } from "../src/lib/places";
import { discoverGooglePlaces } from "../src/lib/server/google-maps";
if (existsSync(".env.local")) loadEnvFile(".env.local");
if (
  !process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
  !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
) {
  console.error(
    "Faltan claves. Completa GOOGLE_MAPS_SERVER_API_KEY y NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env.local. No pegues claves en el chat.",
  );
  process.exitCode = 1;
} else {
  try {
    const result = await discoverGooglePlaces(
      searchSpecSchema.parse({ categories: ["museos"], radius: 3000 }),
    );
    console.log(
      `Google Places responde: ${result.total} museos dentro de 3 km de Pasto. Claves ocultas. No se solicitaron fotos ni rutas.`,
    );
    if (process.env.NEXT_PUBLIC_PLACES_PROVIDER !== "google")
      console.log(
        "Para activar Google en la app: NEXT_PUBLIC_PLACES_PROVIDER=google; después reinicia o vuelve a desplegar.",
      );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "No se pudo comprobar Google Maps.",
    );
    process.exitCode = 1;
  }
}
