"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { ActionForm, SubmitButton, type FormState } from "@/components/ActionForm";
import { INPUT } from "@/components/fieldStyles";
import { money, qty, shortDate } from "@/app/format";
import type { Offer, Product, Supplier } from "@/lib/types";

type Action = (prev: FormState, data: FormData) => Promise<FormState>;
type Actions = Record<"createSupplier" | "saveSupplierCard" | "removeSupplier", Action>;

export function SupplierList({
  suppliers,
  products,
  offers,
  today,
  actions,
}: {
  suppliers: Supplier[];
  products: Product[];
  offers: Offer[];
  today: string;
  actions: Actions;
}) {
  const priced = new Set(offers.map((o) => o.productId));
  const unpriced = products.filter((p) => p.neededQty > 0 && !priced.has(p.id));
  return (
    <div className="mt-6 space-y-5">
      {unpriced.length > 0 && suppliers.length > 0 ? (
        <p role="status" className="rounded-lg bg-accent-soft px-4 py-2.5 text-sm text-accent">
          No supplier price yet for {unpriced.map((p) => p.name).join(", ")}.
        </p>
      ) : null}
      {suppliers.map((s) => (
        <SupplierCard
          key={s.id}
          supplier={s}
          products={products}
          offers={offers.filter((o) => o.supplierId === s.id)}
          today={today}
          actions={actions}
        />
      ))}
      <section className="rounded-xl border border-dashed border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">{suppliers.length === 0 ? "Add your first supplier" : "Add a supplier"}</h2>
        <ActionForm action={actions.createSupplier} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          {(v) => (
            <>
              <input name="name" aria-label="Supplier name" placeholder="Name, e.g. Bookers" required maxLength={120} defaultValue={v.name} className={INPUT} />
              <input name="minOrder" aria-label="Minimum order £" inputMode="decimal" placeholder="Min order £" defaultValue={v.minOrder} className={`${INPUT} tabular-nums`} />
              <input name="deliveryFee" aria-label="Delivery fee £" inputMode="decimal" placeholder="Delivery £" defaultValue={v.deliveryFee} className={`${INPUT} tabular-nums`} />
              <input name="freeDeliveryOver" aria-label="Free delivery over £ (blank for never)" inputMode="decimal" placeholder="Free over £" defaultValue={v.freeDeliveryOver} className={`${INPUT} tabular-nums`} />
              <SubmitButton pendingLabel="Adding…">Add supplier</SubmitButton>
            </>
          )}
        </ActionForm>
      </section>
    </div>
  );
}

/** "£100 minimum · £12 delivery · free delivery over £250", with the plain words when a rule is off. */
function rulesLine(s: Supplier): string {
  const min = s.minOrder > 0 ? `${money(s.minOrder)} minimum` : "no minimum";
  if (s.deliveryFee <= 0) return `${min} · free delivery`;
  const over = s.freeDeliveryOver !== null ? ` · free delivery over ${money(s.freeDeliveryOver)}` : "";
  return `${min} · ${money(s.deliveryFee)} delivery${over}`;
}

const UNIT_WORDS: Record<string, string> = { each: "each", l: "per litre", kg: "per kg", g: "per g", ml: "per ml" };

/** Per-unit price in the unit people compare on: pence under £1 ("3.8p each"), pounds above. */
export function perUnit(price: number, caseSize: number, unit: string): string {
  const each = price / caseSize;
  const word = UNIT_WORDS[unit] ?? `per ${unit}`;
  if (each < 1) return `${qty(Number((each * 100).toFixed(1)))}p ${word}`;
  return `${money(each)} ${word}`;
}

/** The label, plus the total in brackets unless the label already states it: "Case 6 × 2 l (12 l)". */
function howSold(o: Offer, unit: string): string {
  const total = `${qty(o.caseSize)} ${unit}`.trim();
  if (!o.label) return o.caseSize === 1 ? `Single (${total})` : total;
  const totalNumber = qty(o.caseSize);
  return o.label.includes(totalNumber) && (o.caseSize === 1 || o.label.includes(total) || !/\d+\s*[×x]/.test(o.label))
    ? o.label
    : `${o.label} (${total})`;
}

function SupplierCard({
  supplier: s,
  products,
  offers,
  today,
  actions,
}: {
  supplier: Supplier;
  products: Product[];
  offers: Offer[];
  today: string;
  actions: Actions;
}) {
  const [editing, setEditing] = useState(false);
  const productById = new Map(products.map((p) => [p.id, p]));
  const rows = [...offers].sort((a, b) =>
    (productById.get(a.productId)?.name ?? "").localeCompare(productById.get(b.productId)?.name ?? ""),
  );
  if (editing) {
    return <SupplierEditor supplier={s} products={products} rows={rows} actions={actions} onDone={() => setEditing(false)} />;
  }
  return (
    <section className="lift rounded-xl border border-line bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">{s.name}</h2>
          <p className="mt-0.5 text-sm text-muted tabular-nums">{rulesLine(s)}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${s.name}`}
          title={`Edit ${s.name}`}
          className="press rounded-md p-2 text-muted hover:bg-background hover:text-foreground"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
            <path d="M13.5 3.5l3 3L7 16H4v-3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No prices yet. Press the pencil to add a way to buy.</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Fixed column widths so every supplier card's columns line up down the page. */}
          <table className="w-full min-w-[34rem] table-fixed text-sm">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[34%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-5 pb-1 pt-3 font-medium">Product</th>
                <th className="px-3 pb-1 pt-3 font-medium">How it&apos;s sold</th>
                <th className="px-3 pb-1 pt-3 text-right font-medium">Price</th>
                <th className="px-5 pb-1 pt-3 text-right font-medium">Works out at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => {
                const unit = productById.get(o.productId)?.unit ?? "";
                const promoLive = o.promoPrice !== null && o.promoUntil !== null && o.promoUntil >= today;
                const paid = promoLive ? o.promoPrice! : o.casePrice;
                return (
                  <tr key={o.id} className="align-top">
                    <td className="px-5 py-2.5 font-medium">{productById.get(o.productId)?.name ?? "Unknown product"}</td>
                    <td className="px-3 py-2.5">
                      {howSold(o, unit)}
                      {promoLive || o.maxBuys !== null || o.lastChange ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {o.lastChange && o.lastChange.from > 0 && o.casePrice !== o.lastChange.from ? (
                            // Price alert: the latest list-price change, with its direction and date.
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${o.casePrice > o.lastChange.from ? "bg-danger/10 text-danger" : "bg-promo-soft text-promo"}`}
                              title={`Was ${money(o.lastChange.from)}`}
                            >
                              {o.casePrice > o.lastChange.from ? "↑" : "↓"} {Math.abs(Math.round(((o.casePrice - o.lastChange.from) / o.lastChange.from) * 100))}% since {shortDate(o.lastChange.at.slice(0, 10))}
                            </span>
                          ) : null}
                          {promoLive ? (
                            <span className="rounded-full bg-promo-soft px-2 py-0.5 text-xs font-medium text-promo tabular-nums">
                              {money(o.promoPrice!)} until {shortDate(o.promoUntil!)}
                            </span>
                          ) : null}
                          {o.maxBuys !== null ? (
                            <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted tabular-nums">max {qty(o.maxBuys)} per order</span>
                          ) : null}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {promoLive ? <s className="mr-2 text-muted">{money(o.casePrice)}</s> : null}
                      <span className={promoLive ? "font-medium text-promo" : ""}>{money(paid)}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right text-muted tabular-nums">{perUnit(paid, o.caseSize, unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const EDIT_INPUT = `${INPUT} py-1.5`;

/** Edit mode: the whole card is one form, saved by one action (saveSupplierCard). */
function SupplierEditor({
  supplier: s,
  products,
  rows,
  actions,
  onDone,
}: {
  supplier: Supplier;
  products: Product[];
  rows: Offer[];
  actions: Actions;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(actions.saveSupplierCard, undefined);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<number[]>([]);
  const productById = new Map(products.map((p) => [p.id, p]));
  // A successful save returns { ok }: leave edit mode and show the fresh read view.
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <section className="rounded-xl border-2 border-accent/50 bg-surface">
      <form
        onSubmit={(e) => {
          // Keep what was typed on screen if the save fails, rather than React's post-action reset.
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        <input type="hidden" name="id" value={s.id} />
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="grid flex-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr]">
            <Labelled label="Supplier">
              <input name="name" required maxLength={120} defaultValue={s.name} className={`${EDIT_INPUT} font-semibold`} />
            </Labelled>
            <Labelled label="Minimum order £">
              <input name="minOrder" inputMode="decimal" defaultValue={String(s.minOrder)} className={`${EDIT_INPUT} tabular-nums`} />
            </Labelled>
            <Labelled label="Delivery fee £">
              <input name="deliveryFee" inputMode="decimal" defaultValue={String(s.deliveryFee)} className={`${EDIT_INPUT} tabular-nums`} />
            </Labelled>
            <Labelled label="Free delivery over £">
              <input
                name="freeDeliveryOver"
                inputMode="decimal"
                placeholder="never"
                defaultValue={s.freeDeliveryOver === null ? "" : String(s.freeDeliveryOver)}
                className={`${EDIT_INPUT} tabular-nums`}
              />
            </Labelled>
          </div>
          <div className="flex gap-2 pt-5">
            <button type="button" onClick={onDone} className="press rounded-md px-3 py-2 text-sm text-muted hover:bg-background hover:text-foreground">
              Discard
            </button>
            <button type="submit" disabled={pending} className="press rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60">
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>
        {state?.error ? (
          <p role="alert" className="border-b border-line bg-danger-soft px-5 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}

        <div className="divide-y divide-line">
          {rows.map((o) => {
            const unit = productById.get(o.productId)?.unit ?? "";
            const gone = removed.has(o.id);
            const p = `o.${o.id}.`;
            return (
              <div key={o.id} className={`px-5 py-3 ${gone ? "bg-danger-soft/50" : ""}`}>
                <input type="hidden" name={`${p}productId`} value={o.productId} />
                {gone ? <input type="hidden" name={`${p}remove`} value="1" /> : null}
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-sm font-medium ${gone ? "text-muted line-through" : ""}`}>
                    {productById.get(o.productId)?.name ?? "Unknown product"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRemoved((r) => {
                        const next = new Set(r);
                        if (next.has(o.id)) next.delete(o.id);
                        else next.add(o.id);
                        return next;
                      })
                    }
                    aria-label={gone ? "Keep this way to buy" : "Remove this way to buy"}
                    className="press rounded px-2 py-0.5 text-sm text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    {gone ? "Undo" : "✕"}
                  </button>
                </div>
                {gone ? null : <OfferFields prefix={p} unit={unit} offer={o} />}
              </div>
            );
          })}
          {added.map((k) => (
            <NewOfferRow key={k} k={k} products={products} onRemove={() => setAdded((a) => a.filter((x) => x !== k))} />
          ))}
          <div className="flex items-center justify-between px-5 py-3">
            {products.length > 0 ? (
              <button type="button" onClick={() => setAdded((a) => [...a, Date.now()])} className="link-slide text-sm font-medium text-accent">
                + Add a way to buy
              </button>
            ) : (
              <span className="text-sm text-muted">Add products under What you need first.</span>
            )}
          </div>
        </div>
      </form>
      <div className="border-t border-line px-5 py-3">
        <ActionForm action={actions.removeSupplier}>
          {() => (
            <>
              <input type="hidden" name="id" value={s.id} />
              <SubmitButton
                variant="danger"
                pendingLabel="Deleting…"
                className="px-0 py-0 hover:bg-transparent"
                onClick={(e) => {
                  if (!confirm(`Delete ${s.name} and all its prices?`)) e.preventDefault();
                }}
              >
                Delete this supplier
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </div>
    </section>
  );
}

function NewOfferRow({ k, products, onRemove }: { k: number; products: Product[]; onRemove: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const unit = products.find((p) => p.id === productId)?.unit ?? "";
  const p = `n.${k}.`;
  return (
    <div className="bg-accent-soft/40 px-5 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <select name={`${p}productId`} value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Product" className={`${EDIT_INPUT} max-w-xs`}>
          {products.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRemove} aria-label="Remove this new way to buy" className="press rounded px-2 py-0.5 text-sm text-muted hover:text-danger">
          ✕
        </button>
      </div>
      <OfferFields prefix={p} unit={unit} />
    </div>
  );
}

function OfferFields({ prefix: p, unit, offer: o }: { prefix: string; unit: string; offer?: Offer }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr_1fr]">
      <Labelled label="Description">
        <input name={`${p}label`} maxLength={120} defaultValue={o?.label ?? ""} placeholder={`e.g. Case 6 × 1 ${unit}`} className={EDIT_INPUT} />
      </Labelled>
      <Labelled label={`How many ${unit || "units"} in one`} hint="1 for a single, 6 for a case of 6">
        <input name={`${p}caseSize`} inputMode="decimal" required defaultValue={o ? String(o.caseSize) : ""} className={`${EDIT_INPUT} tabular-nums`} />
      </Labelled>
      <Labelled label="Price £">
        <input name={`${p}casePrice`} inputMode="decimal" required defaultValue={o ? String(o.casePrice) : ""} className={`${EDIT_INPUT} tabular-nums`} />
      </Labelled>
      <Labelled label="Promo price £">
        <input name={`${p}promoPrice`} inputMode="decimal" defaultValue={o?.promoPrice != null ? String(o.promoPrice) : ""} className={`${EDIT_INPUT} tabular-nums`} />
      </Labelled>
      <Labelled label="Promo ends">
        <PromoEndsInput name={`${p}promoUntil`} value={o?.promoUntil ?? ""} />
      </Labelled>
      <Labelled label="Max per order">
        <input name={`${p}maxBuys`} inputMode="numeric" defaultValue={o?.maxBuys != null ? String(o.maxBuys) : ""} className={`${EDIT_INPUT} tabular-nums`} />
      </Labelled>
    </div>
  );
}

/**
 * Safari draws an empty <input type="date"> as today's date, which made every
 * promo-less row look like a promo ending today. Until there is a date, this is a
 * text field with a placeholder; it becomes a date picker when focused.
 */
function PromoEndsInput({ name, value }: { name: string; value: string }) {
  const [asDate, setAsDate] = useState(value !== "");
  return (
    <input
      name={name}
      type={asDate ? "date" : "text"}
      placeholder="no promo"
      defaultValue={value}
      onFocus={() => setAsDate(true)}
      onBlur={(e) => {
        if (e.currentTarget.value === "") setAsDate(false);
      }}
      className={`${EDIT_INPUT} tabular-nums`}
    />
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-muted">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint ? <span className="mt-0.5 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}
