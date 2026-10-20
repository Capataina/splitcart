import { randomUUID } from "node:crypto";
import { hashCode } from "./access";
import { sql } from "./db";
import { track } from "./telemetry";

// A realistic café workspace so a visitor can optimise in one click. Supplier
// names are fictional; their terms follow real UK wholesaler shapes (minimum
// order by value, flat fee, free delivery over a threshold, singles vs cases).

export const DEMO_CODE = "demo";

type S = { key: string; name: string; minOrder: number; fee: number; freeOver: number | null };
const SUPPLIERS: S[] = [
  { key: "brake", name: "Brakewell Foodservice", minOrder: 100, fee: 12, freeOver: 250 },
  { key: "jj", name: "Jay & Jay Wholesale", minOrder: 79, fee: 5, freeOver: 129 },
  { key: "roast", name: "Hackney Roasters", minOrder: 60, fee: 6, freeOver: 120 },
  { key: "dairy", name: "Meadow Dairy", minOrder: 20, fee: 3, freeOver: 40 },
  { key: "cc", name: "Express Cash & Carry", minOrder: 0, fee: 15, freeOver: null },
];

// [name, unit, needed]
const PRODUCTS: [string, string, number][] = [
  ["Whole milk", "l", 60],
  ["Oat milk", "l", 24],
  ["Espresso beans", "kg", 8],
  ["Butter croissants", "each", 120],
  ["12oz takeaway cups", "each", 1000],
  ["12oz lids", "each", 1000],
  ["Sourdough loaf", "each", 30],
  ["Mature cheddar", "kg", 5],
  ["Still water 500ml", "each", 48],
];

// Resold items the café has tried prices on, so price advice has history to fit.
const PRICE_TESTS: Record<string, { price: number; weeklySold: number }[]> = {
  "Butter croissants": [{ price: 2.6, weeklySold: 130 }, { price: 3.0, weeklySold: 110 }, { price: 3.4, weeklySold: 80 }],
  "Still water 500ml": [{ price: 1.2, weeklySold: 60 }, { price: 1.5, weeklySold: 48 }],
};

// [supplier, product, label, units per buy, price, promo?, promo days left?, max buys?]
type O = [string, string, string, number, number, number?, number?, number?];
const OFFERS: O[] = [
  ["brake", "Whole milk", "Case 6 x 2 l", 12, 10.8],
  ["jj", "Whole milk", "Single 2 l", 2, 1.95],
  ["jj", "Whole milk", "Case 6 x 2 l", 12, 10.5, 9.0, 10],
  ["dairy", "Whole milk", "Crate 10 x 2 l", 20, 16.0],
  ["cc", "Whole milk", "Single 4 l", 4, 3.6],
  ["brake", "Oat milk", "Case 6 x 1 l", 6, 11.4],
  ["jj", "Oat milk", "Case 6 x 1 l", 6, 12.6, 9.9, -3], // promo expired 3 days ago
  ["roast", "Oat milk", "Case 12 x 1 l", 12, 21.6],
  ["roast", "Espresso beans", "Bag 1 kg", 1, 19.5],
  ["roast", "Espresso beans", "Case 6 x 1 kg", 6, 99.0],
  ["brake", "Espresso beans", "Bag 1 kg", 1, 22.0],
  ["jj", "Espresso beans", "Bag 1 kg", 1, 18.0, undefined, undefined, 4], // limit 4 per order
  ["brake", "Butter croissants", "Case of 60 (frozen)", 60, 27.0],
  ["jj", "Butter croissants", "Case of 40 (frozen)", 40, 19.2],
  ["cc", "Butter croissants", "Pack of 12", 12, 6.6],
  ["brake", "12oz takeaway cups", "Sleeve of 50", 50, 4.75],
  ["brake", "12oz takeaway cups", "Case of 1000", 1000, 68.0],
  ["jj", "12oz takeaway cups", "Case of 1000", 1000, 72.0, 59.0, 7],
  ["cc", "12oz takeaway cups", "Sleeve of 50", 50, 4.2],
  ["brake", "12oz lids", "Case of 1000", 1000, 38.0],
  ["jj", "12oz lids", "Case of 1000", 1000, 35.0],
  ["cc", "12oz lids", "Sleeve of 100", 100, 4.9],
  ["brake", "Sourdough loaf", "Single", 1, 2.9],
  ["dairy", "Sourdough loaf", "Single", 1, 2.6],
  ["cc", "Sourdough loaf", "Single", 1, 3.1],
  ["brake", "Mature cheddar", "Block 5 kg", 5, 36.5],
  ["jj", "Mature cheddar", "Block 2.5 kg", 2.5, 19.0],
  ["dairy", "Mature cheddar", "Block 2.5 kg", 2.5, 17.5],
  ["brake", "Still water 500ml", "Case of 24", 24, 5.5],
  ["jj", "Still water 500ml", "Case of 24", 24, 4.99],
  ["cc", "Still water 500ml", "Case of 24", 24, 4.75],
];

// A second business whose suppliers the demo café doesn't use, so the shared price
// book has something to find. Created once and reused by every demo.
const PEER = "Harbour Deli (demo network)";
const PEER_SUPPLIERS: S[] = [
  { key: "river", name: "Riverside Wholesale", minOrder: 50, fee: 6, freeOver: 100 },
  { key: "pack", name: "Packaging Direct", minOrder: 40, fee: 0, freeOver: null },
];
const PEER_OFFERS: [string, string, string, number, number][] = [
  ["river", "Whole milk", "Case 6 x 2 l", 12, 8.4],
  ["river", "Oat milk", "Case 6 x 1 l", 6, 9.6],
  ["pack", "12oz takeaway cups", "Case of 1000", 1000, 54.0],
];

async function ensureNetworkPeer(q: ReturnType<typeof sql>) {
  const existing = (await q`select id from companies where name = ${PEER} limit 1`) as { id: string }[];
  if (existing.length) return;
  const [{ id }] = (await q`insert into companies (name, kind, access_hash, is_demo) values (${PEER}, 'shop', ${hashCode(randomUUID())}, true) returning id`) as { id: string }[];
  const sup = new Map<string, string>();
  for (const s of PEER_SUPPLIERS) {
    const [r] = (await q`insert into suppliers (company_id, name, min_order, delivery_fee, free_delivery_over)
      values (${id}, ${s.name}, ${s.minOrder}, ${s.fee}, ${s.freeOver}) returning id`) as { id: string }[];
    sup.set(s.key, r.id);
  }
  for (const [s, product, label, size, price] of PEER_OFFERS) {
    const unit = PRODUCTS.find(([n]) => n === product)![1];
    const [p] = (await q`insert into products (company_id, name, unit, needed_qty) values (${id}, ${product}, ${unit}, 0) returning id`) as { id: string }[];
    await q`insert into offers (supplier_id, product_id, label, case_size, case_price) values (${sup.get(s)}, ${p.id}, ${label}, ${size}, ${price})`;
  }
}

const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Creates a fresh demo company (access code "demo") and returns its id and access hash. */
export async function createDemoCompany(): Promise<{ id: string; accessHash: string }> {
  const q = sql();
  const accessHash = hashCode(DEMO_CODE);
  track("demo_created");
  await ensureNetworkPeer(q);
  const [{ id }] = (await q`insert into companies (name, kind, access_hash, is_demo) values ('Corner Cup Café (demo)', 'cafe', ${accessHash}, true) returning id`) as { id: string }[];

  const supplierIds = new Map<string, string>();
  for (const s of SUPPLIERS) {
    // .example is reserved (RFC 2606), so a demo "Email order" can never reach a real inbox.
    const [row] = (await q`insert into suppliers (company_id, name, min_order, delivery_fee, free_delivery_over, email)
      values (${id}, ${s.name}, ${s.minOrder}, ${s.fee}, ${s.freeOver}, ${`orders@${s.key}.example`}) returning id`) as { id: string }[];
    supplierIds.set(s.key, row.id);
  }
  const productIds = new Map<string, string>();
  for (const [name, unit, needed] of PRODUCTS) {
    const tests = JSON.stringify(PRICE_TESTS[name] ?? []);
    const [row] = (await q`insert into products (company_id, name, unit, needed_qty, price_tests)
      values (${id}, ${name}, ${unit}, ${needed}, ${tests}) returning id`) as { id: string }[];
    productIds.set(name, row.id);
  }
  await Promise.all(
    OFFERS.map(([s, p, label, size, price, promo, days, max]) =>
      q`insert into offers (supplier_id, product_id, label, case_size, case_price, promo_price, promo_until, max_buys)
        values (${supplierIds.get(s)}, ${productIds.get(p)}, ${label}, ${size}, ${price}, ${promo ?? null},
          ${promo !== undefined && days !== undefined ? isoInDays(days) : null}, ${max ?? null})`,
    ),
  );
  // Two list prices that rose recently, so the price alerts have something to show.
  await Promise.all(
    PRICE_RISES.map(([s, p, oldPrice, daysAgo]) =>
      q`insert into offer_price_changes (offer_id, old_price, new_price, at)
        select o.id, ${oldPrice}, o.case_price, now() - make_interval(days => ${daysAgo})
        from offers o where o.supplier_id = ${supplierIds.get(s)} and o.product_id = ${productIds.get(p)}`,
    ),
  );
  return { id, accessHash };
}

// [supplier, product, previous price, days since the change]
const PRICE_RISES: [string, string, number, number][] = [
  ["brake", "Oat milk", 10.2, 9],
  ["jj", "Butter croissants", 17.9, 4],
];
