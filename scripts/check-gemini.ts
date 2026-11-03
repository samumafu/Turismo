// Explicit live check: one real Gemini call, no Overpass and no sample POIs.
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { chatRequestSchema, missingFields } from "../src/lib/schemas";
import { geminiFailureNotice, geminiReply } from "../src/lib/server/gemini";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const key = process.env.GEMINI_API_KEY?.trim();
if (!key) {
  console.error(
    "Falta GEMINI_API_KEY. Configúrala en .env.local, junto a package.json.",
  );
  process.exitCode = 1;
} else {
  try {
    const input = chatRequestSchema.parse({
      messages: [{ role: "user", content: "Quiero conocer museos en Pasto." }],
    });
    const reply = await geminiReply(input, key, []);
    if (reply.itinerary !== null || !missingFields(reply.profile).length)
      throw new Error("A plan requires actual OSM candidates");
    console.log(
      `Gemini real OK (${process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"}): respuesta JSON validada y preguntas de seguimiento. Clave oculta. No se consultó Overpass.`,
    );
  } catch (error) {
    console.error(geminiFailureNotice(error));
    process.exitCode = 1;
  }
}
