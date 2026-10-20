import highsLoader, { type LegacyHighs } from "highs";
import { track } from "./telemetry.ts";
import type { Offer, OptimisationResult, OrderLine, Plan, Product, Supplier, SupplierOrder, Workspace } from "./types";

/*
 * The cheapest legal way to buy this order across suppliers, as a mixed-integer
 * program solved by HiGHS.
 *
 *   n_k ∈ ℤ≥0   buys of offer k (a single, a case…), ≤ its cap
 *   y_s ∈ {0,1} we place an order with supplier s
 *   f_s ∈ {0,1} supplier s's free-delivery threshold is reached
 *
 *   min  Σ price_k·n_k + Σ fee_s·(y_s − f_s)
 *   s.t. Σ_{k for p} units_k·n_k ≥ need_p            every product covered
 *        n_k ≤ cap_k·y_s                             no lines without an order
 *        subtotal_s ≥ minOrder_s·y_s                  supplier minimum
 *        subtotal_s ≥ threshold_s·f_s,  f_s ≤ y_s     free delivery only when earned
 *
 * cap_k is the buys that cover the need plus enough extra to cross the supplier's
 * minimum or free-delivery line (see purchaseOptions), or the offer's own limit.
 */

export interface PurchaseOption {
  offer: Offer;
  price: number; // promo applied if still valid
  promoApplied: boolean;
  cap: number;
}

type Highs = LegacyHighs;
let highsPromise: Promise<Highs> | null = null;
const loadHighs = () => (highsPromise ??= highsLoader() as unknown as Promise<Highs>);

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Today's date in the UK, where the businesses and their promo end dates live. */
export const todayInLondon = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export function purchaseOptions(offers: Offer[], products: Product[], suppliers: Supplier[], today: string): PurchaseOption[] {
  const need = new Map(products.map((p) => [p.id, p.neededQty]));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  return offers
    .filter((o) => (need.get(o.productId) ?? 0) > 0 && o.caseSize > 0 && supplierById.has(o.supplierId))
    .map((o) => {
      const promoApplied = o.promoPrice !== null && o.promoUntil !== null && o.promoUntil >= today && o.promoPrice < o.casePrice;
      const price = promoApplied ? o.promoPrice! : o.casePrice;
      const s = supplierById.get(o.supplierId)!;
      // Buying past the need only ever pays to lift this supplier's subtotal over its
      // minimum or free-delivery line, so enough extra buys to cross the higher of the
      // two keeps every optimal plan inside the bound while keeping the search finite.
      const line = Math.max(s.minOrder, s.deliveryFee > 0 ? (s.freeDeliveryOver ?? 0) : 0);
      const cover = Math.ceil(need.get(o.productId)! / o.caseSize) + (price > 0 ? Math.ceil(line / price) : 0);
      return { offer: o, price, promoApplied, cap: o.maxBuys === null ? cover : Math.min(cover, o.maxBuys) };
    })
    .filter((o) => o.cap > 0);
}

/** Builds the CPLEX-LP text for the model above. Exported for tests. */
export function buildModel(suppliers: Supplier[], products: Product[], options: PurchaseOption[]): string {
  const term = (c: number, v: string) => `${c < 0 ? "-" : "+"} ${Math.abs(c)} ${v}`;
  const sIdx = new Map(suppliers.map((s, i) => [s.id, i]));
  const obj: string[] = [];
  const rows: string[] = [];
  const bounds: string[] = [];
  const ints: string[] = [];
  const bins: string[] = [];

  options.forEach((o, k) => {
    obj.push(term(o.price, `n${k}`));
    bounds.push(`0 <= n${k} <= ${o.cap}`);
    ints.push(`n${k}`);
    rows.push(`link${k}: n${k} ${term(-o.cap, `y${sIdx.get(o.offer.supplierId)}`)} <= 0`);
  });

  products.forEach((p, j) => {
    if (p.neededQty <= 0) return;
    const terms = options.flatMap((o, k) => (o.offer.productId === p.id ? [term(o.offer.caseSize, `n${k}`)] : []));
    if (terms.length) rows.push(`cover${j}: ${terms.join(" ")} >= ${p.neededQty}`);
  });

  suppliers.forEach((s, i) => {
    bins.push(`y${i}`);
    const sub = options.flatMap((o, k) => (o.offer.supplierId === s.id ? [term(o.price, `n${k}`)] : []));
    if (!sub.length) {
      rows.push(`unused${i}: y${i} = 0`);
      return;
    }
    if (s.minOrder > 0) rows.push(`min${i}: ${sub.join(" ")} ${term(-s.minOrder, `y${i}`)} >= 0`);
    if (s.deliveryFee > 0) {
      obj.push(term(s.deliveryFee, `y${i}`));
      if (s.freeDeliveryOver !== null) {
        bins.push(`f${i}`);
        obj.push(term(-s.deliveryFee, `f${i}`));
        rows.push(`free${i}: ${sub.join(" ")} ${term(-s.freeDeliveryOver, `f${i}`)} >= 0`);
        rows.push(`freelink${i}: f${i} - y${i} <= 0`);
      }
    }
  });

  return [
    "Minimize",
    ` obj: ${obj.join(" ") || "0 y0"}`,
    "Subject To",
    ...rows.map((r) => ` ${r}`),
    "Bounds",
    ...bounds.map((b) => ` ${b}`),
    "General",
    ` ${ints.join(" ")}`,
    "Binary",
    ` ${bins.join(" ")}`,
    "End",
  ].join("\n");
}

function solve(highs: Highs, suppliers: Supplier[], products: Product[], options: PurchaseOption[]): Plan | null {
  if (!options.length || !suppliers.length) return null;
  const sol = highs.solve(buildModel(suppliers, products, options));
  if (sol.Status !== "Optimal") return null;
  const value = (name: string) => Math.round(Number(sol.Columns[name]?.Primal ?? 0));
  const productById = new Map(products.map((p) => [p.id, p]));

  const orders: SupplierOrder[] = [];
  suppliers.forEach((s, i) => {
    if (value(`y${i}`) !== 1) return;
    const lines: OrderLine[] = [];
    options.forEach((o, k) => {
      const cases = value(`n${k}`);
      if (o.offer.supplierId !== s.id || cases === 0) return;
      const p = productById.get(o.offer.productId)!;
      lines.push({
        productId: p.id,
        productName: p.name,
        offerLabel: o.offer.label,
        unit: p.unit,
        cases,
        caseSize: o.offer.caseSize,
        unitsBought: round2(cases * o.offer.caseSize),
        casePrice: o.price,
        promoApplied: o.promoApplied,
        lineTotal: round2(cases * o.price),
      });
    });
    const subtotal = round2(lines.reduce((a, l) => a + l.lineTotal, 0));
    // Recomputed from the subtotal rather than read from f_s, so the plan can never
    // show a fee the supplier's own rule would waive.
    const deliveryFee = s.freeDeliveryOver !== null && subtotal >= s.freeDeliveryOver ? 0 : s.deliveryFee;
    if (lines.length) orders.push({ supplierId: s.id, supplierName: s.name, lines, subtotal, deliveryFee, total: round2(subtotal + deliveryFee) });
  });

  const goodsTotal = round2(orders.reduce((a, o) => a + o.subtotal, 0));
  const deliveryTotal = round2(orders.reduce((a, o) => a + o.deliveryFee, 0));
  return { orders, goodsTotal, deliveryTotal, total: round2(goodsTotal + deliveryTotal) };
}

/** Cheapest supplier split for the current order. `today` is an ISO date (promo validity). */
export async function optimise(ws: Pick<Workspace, "suppliers" | "products" | "offers">, today: string): Promise<OptimisationResult> {
  const solvedAt = new Date().toISOString();
  const wanted = ws.products.filter((p) => p.neededQty > 0);
  const options = purchaseOptions(ws.offers, ws.products, ws.suppliers, today);
  const offered = new Set(options.map((o) => o.offer.productId));
  const unavailable = wanted.filter((p) => !offered.has(p.id)).map((p) => p.name);
  const orderable = wanted.filter((p) => offered.has(p.id));
  const notes: string[] = [];
  if (unavailable.length) notes.push(`No supplier offers ${unavailable.join(", ")}; left out of the plan.`);

  if (!orderable.length) {
    return { status: "nothing-to-order", plan: null, baseline: null, savings: null, unavailable, notes, solvedAt };
  }

  const highs = await loadHighs();
  const plan = solve(highs, ws.suppliers, orderable, options);
  if (!plan) {
    track("optimise_infeasible", { suppliers: ws.suppliers.length, products: orderable.length, options: options.length });
    notes.push(
      "No combination meets every supplier's minimum order and per-order limits. Lower a minimum, raise a quantity, or add another supplier.",
    );
    return { status: "infeasible", plan: null, baseline: null, savings: null, unavailable, notes, solvedAt };
  }

  // Baseline: the best order placed with one supplier, for suppliers that stock everything.
  let baseline: OptimisationResult["baseline"] = null;
  for (const s of ws.suppliers) {
    const own = options.filter((o) => o.offer.supplierId === s.id);
    if (!orderable.every((p) => own.some((o) => o.offer.productId === p.id))) continue;
    const single = solve(highs, [s], orderable, own);
    if (single && (!baseline || single.total < baseline.plan.total)) baseline = { supplierName: s.name, plan: single };
  }
  if (!baseline) notes.push("No single supplier stocks everything, so there is no one-supplier order to compare against.");
  for (const p of orderable) {
    const lines = plan.orders.flatMap((o) => o.lines.filter((l) => l.productId === p.id));
    const extra = lines.reduce((a, l) => a + l.unitsBought, 0) - p.neededQty;
    // More than rounding up to a whole pack: the solver topped up on purpose.
    if (lines.length && extra >= Math.min(...lines.map((l) => l.caseSize))) {
      notes.push(`Buys ${round2(extra)} ${p.unit} more ${p.name} than needed: it's cheaper than missing a minimum order or paying delivery.`);
    }
  }
  if (options.some((o) => o.promoApplied)) notes.push("Live promotions were applied where they are still valid today.");

  track("optimise", {
    suppliers: ws.suppliers.length,
    products: orderable.length,
    options: options.length,
    total: plan.total,
    baseline: baseline?.plan.total ?? null,
    ms: Date.now() - Date.parse(solvedAt),
  });
  return {
    status: "optimal",
    plan,
    baseline,
    savings: baseline ? round2(baseline.plan.total - plan.total) : null,
    unavailable,
    notes,
    solvedAt,
  };
}
