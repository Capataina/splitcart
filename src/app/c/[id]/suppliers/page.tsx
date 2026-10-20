import { findCheaperElsewhere, type CheaperElsewhere } from "@/lib/network";
import { todayInLondon } from "@/lib/optimise";
import { getWorkspace } from "@/lib/repo";
import { money } from "@/app/format";
import type { FormState } from "@/components/ActionForm";
import {
  adoptOutsideSupplier,
  createSupplier,
  removeSupplier,
  saveSupplierCard,
} from "../actions";
import { AdoptSupplierButton } from "../AdoptSupplierButton";

type AdoptAction = (prev: FormState, data: FormData) => Promise<FormState>;
import { SupplierList } from "../SupplierList";
import { getUnlockedCompany } from "../unlocked";

export default async function SuppliersPage({ params }: PageProps<"/c/[id]/suppliers">) {
  const { id } = await params;
  if (!(await getUnlockedCompany(id))) return null; // the layout is showing the unlock form
  // Called only after the access check above, so the price book is never read for a locked business.
  const [ws, cheaper] = await Promise.all([getWorkspace(id), findCheaperElsewhere(id)]);
  if (!ws) return null;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
      <p className="mt-1 text-sm text-muted">Each supplier&apos;s rules, and every way they sell each product.</p>
      <CheaperElsewhereCard rows={cheaper} adopt={adoptOutsideSupplier.bind(null, id)} />
      <SupplierList
        suppliers={ws.suppliers}
        products={ws.products}
        offers={ws.offers}
        today={todayInLondon()}
        actions={{
          createSupplier: createSupplier.bind(null, id),
          saveSupplierCard: saveSupplierCard.bind(null, id),
          removeSupplier: removeSupplier.bind(null, id),
        }}
      />
    </div>
  );
}

/** One block per outside supplier: its cheaper products, its terms, and the one-click add. */
function CheaperElsewhereCard({ rows, adopt }: { rows: CheaperElsewhere[]; adopt: AdoptAction }) {
  const groups = new Map<string, CheaperElsewhere[]>();
  for (const r of rows) groups.set(r.supplierId, [...(groups.get(r.supplierId) ?? []), r]);
  return (
    <section className="lift mt-6 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Cheaper elsewhere</h2>
      <p className="mt-1 text-sm text-muted">
        From the shared price book: list prices other Splitcart businesses have entered. Only supplier prices are shared,
        never your quantities or your name.
      </p>
      {rows.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-background px-4 py-3 text-sm text-muted">
          <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-accent" aria-hidden>
            <path d="M4 6h16M4 12h10M4 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
          No cheaper suppliers found yet. The price book grows as more businesses join.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {[...groups.entries()].map(([supplierId, items]) => {
            const t = items[0];
            return (
              <div key={supplierId} className="rounded-lg border border-dashed border-accent/40 bg-accent-soft/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2">
                      <span className="font-semibold">{t.supplierName}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">Suggested</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted tabular-nums">
                      {t.minOrder > 0 ? `${money(t.minOrder)} minimum order` : "No minimum order"} ·{" "}
                      {t.deliveryFee > 0 ? `${money(t.deliveryFee)} delivery` : "Free delivery"}
                      {t.deliveryFee > 0 && t.freeDeliveryOver !== null ? `, free over ${money(t.freeDeliveryOver)}` : ""}
                    </p>
                  </div>
                  <AdoptSupplierButton supplierId={supplierId} action={adopt} />
                </div>
                <ul className="mt-3 divide-y divide-line/70">
                  {items.map((r) => (
                    <li key={`${r.productName}-${r.offerLabel}`} className="flex items-start justify-between gap-4 py-2 text-sm">
                      <p className="tabular-nums">
                        {t.supplierName} sells {r.productName} at {money(r.theirUnitPrice)}/{r.unit} ({r.offerLabel}).{" "}
                        {r.yourUnitPrice === null ? (
                          <span className="text-muted">None of your suppliers stock it.</span>
                        ) : (
                          <>You pay {money(r.yourUnitPrice)}/{r.unit}.</>
                        )}
                      </p>
                      {r.yourUnitPrice !== null && r.yourUnitPrice > 0 ? (
                        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium tabular-nums text-accent">
                          {Math.round((1 - r.theirUnitPrice / r.yourUnitPrice) * 100)}% cheaper
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">New</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
