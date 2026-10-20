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
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  neededQty: number;
}

export interface Offer {
  id: string;
  supplierId: string;
  productId: string;
  caseSize: number;
  casePrice: number;
  promoPrice: number | null;
  promoUntil: string | null; // ISO date, inclusive
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
  unavailable: string[]; // products with demand that no supplier offers
  notes: string[]; // human-readable explanations (why infeasible, which rules bit)
  solvedAt: string;
}
