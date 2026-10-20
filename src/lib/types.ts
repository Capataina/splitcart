// Shared shapes between the database layer, the solver and the UI.
// Money is GBP as a plain number; quantities are in the product's unit.

export type CompanyKind = "cafe" | "restaurant" | "takeaway" | "shop" | "other";

export interface Company {
  id: string;
  name: string;
  kind: CompanyKind;
  plan: "free" | "pro";
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  minOrder: number;
  deliveryFee: number;
  freeDeliveryOver: number | null;
  email?: string | null; // where orders go; used for a mailto link from the owner's own mail app
}

export interface PriceTest {
  price: number; // £ per unit sold
  weeklySold: number; // units sold per week at that price
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  neededQty: number;
  sellMin: number | null; // optional selling-price range
  sellMax: number | null;
  priceTests: PriceTest[];
}

export type PriceAdvice =
  | { kind: "price"; price: number; unitCost: number; expectedWeekly: number; weeklyProfit: number; clamped: boolean }
  | { kind: "need-data"; reason: string };

/**
 * One way to buy a product from a supplier: `caseSize` units for `casePrice`, in
 * whole multiples ("buys"). Singles and cases of the same item are two offers.
 */
export interface Offer {
  id: string;
  supplierId: string;
  productId: string;
  label: string; // e.g. "Single 1 kg", "Case 6 x 1 kg"
  caseSize: number; // units of the product's unit per buy
  casePrice: number; // £ per buy
  promoPrice: number | null; // replaces casePrice while promoUntil >= today
  promoUntil: string | null; // ISO date, inclusive
  maxBuys: number | null; // per-order cap (promo limit, stock)
  lastChange?: { from: number; at: string } | null; // most recent list-price change, for alerts
}

export interface Workspace {
  company: Company;
  suppliers: Supplier[];
  products: Product[];
  offers: Offer[];
  runCount: number;
}

export interface OrderLine {
  productId: string;
  productName: string;
  offerLabel: string;
  unit: string;
  cases: number;
  caseSize: number;
  unitsBought: number;
  casePrice: number; // price actually paid per case (promo applied)
  promoApplied: boolean;
  lineTotal: number;
}

export interface SupplierOrder {
  supplierId: string;
  supplierName: string;
  supplierEmail?: string | null;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number; // 0 when the free-delivery threshold is reached
  total: number;
}

export interface Plan {
  orders: SupplierOrder[];
  goodsTotal: number;
  deliveryTotal: number;
  total: number;
}

export interface OptimisationResult {
  status: "optimal" | "infeasible" | "nothing-to-order";
  plan: Plan | null;
  // Best plan using a single supplier for everything, the way most owners order today.
  baseline: { supplierName: string; plan: Plan } | null;
  savings: number | null; // baseline.total - plan.total
  // The same order re-solved with suppliers from the shared price book added, when that is cheaper.
  network?: { total: number; extraSaving: number; newSuppliers: string[]; plan: Plan } | null;
  unavailable: string[]; // products with demand that no supplier offers
  notes: string[]; // human-readable explanations (why infeasible, which rules bit)
  solvedAt: string;
}
