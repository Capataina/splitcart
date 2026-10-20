// Solver tests: each scenario's optimum is worked out by hand in the comment.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { optimise } from "../src/lib/optimise.ts";
import type { Offer, Product as FullProduct, Supplier } from "../src/lib/types.ts";

type Product = Pick<FullProduct, "id" | "name" | "unit" | "neededQty">;

const TODAY = "2026-10-20";
const sup = (id: string, minOrder = 0, deliveryFee = 0, freeDeliveryOver: number | null = null): Supplier => ({
  id, name: id, minOrder, deliveryFee, freeDeliveryOver,
});
const prod = (id: string, neededQty: number): Product => ({ id, name: id, unit: "each", neededQty });
let n = 0;
const offer = (supplierId: string, productId: string, caseSize: number, casePrice: number, extra: Partial<Offer> = {}): Offer => ({
  id: `o${n++}`, supplierId, productId, label: `${caseSize}x`, caseSize, casePrice,
  promoPrice: null, promoUntil: null, maxBuys: null, ...extra,
});

test("mixes a case and singles instead of overbuying", async () => {
  // need 7: case of 6 £10 + 1 single £2 = £12; beats 2 cases (£20) and 7 singles (£14)
  const r = await optimise({
    suppliers: [sup("A")],
    products: [prod("milk", 7)],
    offers: [offer("A", "milk", 6, 10), offer("A", "milk", 1, 2)],
  }, TODAY);
  assert.equal(r.status, "optimal");
  assert.equal(r.plan!.total, 12);
});

test("a delivery fee can make one supplier the whole answer", async () => {
  // A: milk £10, beans £30, fee £8 free over £50. B: milk £6, beans £34, no fee.
  // All A: 40 + 8 = 48. Split milk-B + beans-A: 6 + 30 + 8 = 44. All B: 40, the optimum.
  const r = await optimise({
    suppliers: [sup("A", 0, 8, 50), sup("B", 0, 0)],
    products: [prod("milk", 1), prod("beans", 1)],
    offers: [offer("A", "milk", 1, 10), offer("A", "beans", 1, 30), offer("B", "milk", 1, 6), offer("B", "beans", 1, 34)],
  }, TODAY);
  assert.equal(r.plan!.total, 40);
  assert.equal(r.plan!.orders.length, 1);
  assert.equal(r.baseline!.supplierName, "B");
  assert.equal(r.savings, 0);
});

test("reaching a free-delivery threshold beats the cheaper item price", async () => {
  // A: milk £12, beans £40, fee £10 free over £50. B: milk £9, fee £5.
  // All A: 52 (free delivery). Split milk-B: beans-A 40+10 + milk-B 9+5 = 64. Optimum 52 at A.
  const r = await optimise({
    suppliers: [sup("A", 0, 10, 50), sup("B", 0, 5)],
    products: [prod("milk", 1), prod("beans", 1)],
    offers: [offer("A", "milk", 1, 12), offer("A", "beans", 1, 40), offer("B", "milk", 1, 9)],
  }, TODAY);
  assert.equal(r.plan!.total, 52);
  assert.equal(r.plan!.deliveryTotal, 0);
});

test("a supplier minimum excludes it when the order is too small", async () => {
  // B is cheaper (£5) but needs £100 minimum; A sells at £8. Need 2 -> £16 at A.
  const r = await optimise({
    suppliers: [sup("A"), sup("B", 100)],
    products: [prod("cups", 2)],
    offers: [offer("A", "cups", 1, 8), offer("B", "cups", 1, 5)],
  }, TODAY);
  assert.equal(r.plan!.total, 16);
  assert.equal(r.plan!.orders[0].supplierName, "A");
});

test("savings measured against the best single supplier", async () => {
  // A: milk £5, beans £30. B: milk £8, beans £20. No fees.
  // Best single: B = 28 (A = 35). Split: milk A + beans B = 25. Saves £3.
  const r = await optimise({
    suppliers: [sup("A"), sup("B")],
    products: [prod("milk", 1), prod("beans", 1)],
    offers: [offer("A", "milk", 1, 5), offer("A", "beans", 1, 30), offer("B", "milk", 1, 8), offer("B", "beans", 1, 20)],
  }, TODAY);
  assert.equal(r.plan!.total, 25);
  assert.equal(r.baseline!.plan.total, 28);
  assert.equal(r.savings, 3);
});

test("a valid promo is applied and an expired one is not", async () => {
  const live = await optimise({
    suppliers: [sup("A")], products: [prod("milk", 1)],
    offers: [offer("A", "milk", 1, 10, { promoPrice: 7, promoUntil: TODAY })],
  }, TODAY);
  assert.equal(live.plan!.total, 7);
  assert.equal(live.plan!.orders[0].lines[0].promoApplied, true);
  const expired = await optimise({
    suppliers: [sup("A")], products: [prod("milk", 1)],
    offers: [offer("A", "milk", 1, 10, { promoPrice: 7, promoUntil: "2026-10-19" })],
  }, TODAY);
  assert.equal(expired.plan!.total, 10);
});

test("a per-order cap pushes the rest to the next-cheapest option", async () => {
  // Promo singles £1 limited to 2; regular £3. Need 5 -> 2*1 + 3*3 = 11.
  const r = await optimise({
    suppliers: [sup("A")], products: [prod("milk", 5)],
    offers: [offer("A", "milk", 1, 1, { maxBuys: 2 }), offer("A", "milk", 1, 3)],
  }, TODAY);
  assert.equal(r.plan!.total, 11);
});

test("unstocked products are reported, the rest still planned", async () => {
  const r = await optimise({
    suppliers: [sup("A")], products: [prod("milk", 1), prod("saffron", 1)],
    offers: [offer("A", "milk", 1, 2)],
  }, TODAY);
  assert.equal(r.status, "optimal");
  assert.deepEqual(r.unavailable, ["saffron"]);
});

test("tops up a basket to clear a supplier minimum when that is cheapest", async () => {
  // Need 1 milk; only supplier wants £10 minimum, singles £6 -> buy 2 = £12.
  const r = await optimise({
    suppliers: [sup("A", 10)], products: [prod("milk", 1)], offers: [offer("A", "milk", 1, 6)],
  }, TODAY);
  assert.equal(r.plan!.total, 12);
  assert.ok(r.notes.some((n) => n.includes("more milk than needed")));
});

test("tops up to free delivery when the extra costs less than the fee", async () => {
  // Need 9 at £5.50, fee £10 free at £50: 9 = £59.50, 10 = £55.
  const r = await optimise({
    suppliers: [sup("A", 0, 10, 50)], products: [prod("cups", 9)], offers: [offer("A", "cups", 1, 5.5)],
  }, TODAY);
  assert.equal(r.plan!.total, 55);
});

test("infeasible when no supplier minimum can be met", async () => {
  // £100 minimum, but the only offer is limited to 5 buys of £5.
  const r = await optimise({
    suppliers: [sup("A", 100)], products: [prod("milk", 1)], offers: [offer("A", "milk", 1, 5, { maxBuys: 5 })],
  }, TODAY);
  assert.equal(r.status, "infeasible");
  assert.ok(r.notes.length > 0);
});

test("an offer from an unknown supplier is ignored, never bought free", async () => {
  const r = await optimise({
    suppliers: [sup("A")], products: [prod("milk", 1)], offers: [offer("A", "milk", 1, 5), offer("GONE", "milk", 1, 1)],
  }, TODAY);
  assert.equal(r.plan!.total, 5);
});

test("nothing to order when every quantity is zero", async () => {
  const r = await optimise({ suppliers: [sup("A")], products: [prod("milk", 0)], offers: [offer("A", "milk", 1, 2)] }, TODAY);
  assert.equal(r.status, "nothing-to-order");
});
