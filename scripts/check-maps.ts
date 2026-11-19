import { discoverPlaces } from "../src/lib/server/discovery";
import { searchSpecSchema } from "../src/lib/places";
const result = await discoverPlaces(
  searchSpecSchema.parse({ categories: ["museos"], radius: 3000 }),
);
console.log(
  `OpenStreetMap: ${result.places.length} resultados, fuente ${result.provider}.`,
);
