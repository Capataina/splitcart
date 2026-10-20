import type { Offer, PriceAdvice, PriceTest, Product } from "./types";

/*
 * Selling-price advice from the owner's own history. Demand is fitted as a
 * straight line through the prices they've tried, q(p) = a + b·p (least squares),
 * and weekly profit (p − c)·q(p) peaks at p* = (c − a/b) / 2. The answer is kept
 * inside the owner's range, or within 20% of the prices actually tried, because a
 * line fitted on £3–£4 says nothing trustworthy about £7.
 */

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Cheapest £ per unit across all ways to buy the product (promos applied). */
export function unitCost(product: Product, offers: Offer[], today: string): number | null {
  const per = offers
    .filter((o) => o.productId === product.id && o.caseSize > 0)
    .map((o) => {
      const promo = o.promoPrice !== null && o.promoUntil !== null && o.promoUntil >= today && o.promoPrice < o.casePrice;
      return (promo ? o.promoPrice! : o.casePrice) / o.caseSize;
    });
  return per.length ? Math.min(...per) : null;
}

export function adviseSellPrice(product: Pick<Product, "sellMin" | "sellMax" | "priceTests">, cost: number | null): PriceAdvice {
  if (cost === null) return { kind: "need-data", reason: "Add a supplier price so we know what one unit costs you." };
  const tests: PriceTest[] = product.priceTests.filter((t) => t.price > 0 && t.weeklySold >= 0);
  const prices = new Set(tests.map((t) => t.price));
  if (prices.size < 2) return { kind: "need-data", reason: "Add at least two different prices you've sold at, with how many sold per week." };

  const n = tests.length;
  const mp = tests.reduce((s, t) => s + t.price, 0) / n;
  const mq = tests.reduce((s, t) => s + t.weeklySold, 0) / n;
  const sxy = tests.reduce((s, t) => s + (t.price - mp) * (t.weeklySold - mq), 0);
  const sxx = tests.reduce((s, t) => s + (t.price - mp) ** 2, 0);
  const b = sxy / sxx;
  const a = mq - b * mp;
  if (b >= 0) {
    return { kind: "need-data", reason: "Your history doesn't show sales falling as the price rises yet. Try one more price and log the result." };
  }

  const lo = Math.max(product.sellMin ?? Math.min(...prices) * 0.8, cost);
  const hi = product.sellMax ?? Math.max(...prices) * 1.2;
  if (hi < lo) return { kind: "need-data", reason: "Your price range sits below what a unit costs you." };
  const ideal = (cost - a / b) / 2;
  const price = round2(Math.min(hi, Math.max(lo, ideal)));
  const expectedWeekly = Math.max(0, a + b * price);
  return {
    kind: "price",
    price,
    unitCost: round2(cost),
    expectedWeekly: Math.round(expectedWeekly),
    weeklyProfit: round2((price - cost) * expectedWeekly),
    clamped: Math.abs(price - round2(ideal)) > 0.005,
  };
}
