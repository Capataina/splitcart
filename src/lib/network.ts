import { sql } from "./db";
import type { Offer, Supplier } from "./types";

/*
 * The shared price book: list prices other Splitcart businesses have entered for
 * suppliers this business doesn't use yet. Only supplier names and their list prices
 * cross businesses; quantities, runs and business names never do. Products match by
 * fuzzy name and canonical unit (see MATCH).
 */

export interface CheaperElsewhere {
  supplierId: string; // pass to adoptSupplier
  productName: string;
  unit: string;
  supplierName: string;
  offerLabel: string;
  theirUnitPrice: number; // £ per unit at the outside supplier
  yourUnitPrice: number | null; // your cheapest £ per unit today, null if nobody you use stocks it
  minOrder: number;
  deliveryFee: number;
  freeDeliveryOver: number | null;
}

type Row = Record<string, unknown>;

// pg_trgm similarity on lower-cased names, with units canonicalised by the canon_unit()
// SQL function (litre = l, kilo = kg, pcs = each). Measured: "whole milk 2l" vs
// "whole milk" 0.79 (match), "oat milk" 0.33 and "semi-skimmed milk" 0.22 vs
// "whole milk" (no match), word order swapped 1.0.
const MATCH = 0.55;

/**
 * Every outside offer for this business's products, re-pointed at its own product
 * ids, with each outside supplier's real rules, so the optimiser can re-solve the
 * order as if the business also bought from them.
 */
export async function outsideOptions(companyId: string): Promise<{ suppliers: Supplier[]; offers: Offer[] }> {
  const rows = (await sql()`
    select p.id as product_id, s.id as supplier_id, s.name as supplier_name, s.min_order, s.delivery_fee,
      s.free_delivery_over, o.id as offer_id, o.label, o.case_size, o.case_price
    from products p
    join products op on similarity(lower(op.name), lower(p.name)) >= ${MATCH} and canon_unit(op.unit) = canon_unit(p.unit)
      and op.company_id <> ${companyId}
    join offers o on o.product_id = op.id
    join suppliers s on s.id = o.supplier_id
    where p.company_id = ${companyId}
      and lower(trim(s.name)) not in (select lower(trim(name)) from suppliers where company_id = ${companyId})`) as Row[];
  const suppliers = new Map<string, Supplier>();
  const offers: Offer[] = rows.map((r) => {
    suppliers.set(r.supplier_id as string, {
      id: r.supplier_id as string,
      name: r.supplier_name as string,
      minOrder: Number(r.min_order),
      deliveryFee: Number(r.delivery_fee),
      freeDeliveryOver: num(r.free_delivery_over),
    });
    // Promos and per-order caps belong to the other business's account, so only list prices travel.
    return {
      id: r.offer_id as string, supplierId: r.supplier_id as string, productId: r.product_id as string,
      label: r.label as string, caseSize: Number(r.case_size), casePrice: Number(r.case_price),
      promoPrice: null, promoUntil: null, maxBuys: null,
    };
  });
  return { suppliers: [...suppliers.values()], offers };
}
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * One click from "cheaper elsewhere" to "my supplier": copies an outside supplier's
 * rules and its list prices for this business's products. Returns the new supplier's
 * name, or null if there was nothing to copy.
 */
export async function adoptSupplier(companyId: string, outsideSupplierId: string): Promise<string | null> {
  const { suppliers, offers } = await outsideOptions(companyId);
  const s = suppliers.find((x) => x.id === outsideSupplierId);
  if (!s) return null;
  const q = sql();
  const [{ id }] = (await q`insert into suppliers (company_id, name, min_order, delivery_fee, free_delivery_over)
    values (${companyId}, ${s.name}, ${s.minOrder}, ${s.deliveryFee}, ${s.freeDeliveryOver}) returning id`) as { id: string }[];
  await Promise.all(
    offers
      .filter((o) => o.supplierId === s.id)
      .map((o) => q`insert into offers (supplier_id, product_id, label, case_size, case_price)
        values (${id}, ${o.productId}, ${o.label}, ${o.caseSize}, ${o.casePrice})`),
  );
  return s.name;
}

/** Best outside offer per product that beats (or fills a gap in) your own suppliers. */
export async function findCheaperElsewhere(companyId: string): Promise<CheaperElsewhere[]> {
  const rows = (await sql()`
    with mine as (
      select p.id, p.name, p.unit, lower(trim(p.name)) as key, canon_unit(p.unit) as ukey,
        (select min(o.case_price / o.case_size) from offers o where o.product_id = p.id) as my_unit
      from products p where p.company_id = ${companyId}
    ),
    my_suppliers as (select lower(trim(name)) as key from suppliers where company_id = ${companyId}),
    outside as (
      select m.name as product_name, m.unit, m.my_unit, s.id as supplier_id, s.name as supplier_name, o.label,
        o.case_price / o.case_size as unit_price, s.min_order, s.delivery_fee, s.free_delivery_over,
        row_number() over (partition by m.id order by o.case_price / o.case_size) as rank
      from mine m
      join products op on similarity(lower(op.name), m.key) >= ${MATCH} and canon_unit(op.unit) = m.ukey and op.company_id <> ${companyId}
      join offers o on o.product_id = op.id
      join suppliers s on s.id = o.supplier_id
      where lower(trim(s.name)) not in (select key from my_suppliers)
    )
    select * from outside
    where rank = 1 and (my_unit is null or unit_price < my_unit * 0.97)
    order by (my_unit - unit_price) / nullif(my_unit, 0) desc nulls first
    limit 10`) as Row[];
  return rows.map((r) => ({
    supplierId: r.supplier_id as string,
    productName: r.product_name as string,
    unit: r.unit as string,
    supplierName: r.supplier_name as string,
    offerLabel: r.label as string,
    theirUnitPrice: Number(r.unit_price),
    yourUnitPrice: num(r.my_unit),
    minOrder: Number(r.min_order),
    deliveryFee: Number(r.delivery_fee),
    freeDeliveryOver: num(r.free_delivery_over),
  }));
}
