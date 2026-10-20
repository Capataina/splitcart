"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { grantAccess, hasAccess, revokeAccess, verifyCode } from "@/lib/access";
import {
  addOffer,
  addProduct,
  addSupplier,
  deleteOffer,
  deleteProduct,
  deleteSupplier,
  getCompanyAuth,
  getWorkspace,
  updateOffer,
  updateProduct,
  updateSupplier,
} from "@/lib/repo";
import { headers } from "next/headers";
import { freeRunUsed, ipHash, lockoutMinutes, recordFailure, saveRunIfAllowed } from "@/lib/guard";
import { adoptSupplier, outsideOptions } from "@/lib/network";
import { optimise, todayInLondon } from "@/lib/optimise";
import type { Offer, Product, Supplier } from "@/lib/types";
import type { FormState } from "@/components/ActionForm";
import { FieldError, id, isUuid, number, optionalDate, optionalNumber, text, values } from "../../validate";

// Every action re-checks access itself: the page hiding a form is not
// authorisation, since a server action is callable by anyone with its id.
// Only the company id is bound from the page; the access hash never leaves the server.

class Locked extends Error {}

async function requireAccess(companyId: string) {
  if (!isUuid(companyId)) throw new Locked();
  const auth = await getCompanyAuth(companyId);
  if (!auth || !(await hasAccess(companyId, auth.accessHash))) throw new Locked();
  return auth;
}

/** Runs a mutation with validation and access errors turned into form messages. */
async function mutate(companyId: string, data: FormData, keepValues: boolean, work: () => Promise<void>): Promise<FormState> {
  try {
    await requireAccess(companyId);
    await work();
  } catch (e) {
    const back = keepValues ? values(data) : undefined;
    if (e instanceof FieldError) return { error: e.message, values: back };
    if (e instanceof Locked) return { error: "This business is locked on this device. Reload and enter the code.", values: back };
    console.error("mutation failed", { companyId, error: e });
    return { error: "Could not save that right now. Try again in a moment.", values: back };
  }
  // "layout" covers every route under /c/[id] (overview counts, needs, suppliers).
  revalidatePath(`/c/${companyId}`, "layout");
  return { ok: Date.now() };
}

// ---- Access ---------------------------------------------------------------

export async function unlock(companyId: string, _prev: FormState, data: FormData): Promise<FormState> {
  const auth = isUuid(companyId) ? await getCompanyAuth(companyId) : null;
  if (!auth) return { error: "This business no longer exists." };
  const wait = await lockoutMinutes(companyId);
  if (wait) return { error: `Too many wrong codes. Try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  const code = data.get("code");
  if (typeof code !== "string" || !code || code.length > 200 || !verifyCode(code, auth.accessHash)) {
    await recordFailure(companyId);
    return { error: "Wrong code" };
  }
  await grantAccess(companyId, auth.accessHash, data.get("remember") === "on");
  redirect(`/c/${companyId}`);
}

export async function lock(companyId: string) {
  await revokeAccess(companyId);
  redirect(`/c/${companyId}`);
}

// ---- Suppliers --------------------------------------------------------------

function readSupplier(data: FormData): Omit<Supplier, "id"> {
  return {
    name: text(data, "name", "Supplier name"),
    minOrder: optionalNumber(data, "minOrder", "Minimum order") ?? 0,
    deliveryFee: optionalNumber(data, "deliveryFee", "Delivery fee") ?? 0,
    freeDeliveryOver: optionalNumber(data, "freeDeliveryOver", "Free delivery over"),
  };
}

export async function createSupplier(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, true, () => addSupplier(companyId, readSupplier(data)));
}

export async function removeSupplier(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, () => deleteSupplier(companyId, id(data, "id")));
}

/** Copies a shared-price-book supplier and its list prices into this business's own suppliers. */
export async function adoptOutsideSupplier(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, async () => {
    const name = await adoptSupplier(companyId, id(data, "supplierId"));
    if (name === null) throw new FieldError("That supplier is no longer in the price book.");
  });
}

// ---- Products ---------------------------------------------------------------

function readProduct(data: FormData): Pick<Product, "name" | "unit" | "neededQty"> {
  return {
    name: text(data, "name", "Product name"),
    unit: text(data, "unit", "Unit"),
    neededQty: number(data, "neededQty", "Quantity needed"),
  };
}

/** updateProduct writes every column, so each partial edit starts from the stored row. */
async function storedProduct(companyId: string, productId: string): Promise<Product> {
  const product = (await getWorkspace(companyId))?.products.find((p) => p.id === productId);
  if (!product) throw new FieldError("That product no longer exists. Reload the page.");
  return product;
}

const MAX_PRICE_TESTS = 50;

/** Sell range plus the "prices you've tried" rows, sent as parallel testPrice/testSold fields. */
function readPricing(data: FormData): Pick<Product, "sellMin" | "sellMax" | "priceTests"> {
  const sellMin = optionalNumber(data, "sellMin", "Lowest sell price");
  const sellMax = optionalNumber(data, "sellMax", "Highest sell price");
  if (sellMin !== null && sellMax !== null && sellMin > sellMax) {
    throw new FieldError("The lowest sell price must not be above the highest.");
  }
  const prices = data.getAll("testPrice");
  const sold = data.getAll("testSold");
  if (prices.length !== sold.length) throw new FieldError("Each price you've tried needs a weekly sales figure.");
  const priceTests: Product["priceTests"] = [];
  prices.forEach((rawPrice, i) => {
    const p = typeof rawPrice === "string" ? rawPrice.trim() : "";
    const s = typeof sold[i] === "string" ? (sold[i] as string).trim() : "";
    if (!p && !s) return; // an empty row the owner added and left
    const row = new FormData();
    row.set("price", p);
    row.set("sold", s);
    priceTests.push({
      price: number(row, "price", `Tried price ${i + 1}`, { positive: true }),
      weeklySold: number(row, "sold", `Sold per week ${i + 1}`),
    });
  });
  if (priceTests.length > MAX_PRICE_TESTS) throw new FieldError(`Keep it to ${MAX_PRICE_TESTS} tried prices.`);
  return { sellMin, sellMax, priceTests };
}

export async function createProduct(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, true, () => addProduct(companyId, readProduct(data)));
}

/**
 * Saves the What-you-need table from its edit mode in one submit: each row arrives as
 * "p.<productId>.<field>", with "p.<productId>.remove" = 1 for rows marked for deletion.
 * Every row is validated before the first write, so a bad row saves nothing.
 */
export async function saveProducts(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, async () => {
    const ids = new Set<string>();
    for (const k of data.keys()) {
      const m = /^p\.([^.]+)\./.exec(k);
      if (m) ids.add(m[1]);
    }
    const stored = (await getWorkspace(companyId))?.products ?? [];
    const updates: Product[] = [];
    const removals: string[] = [];
    for (const productId of ids) {
      const current = stored.find((p) => p.id === productId);
      if (!isUuid(productId) || !current) throw new FieldError("A product in the table no longer exists. Reload the page.");
      const row = rowData(data, `p.${productId}.`);
      if (row.get("remove") === "1") removals.push(productId);
      else updates.push({ ...current, ...readProduct(row) });
    }
    for (const p of updates) await updateProduct(companyId, p);
    for (const productId of removals) await deleteProduct(companyId, productId);
  });
}

export async function saveProductPricing(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, async () => {
    const pricing = readPricing(data);
    const current = await storedProduct(companyId, id(data, "id"));
    await updateProduct(companyId, { ...current, ...pricing });
  });
}


// ---- Offers (ways to buy) -----------------------------------------------------

function readOfferTerms(data: FormData): Pick<Offer, "label" | "caseSize" | "casePrice" | "promoPrice" | "promoUntil" | "maxBuys"> {
  const caseSize = number(data, "caseSize", "Units per buy", { positive: true });
  const promoPrice = optionalNumber(data, "promoPrice", "Promo price");
  const promoUntil = optionalDate(data, "promoUntil", "Promo end date");
  if ((promoPrice === null) !== (promoUntil === null)) {
    throw new FieldError("A promo needs both a price and the date it ends.");
  }
  const rawLabel = data.get("label");
  const label = typeof rawLabel === "string" ? rawLabel.trim().slice(0, 120) : "";
  return {
    label,
    caseSize,
    casePrice: number(data, "casePrice", "Price per buy"),
    promoPrice,
    promoUntil,
    maxBuys: optionalNumber(data, "maxBuys", "Max per order", { positive: true, integer: true }),
  };
}

/** The fields under one row prefix ("o.<offerId>." or "n.<key>."), as their own FormData for readOfferTerms. */
function rowData(data: FormData, prefix: string): FormData {
  const out = new FormData();
  for (const [k, v] of data.entries()) if (k.startsWith(prefix)) out.set(k.slice(prefix.length), v);
  return out;
}

/**
 * Saves a whole supplier card from its edit mode in one submit: the supplier's rules,
 * every existing offer (updated, or deleted when marked), and any new ways to buy.
 * Everything is validated before the first write, so a bad row saves nothing.
 */
export async function saveSupplierCard(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, async () => {
    const supplierId = id(data, "id");
    const supplier = { id: supplierId, ...readSupplier(data) };
    const prefixes = new Set<string>();
    for (const k of data.keys()) {
      const m = /^([on])\.([^.]+)\./.exec(k);
      if (m) prefixes.add(`${m[1]}.${m[2]}.`);
    }
    const updates: Parameters<typeof updateOffer>[1][] = [];
    const removals: string[] = [];
    const additions: Parameters<typeof addOffer>[1][] = [];
    for (const p of prefixes) {
      const row = rowData(data, p);
      if (p.startsWith("o.")) {
        const offerId = p.slice(2, -1);
        if (!isUuid(offerId)) throw new FieldError("That price row is not recognised. Reload and try again.");
        if (row.get("remove") === "1") removals.push(offerId);
        else updates.push({ id: offerId, supplierId, productId: id(row, "productId"), ...readOfferTerms(row) });
      } else {
        additions.push({ supplierId, productId: id(row, "productId"), ...readOfferTerms(row) });
      }
    }
    await updateSupplier(companyId, supplier);
    for (const o of updates) await updateOffer(companyId, o);
    for (const o of additions) await addOffer(companyId, o);
    for (const offerId of removals) await deleteOffer(companyId, offerId);
  });
}


// ---- Optimise -----------------------------------------------------------------

export type OptimiseState = { error?: string; upgrade?: boolean } | undefined;

// useActionState also passes the previous state; the run does not depend on it.
export async function runOptimiser(companyId: string): Promise<OptimiseState> {
  let runId: string;
  try {
    await requireAccess(companyId);
    const ws = await getWorkspace(companyId);
    if (!ws) return { error: "This business no longer exists." };
    const ip = ipHash(await headers());
    if (await freeRunUsed(companyId, ip)) return { upgrade: true };
    if (ws.products.length === 0) return { error: "Add at least one product before optimising." };
    if (ws.suppliers.length === 0) return { error: "Add at least one supplier before optimising." };
    const result = await optimise(ws, todayInLondon(), await outsideOptions(companyId));
    const saved = await saveRunIfAllowed(companyId, ip, result);
    if (!saved) return { upgrade: true };
    runId = saved;
  } catch (e) {
    if (e instanceof Locked) return { error: "This business is locked on this device. Reload and enter the code." };
    console.error("optimise failed", { companyId, error: e });
    return { error: `The optimiser could not run: ${e instanceof Error ? e.message : String(e)}` };
  }
  revalidatePath(`/c/${companyId}`, "layout");
  redirect(`/c/${companyId}/runs/${runId}`);
}
