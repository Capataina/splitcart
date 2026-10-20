// Exactness on the network: an outside supplier only counts if its own rules still
// leave the whole order cheaper, which a per-item price comparison can't tell you.
import { test } from "node:test";
import assert from "node:assert/strict";
import { optimise } from "../src/lib/optimise.ts";
import type { Offer, Supplier } from "../src/lib/types.ts";

const TODAY = "2026-10-20";
const sup = (id: string, minOrder = 0, deliveryFee = 0, freeDeliveryOver: number | null = null): Supplier => ({ id, name: id, minOrder, deliveryFee, freeDeliveryOver });
const offer = (supplierId: string, productId: string, casePrice: number): Offer => ({
  id: `${supplierId}-${productId}`, supplierId, productId, label: "", caseSize: 1, casePrice, promoPrice: null, promoUntil: null, maxBuys: null,
});
const products = [{ id: "milk", name: "milk", unit: "l", neededQty: 10 }];
const mine = { suppliers: [sup("A")], products, offers: [offer("A", "milk", 1)] };

test("an outside supplier that is cheaper after its fee is reported with the exact saving", async () => {
  // A: £1/l = £10. Outside R: £0.70/l + £2 fee = £9. Saving £1.
  const r = await optimise(mine, TODAY, { suppliers: [sup("R", 0, 2)], offers: [offer("R", "milk", 0.7)] });
  assert.equal(r.plan!.total, 10);
  assert.equal(r.network!.total, 9);
  assert.equal(r.network!.extraSaving, 1);
  assert.deepEqual(r.network!.newSuppliers, ["R"]);
});

test("a cheaper per-litre supplier whose fee eats the saving is not suggested", async () => {
  // Outside R: £0.70/l + £5 fee = £12 > £10.
  const r = await optimise(mine, TODAY, { suppliers: [sup("R", 0, 5)], offers: [offer("R", "milk", 0.7)] });
  assert.equal(r.network, null);
});

test("a cheaper supplier whose minimum can't be met without overspending is not suggested", async () => {
  // Outside R: £0.70/l but £20 minimum -> 29 l = £20.30 > £10.
  const r = await optimise(mine, TODAY, { suppliers: [sup("R", 20)], offers: [offer("R", "milk", 0.7)] });
  assert.equal(r.network, null);
});
