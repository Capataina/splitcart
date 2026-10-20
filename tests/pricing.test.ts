import { test } from "node:test";
import assert from "node:assert/strict";
import { adviseSellPrice } from "../src/lib/pricing.ts";

test("picks the profit peak, not the highest price", () => {
  // q = 200 - 40p (sold 80 at £3, 40 at £4). Cost £1: p* = (1 + 5)/2 = £3.
  // Profit at £3 = 2*80 = 160 beats £4 = 3*40 = 120.
  const r = adviseSellPrice({ sellMin: null, sellMax: null, priceTests: [{ price: 3, weeklySold: 80 }, { price: 4, weeklySold: 40 }] }, 1);
  assert.equal(r.kind, "price");
  if (r.kind !== "price") return;
  assert.equal(r.price, 3);
  assert.equal(r.expectedWeekly, 80);
  assert.equal(r.weeklyProfit, 160);
});

test("stays inside the owner's range", () => {
  const r = adviseSellPrice({ sellMin: 3.5, sellMax: 4.5, priceTests: [{ price: 3, weeklySold: 80 }, { price: 4, weeklySold: 40 }] }, 1);
  assert.equal(r.kind === "price" && r.price, 3.5);
  assert.equal(r.kind === "price" && r.clamped, true);
});

test("never advises selling below cost", () => {
  const r = adviseSellPrice({ sellMin: null, sellMax: null, priceTests: [{ price: 1, weeklySold: 100 }, { price: 2, weeklySold: 10 }] }, 1.8);
  assert.ok(r.kind === "price" && r.price >= 1.8);
});

test("asks for data instead of guessing", () => {
  assert.equal(adviseSellPrice({ sellMin: null, sellMax: null, priceTests: [{ price: 3, weeklySold: 80 }] }, 1).kind, "need-data");
  assert.equal(adviseSellPrice({ sellMin: null, sellMax: null, priceTests: [] }, null).kind, "need-data");
  // Sales rose with price: no trustworthy demand curve yet.
  assert.equal(adviseSellPrice({ sellMin: null, sellMax: null, priceTests: [{ price: 3, weeklySold: 40 }, { price: 4, weeklySold: 60 }] }, 1).kind, "need-data");
});
