import { todayInLondon } from "@/lib/optimise";
import { getWorkspace } from "@/lib/repo";
import { createOffer, createSupplier, removeOffer, removeSupplier, saveOffer, saveSupplier } from "../actions";
import { SupplierList } from "../SupplierList";
import { getUnlockedCompany } from "../unlocked";

export default async function SuppliersPage({ params }: PageProps<"/c/[id]/suppliers">) {
  const { id } = await params;
  if (!(await getUnlockedCompany(id))) return null; // the layout is showing the unlock form
  const ws = await getWorkspace(id);
  if (!ws) return null;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
      <p className="mt-1 text-sm text-muted">Each supplier&apos;s rules, and every way they sell each product.</p>
      <SupplierList
        suppliers={ws.suppliers}
        products={ws.products}
        offers={ws.offers}
        today={todayInLondon()}
        actions={{
          createSupplier: createSupplier.bind(null, id),
          saveSupplier: saveSupplier.bind(null, id),
          removeSupplier: removeSupplier.bind(null, id),
          createOffer: createOffer.bind(null, id),
          saveOffer: saveOffer.bind(null, id),
          removeOffer: removeOffer.bind(null, id),
        }}
      />
    </div>
  );
}
