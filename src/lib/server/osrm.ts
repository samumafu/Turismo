import "server-only";
import { HttpError } from "./guard";

// The two public routing profiles share the same request budget.
let nextStart = 0;
export async function waitForRoutingSlot() {
  const now = performance.now();
  const wait = Math.max(0, nextStart - now);
  if (wait > 5000)
    throw new HttpError(
      429,
      "Hay varias rutas en curso. Intenta en unos segundos.",
      5,
    );
  nextStart = now + wait + 1050;
  if (wait)
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(wait)));
}
