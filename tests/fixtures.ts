// Synthetic HTTP fixtures for tests only. Never imported by the application.
import { normalizeResult } from "../src/lib/osm";
export const rawFixture = (size = 4) => ({
  elements: Array.from({ length: size }, (_, i) => ({
    type: "node",
    id: 910000001 + i,
    lat: 1.2146 + (i % 30) * 0.0001,
    lon: -77.2783 + Math.floor(i / 30) * 0.0001,
    tags: {
      name: `Lugar de prueba ${i + 1}`,
      tourism: "museum",
      "addr:city": "Pasto",
    },
  })),
});
export const fixturePlaces = () =>
  normalizeResult(rawFixture(), new Date().toISOString()).places;
