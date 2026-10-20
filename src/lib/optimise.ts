import type { OptimisationResult, Workspace } from "./types";

/** Cheapest supplier split for the current order. `today` is an ISO date (promo validity). */
export async function optimise(
  ws: Pick<Workspace, "suppliers" | "products" | "offers">,
  today: string,
): Promise<OptimisationResult> {
  void ws;
  void today;
  throw new Error("solver not implemented yet");
}
