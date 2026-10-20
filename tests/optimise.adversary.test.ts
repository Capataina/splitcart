// Adversarial checks on the supplier-split MILP: brute-force optimality on random
// tiny instances, independent constraint recomputation from plan lines, edge inputs,
// and a café-sized timing run. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { optimise, buildModel, purchaseOptions } from "../src/lib/optimise.ts";
import type { Offer, OptimisationResult, Product, Supplier } from "../src/lib/types.ts";

const TODAY = "2026-10-20";
const EPS = 1e-6;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Inst { suppliers: Supplier[]; products: Product[]; offers: Offer[] }

const effPrice = (o: Offer, today: string) =>
  o.promoPrice !== null && o.promoUntil !== null && o.promoUntil >= today && o.promoPrice < o.casePrice ? o.promoPrice : o.casePrice;

/**
 * Exhaustive minimum. `extra` = buys allowed per offer beyond ceil(need/caseSize)
 * (0 reproduces the model's own caps; >0 asks for the true unrestricted minimum
 * within that horizon). Returns null if nothing feasible.
 */
function bruteForce(inst: Inst, today: string, extra: number): number | null {
  const need = new Map(inst.products.map((p) => [p.id, p.neededQty]));
  const sups = new Set(inst.suppliers.map((s) => s.id));
  const offers = inst.offers.filter((o) => (need.get(o.productId) ?? 0) > 0 && o.caseSize > 0 && sups.has(o.supplierId));
  const caps = offers.map((o) => {
    const c = Math.ceil(need.get(o.productId)! / o.caseSize) + extra;
    return o.maxBuys === null ? c : Math.min(c, o.maxBuys);
  });
  const wanted = inst.products.filter((p) => p.neededQty > 0 && offers.some((o) => o.productId === p.id));
  let best: number | null = null;
  const n = new Array(offers.length).fill(0);
  const rec = (k: number) => {
    if (k === offers.length) {
      for (const p of wanted) {
        let u = 0;
        offers.forEach((o, i) => { if (o.productId === p.id) u += o.caseSize * n[i]; });
        if (u < p.neededQty - EPS) return;
      }
      let total = 0;
      for (const s of inst.suppliers) {
        let sub = 0, used = false;
        offers.forEach((o, i) => { if (o.supplierId === s.id && n[i] > 0) { used = true; sub += effPrice(o, today) * n[i]; } });
        if (!used) continue;
        if (sub < s.minOrder - EPS) return;
        const free = s.freeDeliveryOver !== null && sub >= s.freeDeliveryOver - EPS;
        total += sub + (free ? 0 : s.deliveryFee);
      }
      if (best === null || total < best - EPS) best = total;
      return;
    }
    for (let v = 0; v <= caps[k]; v++) { n[k] = v; rec(k + 1); }
    n[k] = 0;
  };
  rec(0);
  return best;
}

/** Recompute every contract constraint from the plan's own lines; returns violations. */
function violations(inst: Inst, r: OptimisationResult, today: string): string[] {
  const out: string[] = [];
  if (!r.plan) return out;
  const supById = new Map(inst.suppliers.map((s) => [s.id, s]));
  const units = new Map<string, number>();
  let goods = 0, fees = 0;
  for (const o of r.plan.orders) {
    const s = supById.get(o.supplierId)!;
    let sub = 0;
    for (const l of o.lines) {
      const offer = inst.offers.find((x) => x.supplierId === o.supplierId && x.productId === l.productId && x.label === l.offerLabel && Math.abs(effPrice(x, today) - l.casePrice) < EPS);
      if (!offer) { out.push(`line ${l.productId}@${o.supplierId} matches no offer at price ${l.casePrice}`); continue; }
      if (!Number.isInteger(l.cases) || l.cases < 0) out.push(`non-integer buys ${l.cases}`);
      if (offer.maxBuys !== null && l.cases > offer.maxBuys) out.push(`maxBuys exceeded ${l.cases}>${offer.maxBuys}`);
      units.set(l.productId, (units.get(l.productId) ?? 0) + l.cases * offer.caseSize);
      sub += l.cases * effPrice(offer, today);
    }
    if (Math.abs(sub - o.subtotal) > 0.011) out.push(`subtotal ${o.subtotal} vs recomputed ${sub}`);
    if (sub < s.minOrder - EPS) out.push(`minOrder ${s.minOrder} not met by ${sub}`);
    const free = s.freeDeliveryOver !== null && sub >= s.freeDeliveryOver - EPS;
    const fee = free ? 0 : s.deliveryFee;
    if (Math.abs(fee - o.deliveryFee) > EPS) out.push(`fee ${o.deliveryFee} but rule says ${fee} (sub ${sub})`);
    goods += sub; fees += fee;
  }
  const offered = new Set(inst.offers.filter((o) => o.caseSize > 0 && supById.has(o.supplierId)).map((o) => o.productId));
  for (const p of inst.products) {
    if (p.neededQty > 0 && offered.has(p.id) && (units.get(p.id) ?? 0) < p.neededQty - EPS) out.push(`${p.id} covered ${units.get(p.id) ?? 0} < ${p.neededQty}`);
  }
  if (Math.abs(goods + fees - r.plan.total) > 0.011) out.push(`total ${r.plan.total} vs recomputed ${goods + fees}`);
  return out;
}

function randomInstance(seed: number): Inst {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const nS = 1 + Math.floor(r() * 3), nP = 1 + Math.floor(r() * 3);
  const suppliers: Supplier[] = Array.from({ length: nS }, (_, i) => {
    const fee = pick([0, 0, 3, 5, 8]);
    return { id: `S${i}`, name: `S${i}`, minOrder: pick([0, 0, 5, 10, 20]), deliveryFee: fee, freeDeliveryOver: pick([null, null, 10, 15, 25]) };
  });
  const products: Product[] = Array.from({ length: nP }, (_, j) => ({ id: `P${j}`, name: `P${j}`, unit: "each", neededQty: pick([0, 1, 2, 3, 4, 2.5]) }));
  const offers: Offer[] = [];
  let k = 0;
  for (const s of suppliers) for (const p of products) {
    const m = Math.floor(r() * 3); // 0..2 offers
    for (let t = 0; t < m && offers.length < 7; t++) {
      const caseSize = pick([1, 1, 2, 3, 0.5]);
      const casePrice = pick([1, 2, 3, 4.5, 6, 7.25]) * caseSize;
      const promo = r() < 0.2;
      offers.push({
        id: `o${k++}`, supplierId: s.id, productId: p.id, label: `L${k}`, caseSize, casePrice,
        promoPrice: promo ? Math.round(casePrice * 0.6 * 100) / 100 : null,
        promoUntil: promo ? pick(["2026-10-19", "2026-10-20", "2026-11-01"]) : null,
        maxBuys: r() < 0.2 ? pick([1, 2]) : null,
      });
    }
  }
  return { suppliers, products, offers };
}

// Main thread, after the cap fix: the model now allows top-up buys, so it must never be
// worse than the old no-top-up brute force (extra = 0), and must stay legal.
test("property: plan.total never exceeds the no-top-up brute force on 200 random tiny instances, every constraint holds", async () => {
  const fails: string[] = [];
  let optimal = 0, infeasible = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const inst = randomInstance(seed);
    const r = await optimise(inst, TODAY);
    const bf = bruteForce(inst, TODAY, 0);
    if (r.status === "nothing-to-order") continue;
    if (r.status === "infeasible") { infeasible++; if (bf !== null) fails.push(`seed ${seed}: infeasible but brute force ${bf}`); continue; }
    optimal++;
    if (bf !== null && r.plan!.total > bf + 0.011) fails.push(`seed ${seed}: plan ${r.plan!.total} vs brute ${bf}`);
    for (const v of violations(inst, r, TODAY)) fails.push(`seed ${seed}: ${v}`);
    if (r.baseline && r.savings! < -0.011) fails.push(`seed ${seed}: negative savings ${r.savings}`);
  }
  assert.ok(optimal > 100, `only ${optimal} optimal instances exercised`);
  assert.deepEqual(fails, [], fails.slice(0, 10).join("\n"));
  console.log(`property: ${optimal} optimal, ${infeasible} infeasible, 0 mismatches`);
});

test("contract: plan.total is the TRUE minimum (overbuy horizon +3) on the same 200 instances", async () => {
  // Measures the gap the ceil(need/caseSize) cap leaves: topping up to reach a
  // minimum order or free-delivery threshold is outside the model.
  const gaps: string[] = [];
  for (let seed = 1; seed <= 200; seed++) {
    const inst = randomInstance(seed);
    const r = await optimise(inst, TODAY);
    if (r.status === "nothing-to-order") continue;
    const truth = bruteForce(inst, TODAY, 3);
    const got = r.status === "optimal" ? r.plan!.total : null;
    if (truth !== null && (got === null || got > truth + 0.011)) gaps.push(`seed ${seed}: ${got ?? "infeasible"} vs ${truth}`);
  }
  console.log(`true-minimum gaps: ${gaps.length}/200\n${gaps.slice(0, 8).join("\n")}`);
  assert.deepEqual(gaps, [], "cap blocks cheaper or feasible top-up plans");
});

test("edge: supplier minimum reachable only by buying one more single is reported infeasible", async () => {
  // need 1 milk, single £6, min order £10: buying 2 (£12) is legal, the model forbids it.
  const r = await optimise({
    suppliers: [{ id: "A", name: "A", minOrder: 10, deliveryFee: 0, freeDeliveryOver: null }],
    products: [{ id: "m", name: "milk", unit: "each", neededQty: 1 }],
    offers: [{ id: "o", supplierId: "A", productId: "m", label: "1", caseSize: 1, casePrice: 6, promoPrice: null, promoUntil: null, maxBuys: null }],
  }, TODAY);
  assert.equal(r.status, "optimal", `got ${r.status}; £12 for two singles is a legal order`);
});

test("edge: one extra single to reach free delivery beats paying the fee", async () => {
  // need 4 x £12 = £48, fee £10 free at £50: 5 singles = £60 < 48+10 = £58? No: 58 < 60.
  // Use need 4 x £12.40 = £49.60 + £10 = £59.60 vs 5 x 12.40 = £62 — still worse.
  // The realistic gain needs a cheap filler: add a £1 item needed once from the same supplier... covered.
  // Clean case: need 1 x £45, fee £10 free at £50: buying 2 = £90 is worse. Top-up only wins with a
  // cheap unit; e.g. need 9 x £5.50 = £49.50 + £10 = £59.50 vs 10 x 5.50 = £55.
  const r = await optimise({
    suppliers: [{ id: "A", name: "A", minOrder: 0, deliveryFee: 10, freeDeliveryOver: 50 }],
    products: [{ id: "c", name: "cups", unit: "each", neededQty: 9 }],
    offers: [{ id: "o", supplierId: "A", productId: "c", label: "1", caseSize: 1, casePrice: 5.5, promoPrice: null, promoUntil: null, maxBuys: null }],
  }, TODAY);
  assert.equal(r.plan!.total, 55, `plan ${r.plan!.total}: £59.50 paid where 10 units for £55 is cheaper`);
});

test("edge: an offer whose supplier is missing from the list must not be bought silently", async () => {
  const r = await optimise({
    suppliers: [{ id: "A", name: "A", minOrder: 0, deliveryFee: 0, freeDeliveryOver: null }],
    products: [{ id: "m", name: "milk", unit: "each", neededQty: 1 }],
    offers: [
      { id: "o1", supplierId: "A", productId: "m", label: "1", caseSize: 1, casePrice: 5, promoPrice: null, promoUntil: null, maxBuys: null },
      { id: "o2", supplierId: "GONE", productId: "m", label: "1", caseSize: 1, casePrice: 1, promoPrice: null, promoUntil: null, maxBuys: null },
    ],
  }, TODAY);
  const covered = r.plan?.orders.flatMap((o) => o.lines).reduce((a, l) => a + l.unitsBought, 0) ?? 0;
  assert.ok(covered >= 1, `plan covers ${covered} milk (status ${r.status}, total ${r.plan?.total})`);
});

test("edges: fractional, huge, thresholds at the boundary, duplicates, hostile names", async () => {
  const S = (id: string, minOrder = 0, deliveryFee = 0, freeDeliveryOver: number | null = null): Supplier => ({ id, name: id, minOrder, deliveryFee, freeDeliveryOver });
  const O = (s: string, p: string, caseSize: number, casePrice: number, x: Partial<Offer> = {}): Offer => ({ id: `${s}${p}${caseSize}${casePrice}`, supplierId: s, productId: p, label: "x", caseSize, casePrice, promoPrice: null, promoUntil: null, maxBuys: null, ...x });
  const P = (id: string, q: number, name = id): Product => ({ id, name, unit: "kg", neededQty: q });
  const cases: [string, Inst, (r: OptimisationResult) => void][] = [
    ["need 2.5 kg, 1 kg packs -> 3 packs", { suppliers: [S("A")], products: [P("f", 2.5)], offers: [O("A", "f", 1, 2)] }, (r) => assert.equal(r.plan!.total, 6)],
    ["need 0.7 kg, 0.1 kg packs -> 7 packs", { suppliers: [S("A")], products: [P("f", 0.7)], offers: [O("A", "f", 0.1, 0.3)] }, (r) => assert.equal(r.plan!.orders[0].lines[0].cases, 7)],
    ["need 1.1 kg, 0.1 kg packs -> 11 packs", { suppliers: [S("A")], products: [P("f", 1.1)], offers: [O("A", "f", 0.1, 0.3)] }, (r) => assert.equal(r.plan!.orders[0].lines[0].cases, 11)],
    ["case 100 for need 1", { suppliers: [S("A")], products: [P("f", 1)], offers: [O("A", "f", 100, 50)] }, (r) => assert.equal(r.plan!.total, 50)],
    ["minOrder exactly equal to subtotal", { suppliers: [S("A", 20)], products: [P("f", 4)], offers: [O("A", "f", 1, 5)] }, (r) => assert.equal(r.plan!.total, 20)],
    ["minOrder 0.1+0.2 vs subtotal", { suppliers: [S("A", 0.3)], products: [P("f", 3)], offers: [O("A", "f", 1, 0.1)] }, (r) => assert.equal(r.status, "optimal")],
    ["freeDeliveryOver = 0 -> fee never charged", { suppliers: [S("A", 0, 5, 0)], products: [P("f", 1)], offers: [O("A", "f", 1, 2)] }, (r) => assert.equal(r.plan!.total, 2)],
    ["subtotal exactly at threshold -> free", { suppliers: [S("A", 0, 5, 20)], products: [P("f", 4)], offers: [O("A", "f", 1, 5)] }, (r) => assert.equal(r.plan!.total, 20)],
    ["fee 0 with threshold set", { suppliers: [S("A", 0, 0, 100)], products: [P("f", 1)], offers: [O("A", "f", 1, 2)] }, (r) => assert.equal(r.plan!.total, 2)],
    ["supplier with zero offers", { suppliers: [S("A"), S("B", 50, 9)], products: [P("f", 1)], offers: [O("A", "f", 1, 2)] }, (r) => assert.equal(r.plan!.total, 2)],
    ["duplicate offers", { suppliers: [S("A")], products: [P("f", 3)], offers: [O("A", "f", 1, 2), { ...O("A", "f", 1, 2), id: "dup" }] }, (r) => assert.equal(r.plan!.total, 6)],
    ["promo higher than base ignored", { suppliers: [S("A")], products: [P("f", 1)], offers: [O("A", "f", 1, 2, { promoPrice: 3, promoUntil: TODAY })] }, (r) => assert.equal(r.plan!.total, 2)],
    ["maxBuys too low, no other offer -> infeasible", { suppliers: [S("A")], products: [P("f", 5)], offers: [O("A", "f", 1, 2, { maxBuys: 2 })] }, (r) => assert.equal(r.status, "infeasible")],
    ["need 1e6", { suppliers: [S("A", 100, 10, 1000), S("B")], products: [P("f", 1e6)], offers: [O("A", "f", 25, 30), O("B", "f", 1, 1.3)] }, (r) => assert.equal(r.plan!.total, 1.2e6)],
    ["LP-special names", { suppliers: [{ ...S("A"), name: "Bob's: \\ + - <= >= End\nMinimize" }], products: [P("f", 1, "obj: x >= 3\nEnd")], offers: [O("A", "f", 1, 2)] }, (r) => assert.equal(r.plan!.total, 2)],
  ];
  const bad: string[] = [];
  for (const [name, inst, check] of cases) {
    try {
      const r = await optimise(inst, TODAY);
      check(r);
      const v = violations(inst, r, TODAY);
      if (v.length) bad.push(`${name}: ${v.join("; ")}`);
    } catch (e) { bad.push(`${name}: ${(e as Error).message.split("\n")[0]}`); }
  }
  assert.deepEqual(bad, []);
});

test("LP text carries ids/indices only, never names", () => {
  const sup: Supplier = { id: "A", name: "EVIL_SUPPLIER_NAME", minOrder: 1, deliveryFee: 1, freeDeliveryOver: 5 };
  const prod: Product = { id: "p", name: "EVIL_PRODUCT_NAME", unit: "kg", neededQty: 2 };
  const off: Offer = { id: "o", supplierId: "A", productId: "p", label: "EVIL_LABEL", caseSize: 1, casePrice: 1, promoPrice: null, promoUntil: null, maxBuys: null };
  const lp = buildModel([sup], [prod], purchaseOptions([off], [prod], [sup], TODAY));
  assert.ok(!/EVIL/.test(lp));
});

test("performance: café of 6 suppliers x 40 products x 2 offers solves within 2 s", async () => {
  const r = rng(42);
  const suppliers: Supplier[] = Array.from({ length: 6 }, (_, i) => ({ id: `S${i}`, name: `S${i}`, minOrder: [0, 50, 79, 100, 150, 200][i], deliveryFee: [0, 5, 8, 10, 12, 15][i], freeDeliveryOver: [null, 100, 129, 150, 250, 300][i] }));
  const products: Product[] = Array.from({ length: 40 }, (_, j) => ({ id: `P${j}`, name: `P${j}`, unit: "each", neededQty: 1 + Math.floor(r() * 20) }));
  const offers: Offer[] = [];
  for (const s of suppliers) for (const p of products) {
    const unit = 0.5 + r() * 8;
    offers.push({ id: `${s.id}${p.id}a`, supplierId: s.id, productId: p.id, label: "single", caseSize: 1, casePrice: Math.round(unit * 100) / 100, promoPrice: null, promoUntil: null, maxBuys: null });
    const cs = [6, 12, 24][Math.floor(r() * 3)];
    offers.push({ id: `${s.id}${p.id}b`, supplierId: s.id, productId: p.id, label: "case", caseSize: cs, casePrice: Math.round(unit * cs * 0.85 * 100) / 100, promoPrice: null, promoUntil: null, maxBuys: null });
  }
  await optimise({ suppliers, products, offers }, TODAY); // warm the wasm load
  const t0 = performance.now();
  const res = await optimise({ suppliers, products, offers }, TODAY);
  const ms = performance.now() - t0;
  console.log(`café solve (plan + 6 baselines): ${ms.toFixed(0)} ms, total ${res.plan?.total}, baseline ${res.baseline?.plan.total}`);
  assert.equal(res.status, "optimal");
  assert.deepEqual(violations({ suppliers, products, offers }, res, TODAY), []);
  assert.ok(ms < 2000, `${ms} ms`);
});

test("stability: 300 consecutive solves on the shared HiGHS instance", async () => {
  const inst = randomInstance(7);
  const first = await optimise(inst, TODAY);
  for (let i = 0; i < 300; i++) {
    const r = await optimise(inst, TODAY);
    assert.equal(r.plan?.total, first.plan?.total);
  }
});
