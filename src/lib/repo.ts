import { sql } from "./db";
import type { Company, CompanyKind, Offer, OptimisationResult, Product, Supplier, Workspace } from "./types";

// Plain SQL data access. Every function scoped to a company takes its id, and
// child rows are always filtered through company_id so one company can never
// touch another's suppliers, products or offers.

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const toCompany = (r: Row): Company => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as CompanyKind,
  plan: r.plan as Company["plan"],
  createdAt: String(r.created_at),
});
const toSupplier = (r: Row): Supplier => ({
  id: r.id as string,
  name: r.name as string,
  minOrder: Number(r.min_order),
  deliveryFee: Number(r.delivery_fee),
  freeDeliveryOver: num(r.free_delivery_over),
});
const toProduct = (r: Row): Product => ({
  id: r.id as string,
  name: r.name as string,
  unit: r.unit as string,
  neededQty: Number(r.needed_qty),
});
const toOffer = (r: Row): Offer => ({
  id: r.id as string,
  supplierId: r.supplier_id as string,
  productId: r.product_id as string,
  label: r.label as string,
  maxBuys: num(r.max_buys),
  caseSize: Number(r.case_size),
  casePrice: Number(r.case_price),
  promoPrice: num(r.promo_price),
  promoUntil: r.promo_until ? new Date(r.promo_until as string).toISOString().slice(0, 10) : null,
});

export async function createCompany(name: string, kind: CompanyKind, accessHash: string): Promise<string> {
  const rows = (await sql()`insert into companies (name, kind, access_hash) values (${name}, ${kind}, ${accessHash}) returning id`) as Row[];
  return rows[0].id as string;
}

/** Company plus its access hash (server-only: never send the hash to the client). */
export async function getCompanyAuth(id: string): Promise<{ company: Company; accessHash: string } | null> {
  if (!isUuid(id)) return null;
  const rows = (await sql()`select * from companies where id = ${id}`) as Row[];
  if (!rows[0]) return null;
  return { company: toCompany(rows[0]), accessHash: rows[0].access_hash as string };
}

export async function getWorkspace(companyId: string): Promise<Workspace | null> {
  const q = sql();
  const [c, s, p, o, r] = (await Promise.all([
    q`select * from companies where id = ${companyId}`,
    q`select * from suppliers where company_id = ${companyId} order by created_at`,
    q`select * from products where company_id = ${companyId} order by created_at`,
    q`select o.* from offers o join suppliers s on s.id = o.supplier_id where s.company_id = ${companyId}`,
    q`select count(*)::int as n from runs where company_id = ${companyId}`,
  ])) as Row[][];
  if (!c[0]) return null;
  return {
    company: toCompany(c[0]),
    suppliers: s.map(toSupplier),
    products: p.map(toProduct),
    offers: o.map(toOffer),
    runCount: Number(r[0].n),
  };
}

export async function addSupplier(companyId: string, s: Omit<Supplier, "id">) {
  await sql()`insert into suppliers (company_id, name, min_order, delivery_fee, free_delivery_over)
    values (${companyId}, ${s.name}, ${s.minOrder}, ${s.deliveryFee}, ${s.freeDeliveryOver})`;
}

export async function updateSupplier(companyId: string, s: Supplier) {
  await sql()`update suppliers set name = ${s.name}, min_order = ${s.minOrder}, delivery_fee = ${s.deliveryFee},
    free_delivery_over = ${s.freeDeliveryOver} where id = ${s.id} and company_id = ${companyId}`;
}

export async function deleteSupplier(companyId: string, supplierId: string) {
  await sql()`delete from suppliers where id = ${supplierId} and company_id = ${companyId}`;
}

export async function addProduct(companyId: string, p: Omit<Product, "id">) {
  await sql()`insert into products (company_id, name, unit, needed_qty) values (${companyId}, ${p.name}, ${p.unit}, ${p.neededQty})`;
}

export async function updateProduct(companyId: string, p: Product) {
  await sql()`update products set name = ${p.name}, unit = ${p.unit}, needed_qty = ${p.neededQty}
    where id = ${p.id} and company_id = ${companyId}`;
}

export async function deleteProduct(companyId: string, productId: string) {
  await sql()`delete from products where id = ${productId} and company_id = ${companyId}`;
}

/** Add a way to buy a product from a supplier; both must belong to the company. */
export async function addOffer(companyId: string, o: Omit<Offer, "id">) {
  await sql()`insert into offers (supplier_id, product_id, label, case_size, case_price, promo_price, promo_until, max_buys)
    select ${o.supplierId}, ${o.productId}, ${o.label}, ${o.caseSize}, ${o.casePrice}, ${o.promoPrice}, ${o.promoUntil}, ${o.maxBuys}
    where exists (select 1 from suppliers where id = ${o.supplierId} and company_id = ${companyId})
      and exists (select 1 from products where id = ${o.productId} and company_id = ${companyId})`;
}

export async function updateOffer(companyId: string, o: Offer) {
  await sql()`update offers o set label = ${o.label}, case_size = ${o.caseSize}, case_price = ${o.casePrice},
    promo_price = ${o.promoPrice}, promo_until = ${o.promoUntil}, max_buys = ${o.maxBuys}
    from suppliers s where o.id = ${o.id} and s.id = o.supplier_id and s.company_id = ${companyId}`;
}

export async function deleteOffer(companyId: string, offerId: string) {
  await sql()`delete from offers o using suppliers s where o.id = ${offerId} and s.id = o.supplier_id and s.company_id = ${companyId}`;
}

export async function saveRun(companyId: string, result: OptimisationResult): Promise<string> {
  const rows = (await sql()`insert into runs (company_id, total, baseline, result)
    values (${companyId}, ${result.plan?.total ?? null}, ${result.baseline?.plan.total ?? null}, ${JSON.stringify(result)})
    returning id`) as Row[];
  return rows[0].id as string;
}

export interface RunSummary {
  id: string;
  createdAt: string;
  total: number | null;
  baseline: number | null;
}

export async function listRuns(companyId: string): Promise<RunSummary[]> {
  const rows = (await sql()`select id, created_at, total, baseline from runs where company_id = ${companyId} order by created_at desc limit 20`) as Row[];
  return rows.map((r) => ({ id: r.id as string, createdAt: String(r.created_at), total: num(r.total), baseline: num(r.baseline) }));
}

export async function getRun(companyId: string, runId: string): Promise<{ createdAt: string; result: OptimisationResult } | null> {
  if (!isUuid(runId)) return null;
  const rows = (await sql()`select created_at, result from runs where id = ${runId} and company_id = ${companyId}`) as Row[];
  if (!rows[0]) return null;
  return { createdAt: String(rows[0].created_at), result: rows[0].result as OptimisationResult };
}
