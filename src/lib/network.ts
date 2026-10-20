import { sql } from "./db";

/*
 * The shared price book: list prices other Splitcart businesses have entered for
 * suppliers this business doesn't use yet. Only supplier names and their list prices
 * cross businesses; quantities, runs and business names never do. Products match on
 * lower-cased name and unit, which is crude but honest for a first version.
 */

export interface CheaperElsewhere {
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
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Best outside offer per product that beats (or fills a gap in) your own suppliers. */
export async function findCheaperElsewhere(companyId: string): Promise<CheaperElsewhere[]> {
  const rows = (await sql()`
    with mine as (
      select p.id, p.name, p.unit, lower(trim(p.name)) as key, lower(trim(p.unit)) as ukey,
        (select min(o.case_price / o.case_size) from offers o where o.product_id = p.id) as my_unit
      from products p where p.company_id = ${companyId}
    ),
    my_suppliers as (select lower(trim(name)) as key from suppliers where company_id = ${companyId}),
    outside as (
      select m.name as product_name, m.unit, m.my_unit, s.name as supplier_name, o.label,
        o.case_price / o.case_size as unit_price, s.min_order, s.delivery_fee, s.free_delivery_over,
        row_number() over (partition by m.id order by o.case_price / o.case_size) as rank
      from mine m
      join products op on lower(trim(op.name)) = m.key and lower(trim(op.unit)) = m.ukey and op.company_id <> ${companyId}
      join offers o on o.product_id = op.id
      join suppliers s on s.id = o.supplier_id
      where lower(trim(s.name)) not in (select key from my_suppliers)
    )
    select * from outside
    where rank = 1 and (my_unit is null or unit_price < my_unit * 0.97)
    order by (my_unit - unit_price) / nullif(my_unit, 0) desc nulls first
    limit 10`) as Row[];
  return rows.map((r) => ({
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
