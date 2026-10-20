import { todayInLondon } from "@/lib/optimise";
import { adviseSellPrice, unitCost } from "@/lib/pricing";
import { getWorkspace } from "@/lib/repo";
import type { PriceAdvice } from "@/lib/types";
import { createProduct, removeProduct, saveProduct, saveProductPricing } from "../actions";
import { ProductTable } from "../ProductTable";
import { getUnlockedCompany } from "../unlocked";

export default async function NeedsPage({ params }: PageProps<"/c/[id]/needs">) {
  const { id } = await params;
  if (!(await getUnlockedCompany(id))) return null; // the layout is showing the unlock form
  const ws = await getWorkspace(id);
  if (!ws) return null;
  const today = todayInLondon();
  const advice: Record<string, PriceAdvice> = Object.fromEntries(
    ws.products.map((p) => [p.id, adviseSellPrice(p, unitCost(p, ws.offers, today))]),
  );
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">What you need</h1>
      <p className="mt-1 text-sm text-muted">Quantities for this order. Set one to 0 to skip it.</p>
      <div className="mt-6 rounded-xl border border-line bg-surface py-3">
        <ProductTable
          products={ws.products}
          advice={advice}
          create={createProduct.bind(null, id)}
          save={saveProduct.bind(null, id)}
          savePricing={saveProductPricing.bind(null, id)}
          remove={removeProduct.bind(null, id)}
        />
      </div>
    </div>
  );
}
