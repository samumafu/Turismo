// Synthetic responses only. Never imported by the application.
import { normalizeGooglePlace } from "../src/lib/server/google-maps";
export function routeMatrixFixture(init?: RequestInit) {
  const body = JSON.parse(String(init?.body));
  return body.origins.flatMap((_: unknown, originIndex: number) =>
    body.destinations.map((_: unknown, destinationIndex: number) => ({
      originIndex,
      destinationIndex,
      status: {},
      condition: "ROUTE_EXISTS",
      distanceMeters: 200 + destinationIndex * 10,
      duration: "180s",
    })),
  );
}
export const rawFixture = (size = 4) => ({
  places: Array.from({ length: size }, (_, i) => ({
    id: "TestPlace" + (910000001 + i),
    displayName: { text: `Lugar de prueba ${i + 1}` },
    location: {
      latitude: 1.2146 + (i % 30) * 0.0001,
      longitude: -77.2783 + Math.floor(i / 30) * 0.0001,
    },
    types: ["museum"],
    businessStatus: "OPERATIONAL",
    formattedAddress: "Pasto, Nariño, Colombia",
    addressComponents: [
      { shortText: "CO", longText: "Colombia", types: ["country"] },
      { longText: "Nariño", types: ["administrative_area_level_1"] },
    ],
  })),
});
export const fixturePlaces = () =>
  rawFixture().places.map((p) =>
    normalizeGooglePlace(p, new Date().toISOString())!,
  );
