import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { placeSchema, type Place } from "@/lib/places";

// A configured server secret works across Vercel functions. The local fallback only lasts for this process.
const ephemeral = randomBytes(32).toString("hex");
function signature(place: Place) {
  const key =
    process.env.PLACE_SIGNING_SECRET?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    ephemeral;
  const { verification, ...data } = placeSchema.parse(place);
  void verification;
  return createHmac("sha256", key)
    .update(JSON.stringify(data))
    .digest("base64url");
}
export function signPlace(place: Place): Place {
  return { ...place, verification: signature(place) };
}
export function isVerifiedPlace(place: Place) {
  const age = Date.now() - Date.parse(place.observedAt);
  if (!place.verification || age < -60000 || age > 30 * 60000) return false;
  const expected = Buffer.from(signature(place));
  const actual = Buffer.from(place.verification);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
