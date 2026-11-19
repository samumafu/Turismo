// Synthetic Maps responses; these tests do not request or invent tourism data.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { interpretSearch, searchSpecSchema } from "../src/lib/places";
import { POST as search } from "../src/app/api/places/search/route";
import { POST as chat } from "../src/app/api/chat/route";
import { rawFixture, routeMatrixFixture } from "./fixtures";

const previousSearch = searchSpecSchema.parse({
  zone: "pasto",
  center: [1.2146, -77.2783],
  near: "Referencia anterior en Pasto",
  reference: { id: "osm:node:98888", name: "Referencia anterior" },
  name: "Nombre anterior",
  radius: 12000,
});

test("municipalities outside the shortcuts replace old search locations", () => {
  for (const [text, area] of [
    ["Busca un mirador en Consacá", "Consacá"],
    ["Miradores en el municipio de La Florida", "La Florida"],
    ["Restaurantes en el corregimiento de San Pablo", "San Pablo"],
    ["Cafeterías en La Cruz, Nariño", "La Cruz"],
    ["Miradores en Consacá a 5 km", "Consacá"],
    ["Miradores en Consacá en carro", "Consacá"],
    ["Miradores en Consacá con radio de 5 km", "Consacá"],
  ]) {
    const result = interpretSearch(text, previousSearch);
    assert.equal(result.near, area, text);
    assert.equal(result.center, undefined, text);
    assert.equal(result.reference, undefined, text);
    assert.equal(result.name, "", text);
  }
  const pasto = interpretSearch("Miradores en Pasto", previousSearch);
  assert.equal(pasto.near, undefined);
  assert.equal(pasto.reference, undefined);
  assert.equal(pasto.center, undefined);
  const ipiales = interpretSearch("Miradores en Ipiales", previousSearch);
  assert.equal(ipiales.zone, "ipiales");
  assert.equal(ipiales.near, undefined);
  assert.equal(interpretSearch("Miradores en carro").near, undefined);
  assert.equal(interpretSearch("Miradores en familia").near, undefined);
  const gps = interpretSearch(
    "Miradores cerca de mi ubicación",
    previousSearch,
  );
  assert.equal(gps.near, undefined);
  assert.equal(gps.reference, undefined);
  const reference = interpretSearch(
    "Cafeterías cerca de la plaza en Consacá",
    previousSearch,
  );
  assert.equal(reference.near, "plaza en Consacá");
  assert.equal(reference.radius, 1500);
});

const request = (path: string, body: unknown) =>
  new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("el chat busca cafeterías desde el pin aunque la búsqueda anterior tuviera otra referencia", async () => {
  const coordinates = [1.2146, -77.2783];
  const origin = {
    query: "Punto elegido en el mapa",
    name: "Pin en el mapa",
    coordinates,
    confirmed: true,
    source: "pin",
  };
  const previous = { ...previousSearch, center: [1.3, -77.5] };
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("/table/")) {
        assert.match(String(url), /driving\/-77\.2783,1\.2146;/);
        return Response.json(routeMatrixFixture(url));
      }
      assert.ok(String(url).includes("/interpreter"));
      assert.match(decodeURIComponent(String(init?.body)), /amenity=cafe/);
      const raw = rawFixture(1);
      return Response.json({
        elements: raw.elements.map((p) => ({
          ...p,
          tags: { name: p.tags.name, amenity: "cafe" },
        })),
      });
    },
  );
  try {
    for (const text of [
      "desde el pin de salida puedes buscar un cafe cercano",
      "Cafeterías cerca del pin de salida",
      "Busca un café desde mi punto de partida",
    ]) {
      const response = await chat(
        request("/api/chat", {
          demo: true,
          origin,
          search: previous,
          messages: [{ role: "user", content: text }],
        }),
      );
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(result.search.center, coordinates);
      assert.equal(result.search.near, undefined);
      assert.equal(result.search.name, "");
      assert.equal(result.places[0].categoryKey, "cafeterias");
      assert.deepEqual(result.origin, origin);
      assert.match(result.message, /Pin en el mapa/);
    }
    const calls = upstream.mock.callCount();
    for (const other of [undefined, { ...origin, source: "reference" }]) {
      const response = await chat(
        request("/api/chat", {
          demo: true,
          origin: other,
          search: previous,
          messages: [
            { role: "user", content: "Busca un café desde el pin de salida" },
          ],
        }),
      );
      assert.equal(response.status, 422);
      assert.match((await response.json()).error, /Poner pin de salida/);
    }
    assert.equal(upstream.mock.callCount(), calls);
  } finally {
    upstream.mock.restore();
  }
});

test("regional discovery works in filters, chat, pagination and GPS while excluding other departments", async (t) => {
  const names = [
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_SERVER_API_KEY",
  ] as const;
  const previousKeys = names.map((name) => process.env[name]);
  for (const name of names) process.env[name] = "synthetic-key";
  // These arbitrary coordinates are test fixtures, not municipality data.
  const point = { latitude: 1.3, longitude: -77.5 };
  let outside = false;
  const queries: string[] = [];
  const upstream = mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("/table/"))
        return Response.json(routeMatrixFixture(url));
      if (String(url).includes("photon"))
        return Response.json({
          features: [
            {
              geometry: {
                type: "Point",
                coordinates: [point.longitude, point.latitude],
              },
              properties: {
                osm_type: "N",
                osm_id: 191919,
                name: "Municipio de prueba",
                countrycode: "CO",
                state: outside ? "Cauca" : "Nariño",
              },
            },
          ],
        });
      queries.push(String(init?.body));
      return Response.json({
        elements: rawFixture(21).elements.map((p, i) => ({
          ...p,
          lat: point.latitude + 0.0001 * i,
          lon: point.longitude,
          tags: { name: p.tags.name, tourism: "viewpoint" },
        })),
      });
    },
  );
  try {
    await t.test(
      "an unlisted municipality becomes the search center and pagination retains it",
      async () => {
        const response = await search(
          request("/api/places/search", {
            text: "Busca miradores en Consacá",
            spec: previousSearch,
          }),
        );
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.spec.near, "Consacá");
        assert.equal(result.spec.radius, 12000);
        assert.deepEqual(result.spec.center, [point.latitude, point.longitude]);
        assert.equal(result.places.length, 20);
        assert.equal(result.places[0].travel.distanceMeters, 200);

        const before = queries.length;
        const next = await search(
          request("/api/places/search", {
            spec: result.spec,
            pageToken: result.nextPageToken,
          }),
        );
        assert.equal(next.status, 200);
        assert.equal(queries.length, before);
        assert.equal((await next.json()).places.length, 1);
      },
    );
    await t.test(
      "chat resolves a different municipality without reusing Pasto or accepting visits",
      async () => {
        const response = await chat(
          request("/api/chat", {
            demo: true,
            search: previousSearch,
            messages: [
              {
                role: "user",
                content: "Busca un mirador en el municipio de La Florida",
              },
            ],
            origin: {
              query: "GPS",
              name: "GPS",
              coordinates: [1.2146, -77.2783],
              confirmed: true,
            },
          }),
        );
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.search.near, "La Florida");
        assert.equal(result.places.length, 20);
        assert.deepEqual(result.selectedIds, []);
        assert.equal(result.itinerary, null);
        assert.match(result.message, /Municipio de prueba/);
      },
    );
    await t.test(
      "GPS outside Pasto supersedes an earlier named reference",
      async () => {
        const before = queries.length;
        const response = await chat(
          request("/api/chat", {
            demo: true,
            search: previousSearch,
            messages: [
              {
                role: "user",
                content: "Busca un mirador cerca de mi ubicación",
              },
            ],
            origin: {
              query: "GPS",
              name: "GPS",
              coordinates: [point.latitude, point.longitude],
              confirmed: true,
            },
          }),
        );
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.deepEqual(result.search.center, [
          point.latitude,
          point.longitude,
        ]);
        assert.equal(result.search.near, undefined);
        assert.equal(result.places.length, 20);
        assert.equal(queries.length, before + 1);
      },
    );
    await t.test(
      "missing GPS asks for a location instead of silently searching Pasto",
      async () => {
        const before = queries.length;
        const response = await chat(
          request("/api/chat", {
            demo: true,
            search: previousSearch,
            messages: [
              {
                role: "user",
                content: "Busca miradores cerca de mi ubicación",
              },
            ],
          }),
        );
        assert.equal(response.status, 422);
        assert.match((await response.json()).error, /Activa tu ubicación/);
        assert.equal(queries.length, before);
      },
    );
    await t.test(
      "references from another department request clarification",
      async () => {
        outside = true;
        const response = await search(
          request("/api/places/search", {
            spec: {
              ...previousSearch,
              near: "Municipio de otro departamento",
              center: undefined,
              reference: undefined,
            },
          }),
        );
        assert.equal(response.status, 422);
        assert.match((await response.json()).error, /municipio/);
      },
    );
  } finally {
    upstream.mock.restore();
    names.forEach((name, index) => {
      if (previousKeys[index] === undefined) delete process.env[name];
      else process.env[name] = previousKeys[index];
    });
  }
});
