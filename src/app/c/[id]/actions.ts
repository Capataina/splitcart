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
  saveRun,
  updateOffer,
  updateProduct,
  updateSupplier,
} from "@/lib/repo";
import { outsideOptions } from "@/lib/network";
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
  const code = data.get("code");
  if (typeof code !== "string" || !code || code.length > 200 || !verifyCode(code, auth.accessHash)) {
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

export async function saveSupplier(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, true, () => updateSupplier(companyId, { id: id(data, "id"), ...readSupplier(data) }));
}

export async function removeSupplier(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, () => deleteSupplier(companyId, id(data, "id")));
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

export async function saveProduct(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, true, async () => {
    const fields = readProduct(data);
    const current = await storedProduct(companyId, id(data, "id"));
    await updateProduct(companyId, { ...current, ...fields });
  });
}

export async function saveProductPricing(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, async () => {
    const pricing = readPricing(data);
    const current = await storedProduct(companyId, id(data, "id"));
    await updateProduct(companyId, { ...current, ...pricing });
  });
}

export async function removeProduct(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, () => deleteProduct(companyId, id(data, "id")));
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

export async function createOffer(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, true, () =>
    addOffer(companyId, { supplierId: id(data, "supplierId"), productId: id(data, "productId"), ...readOfferTerms(data) }),
  );
}

export async function saveOffer(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, true, () =>
    updateOffer(companyId, {
      id: id(data, "id"),
      supplierId: id(data, "supplierId"),
      productId: id(data, "productId"),
      ...readOfferTerms(data),
    }),
  );
}

export async function removeOffer(companyId: string, _prev: FormState, data: FormData) {
  return mutate(companyId, data, false, () => deleteOffer(companyId, id(data, "id")));
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
    if (ws.company.plan === "free" && ws.runCount >= 1) return { upgrade: true };
    if (ws.products.length === 0) return { error: "Add at least one product before optimising." };
    if (ws.suppliers.length === 0) return { error: "Add at least one supplier before optimising." };
    const result = await optimise(ws, todayInLondon(), await outsideOptions(companyId));
    runId = await saveRun(companyId, result);
  } catch (e) {
    if (e instanceof Locked) return { error: "This business is locked on this device. Reload and enter the code." };
    console.error("optimise failed", { companyId, error: e });
    return { error: `The optimiser could not run: ${e instanceof Error ? e.message : String(e)}` };
  }
  revalidatePath(`/c/${companyId}`, "layout");
  redirect(`/c/${companyId}/runs/${runId}`);
}
