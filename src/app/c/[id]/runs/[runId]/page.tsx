import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "@/lib/repo";
import type { OptimisationResult, SupplierOrder } from "@/lib/types";
import { dateTime, money, qty } from "@/app/format";
import { getUnlockedCompany } from "../../unlocked";
import { ExportOrders } from "./ExportOrders";

export const metadata: Metadata = { title: "Optimised order · Splitcart", robots: { index: false } };

export default async function RunPage({ params }: PageProps<"/c/[id]/runs/[runId]">) {
  const { id, runId } = await params;
  const company = await getUnlockedCompany(id);
  if (!company) return null; // the layout is showing the unlock form
  const run = await getRun(id, runId);
  if (!run) notFound();
  const { result } = run;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4 text-sm">
        <Link href={`/c/${id}`} className="font-medium text-accent hover:underline">
          ← Back to dashboard
        </Link>
        <span className="text-muted">Optimised {dateTime(run.createdAt)}</span>
      </div>
      <Headline result={result} />
      <NetworkSaving result={result} />
      <Warnings result={result} />
      {result.status === "optimal" && result.plan ? (
          <>
            <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {result.plan.orders.length === 1 ? "Your order" : `Your ${result.plan.orders.length} orders`}
              </h2>
              <ExportOrders plan={result.plan} businessName={company.name} fileName={`splitcart-order-${run.createdAt.slice(0, 10)}.csv`} />
            </div>
            <div className="mt-4 space-y-6">
              {result.plan.orders.map((order) => (
                <PurchaseOrder key={order.supplierId} order={order} businessName={company.name} />
              ))}
            </div>
            {result.plan.orders.length > 1 ? (
              <dl className="mt-6 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
                <dt className="text-muted">Goods</dt>
                <dd className="text-right">{money(result.plan.goodsTotal)}</dd>
                <dt className="text-muted">Delivery</dt>
                <dd className="text-right">{money(result.plan.deliveryTotal)}</dd>
                <dt className="border-t border-line pt-1 font-semibold">All orders</dt>
                <dd className="border-t border-line pt-1 text-right font-semibold">{money(result.plan.total)}</dd>
              </dl>
            ) : null}
          </>
        ) : null}
    </div>
  );
}

/** The finding first: what this order costs and what it saves, or why there is no order. */
function Headline({ result }: { result: OptimisationResult }) {
  if (result.status === "nothing-to-order") {
    return (
      <div className="mt-3">
        <h1 className="text-3xl font-semibold tracking-tight">Nothing to order this time</h1>
        <p className="mt-2 text-muted">
          Every product has a quantity of 0. Set how much you need on the dashboard, then optimise again.
        </p>
      </div>
    );
  }
  if (result.status === "infeasible" || !result.plan) {
    return (
      <div className="mt-3">
        <h1 className="text-3xl font-semibold tracking-tight">No order meets every supplier&apos;s rules</h1>
        <p className="mt-2 text-muted">
          {result.notes.length > 0
            ? "Here is what stands in the way:"
            : "The optimiser could not find a combination that covers what you need."}
        </p>
      </div>
    );
  }
  const { plan, baseline, savings } = result;
  return (
    <div className="mt-3">
      {savings !== null && savings > 0.005 ? (
        <>
          <p className="text-5xl font-semibold tracking-tight text-accent tabular-nums sm:text-6xl">{money(savings)} saved</p>
          <h1 className="mt-3 text-xl font-medium tabular-nums sm:text-2xl">
            {money(plan.total)} total, saving {money(savings)} vs ordering everything from {baseline?.supplierName}
          </h1>
          {baseline ? (
            <p className="mt-1 text-sm text-muted tabular-nums">
              {baseline.supplierName} alone would cost {money(baseline.plan.total)}.
            </p>
          ) : null}
        </>
      ) : baseline ? (
        <>
          <h1 className="text-4xl font-semibold tracking-tight tabular-nums">{money(plan.total)} total</h1>
          <p className="mt-2 text-muted">
            Ordering everything from {baseline.supplierName} is already the cheapest way; splitting would not save anything.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-4xl font-semibold tracking-tight tabular-nums">{money(plan.total)} total</h1>
          <p className="mt-2 text-muted">
            No single supplier stocks everything you need, so there is nothing to compare against: this split is the
            cheapest way to get it all.
          </p>
        </>
      )}
    </div>
  );
}

/** What the order would cost with suppliers from the shared price book added. Older runs have no `network`. */
function NetworkSaving({ result }: { result: OptimisationResult }) {
  const net = result.network;
  if (!net || !(net.extraSaving > 0.005)) return null;
  const fresh = new Set(net.newSuppliers);
  const lines = net.plan.orders.filter((o) => fresh.has(o.supplierName));
  return (
    // An alternative branch, not a correction: the plan above is the cheapest with the
    // suppliers you chose; this one also uses suppliers you don't work with yet.
    <div className="mt-6 rounded-xl border border-dashed border-accent/50 bg-accent-soft/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Option B · with new suppliers</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-accent">
        With {joinNames(net.newSuppliers)}: {money(net.total)}, {money(net.extraSaving)} less
      </p>
      <p className="mt-1 text-sm text-muted">
        Your plan below is the cheapest with your own suppliers. This option also buys from {joinNames(net.newSuppliers)}, found in the shared price book.
        To use it, add them on the Suppliers page and optimise again.
      </p>
      {lines.length > 0 ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-accent">What you&apos;d buy from them</summary>
          <ul className="mt-2 divide-y divide-accent/15 tabular-nums">
            {lines.flatMap((o) =>
              o.lines.map((l) => (
                <li key={`${o.supplierId}-${l.productId}-${l.offerLabel}`} className="flex justify-between gap-4 py-1.5">
                  <span>
                    {l.productName} <span className="text-muted">({l.offerLabel}) from {o.supplierName}</span>
                  </span>
                  <span className="whitespace-nowrap">{money(l.lineTotal)}</span>
                </li>
              )),
            )}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "these suppliers";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Warnings({ result }: { result: OptimisationResult }) {
  if (result.unavailable.length === 0 && result.notes.length === 0) return null;
  return (
    <div className="mt-6 space-y-3">
      {result.unavailable.length > 0 ? (
        <div role="status" className="rounded-lg border border-promo/30 bg-promo-soft px-4 py-3 text-sm text-promo">
          <p className="font-semibold">Not covered by any supplier</p>
          <p className="mt-1">
            {result.unavailable.join(", ")}: no supplier has a price for {result.unavailable.length === 1 ? "it" : "them"}, so{" "}
            {result.unavailable.length === 1 ? "it is" : "they are"} left out of this order.
          </p>
        </div>
      ) : null}
      {result.notes.length > 0 ? (
        <ul
          className={`space-y-1 rounded-lg border px-4 py-3 text-sm ${
            result.status === "infeasible" ? "border-danger/30 bg-danger-soft text-danger" : "border-line bg-surface text-foreground"
          }`}
        >
          {result.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A mailto link that opens the owner's own mail app with the order written out, so
 * it is sent from their address and we never send email or touch their mailbox.
 */
function orderMailto(order: SupplierOrder, businessName: string): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  const lines = order.lines.map((l) => `- ${l.cases} x ${l.offerLabel || `${l.caseSize} ${l.unit}`} ${l.productName} @ £${l.casePrice.toFixed(2)} = £${l.lineTotal.toFixed(2)}`);
  const body = [
    "Hello,",
    "",
    `Please could we order the following for delivery:`,
    "",
    ...lines,
    "",
    `Goods total: £${order.subtotal.toFixed(2)}`,
    "",
    "Thanks,",
    businessName,
  ].join("\n");
  return `mailto:${encodeURIComponent(order.supplierEmail ?? "")}?subject=${encodeURIComponent(`Order from ${businessName}, ${date}`)}&body=${encodeURIComponent(body)}`;
}

function PurchaseOrder({ order, businessName }: { order: SupplierOrder; businessName: string }) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h3 className="text-lg font-semibold">{order.supplierName}</h3>
        <div className="flex items-center gap-4">
          <a
            href={orderMailto(order, businessName)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent active:scale-[0.98]"
            title={order.supplierEmail ? `Opens your mail app addressed to ${order.supplierEmail}` : "Opens your mail app; add the supplier's email to fill in the address"}
          >
            Email order
          </a>
          <p className="text-lg font-semibold tabular-nums">{money(order.total)}</p>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-5 pb-2 pt-3 font-medium">Product</th>
              <th className="px-3 pb-2 pt-3 font-medium">Buy</th>
              <th className="px-3 pb-2 pt-3 text-right font-medium">Each</th>
              <th className="px-5 pb-2 pt-3 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {order.lines.map((line, i) => (
              <tr key={`${line.productId}-${i}`} className="border-t border-line">
                <td className="px-5 py-2.5">
                  <span className="font-medium">{line.productName}</span>
                  {line.offerLabel ? <span className="block text-xs text-muted">{line.offerLabel}</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  {line.cases} × {qty(line.caseSize)} {line.unit}
                  <span className="block text-xs text-muted">
                    {qty(line.unitsBought)} {line.unit} in total
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {money(line.casePrice)}
                  {line.promoApplied ? (
                    <span className="ml-2 rounded bg-promo-soft px-1.5 py-0.5 text-xs font-medium text-promo">promo</span>
                  ) : null}
                </td>
                <td className="px-5 py-2.5 text-right">{money(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="tabular-nums">
            <tr className="border-t border-line">
              <td colSpan={3} className="px-5 pt-3 text-right text-muted">
                Subtotal
              </td>
              <td className="px-5 pt-3 text-right">{money(order.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-5 py-1 text-right text-muted">
                Delivery
              </td>
              <td className={`px-5 py-1 text-right ${order.deliveryFee === 0 ? "font-medium text-accent" : ""}`}>
                {order.deliveryFee === 0 ? "Free delivery" : money(order.deliveryFee)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="px-5 pb-4 pt-1 text-right font-semibold">
                Total
              </td>
              <td className="px-5 pb-4 pt-1 text-right font-semibold">{money(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
