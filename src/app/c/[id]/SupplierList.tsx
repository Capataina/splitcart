"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type FormState } from "@/components/ActionForm";
import { CELL_INPUT, INPUT } from "@/components/fieldStyles";
import { qty, shortDate } from "@/app/format";
import type { Offer, Product, Supplier } from "@/lib/types";

type Action = (prev: FormState, data: FormData) => Promise<FormState>;
type Actions = Record<"createSupplier" | "saveSupplier" | "removeSupplier" | "createOffer" | "saveOffer" | "removeOffer", Action>;

// Rows are CSS grids rather than <table> because each row is its own form (a <form>
// cannot sit inside <tr>); the edit and delete forms use display:contents so their
// fields line up with the header columns.
const RULE_COLS = "grid grid-cols-[minmax(11rem,2fr)_repeat(3,minmax(7.5rem,1fr))_auto_auto] items-center gap-x-2";
const OFFER_COLS =
  "grid grid-cols-[minmax(9rem,1.3fr)_minmax(9rem,1.4fr)_minmax(5.5rem,0.8fr)_minmax(6rem,0.8fr)_minmax(6rem,0.8fr)_minmax(9rem,1fr)_minmax(5.5rem,0.7fr)_auto_auto] items-center gap-x-2";

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
    <div className="mt-6 space-y-6">
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
        <div className="overflow-x-auto">
          <ActionForm action={actions.createSupplier} className={`${RULE_COLS} min-w-[46rem] gap-y-2`}>
            {(v) => (
              <>
                <input name="name" aria-label="Supplier name" placeholder="Name, e.g. Bookers" required maxLength={120} defaultValue={v.name} className={INPUT} />
                <input name="minOrder" aria-label="Minimum order £" inputMode="decimal" placeholder="Min order £" defaultValue={v.minOrder} className={`${INPUT} text-right tabular-nums`} />
                <input name="deliveryFee" aria-label="Delivery fee £" inputMode="decimal" placeholder="Delivery £" defaultValue={v.deliveryFee} className={`${INPUT} text-right tabular-nums`} />
                <input name="freeDeliveryOver" aria-label="Free delivery over £ (blank for never)" inputMode="decimal" placeholder="Free over £" defaultValue={v.freeDeliveryOver} className={`${INPUT} text-right tabular-nums`} />
                <SubmitButton pendingLabel="Adding…" className="col-span-2">
                  Add supplier
                </SubmitButton>
              </>
            )}
          </ActionForm>
        </div>
      </section>
    </div>
  );
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
  const productById = new Map(products.map((p) => [p.id, p]));
  const rows = [...offers].sort((a, b) =>
    (productById.get(a.productId)?.name ?? "").localeCompare(productById.get(b.productId)?.name ?? ""),
  );
  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <div className="min-w-[66rem]">
          <div className={`${RULE_COLS} px-3 pt-3 text-xs font-medium text-muted`}>
            <span className="px-2">Supplier</span>
            <span className="px-2 text-right">Minimum order £</span>
            <span className="px-2 text-right">Delivery fee £</span>
            <span className="px-2 text-right">Free delivery over £</span>
            <span />
            <span />
          </div>
          <div className={`${RULE_COLS} border-b border-line px-3 pb-3`}>
            <ActionForm action={actions.saveSupplier} className="contents">
              {(v) => (
                <>
                  <input type="hidden" name="id" value={s.id} />
                  <input name="name" aria-label="Supplier name" required maxLength={120} defaultValue={v.name ?? s.name} className={`${CELL_INPUT} text-base font-semibold`} />
                  <NumberCell name="minOrder" label="Minimum order £" value={v.minOrder ?? String(s.minOrder)} />
                  <NumberCell name="deliveryFee" label="Delivery fee £" value={v.deliveryFee ?? String(s.deliveryFee)} />
                  <NumberCell
                    name="freeDeliveryOver"
                    label="Free delivery over £ (blank for never)"
                    placeholder="never"
                    value={v.freeDeliveryOver ?? (s.freeDeliveryOver === null ? "" : String(s.freeDeliveryOver))}
                  />
                  <SubmitButton variant="secondary" className="px-2.5 py-1">
                    Save
                  </SubmitButton>
                </>
              )}
            </ActionForm>
            <ActionForm action={actions.removeSupplier} className="contents">
              {() => (
                <>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton
                    variant="danger"
                    pendingLabel="Deleting…"
                    className="px-2.5 py-1"
                    onClick={(e) => {
                      if (!confirm(`Delete ${s.name} and all its prices?`)) e.preventDefault();
                    }}
                  >
                    Delete
                  </SubmitButton>
                </>
              )}
            </ActionForm>
          </div>

          {rows.length > 0 ? (
            <div className={`${OFFER_COLS} px-3 pb-1 pt-3 text-xs font-medium text-muted`}>
              <span className="px-2">Product</span>
              <span className="px-2">Description</span>
              <span className="px-2 text-right">Units per buy</span>
              <span className="px-2 text-right">Price £</span>
              <span className="px-2 text-right">Promo £</span>
              <span className="px-2">Promo until</span>
              <span className="px-2 text-right">Max per order</span>
              <span />
              <span />
            </div>
          ) : null}
          {rows.map((o) => (
            <OfferRow key={o.id} offer={o} product={productById.get(o.productId)} today={today} actions={actions} />
          ))}
          <AddOffer supplier={s} products={products} create={actions.createOffer} />
        </div>
      </div>
    </section>
  );
}

function OfferRow({ offer: o, product, today, actions }: { offer: Offer; product: Product | undefined; today: string; actions: Actions }) {
  const unit = product?.unit ?? "";
  const promoLive = o.promoPrice !== null && o.promoUntil !== null && o.promoUntil >= today;
  const promoEnded = o.promoUntil !== null && o.promoUntil < today;
  return (
    <div className={`${OFFER_COLS} px-3 py-0.5`}>
      <ActionForm action={actions.saveOffer} className="contents">
        {(v) => (
          <>
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="supplierId" value={o.supplierId} />
            <input type="hidden" name="productId" value={o.productId} />
            <span className="truncate px-2 text-sm font-medium">{product?.name ?? "Unknown product"}</span>
            <input name="label" aria-label="Description" maxLength={120} placeholder={`${qty(o.caseSize)} ${unit}`} defaultValue={v.label ?? o.label} className={CELL_INPUT} />
            <NumberCell name="caseSize" label={`Units per buy, in ${unit}`} value={v.caseSize ?? String(o.caseSize)} suffix={unit} />
            <NumberCell name="casePrice" label="Price per buy £" value={v.casePrice ?? String(o.casePrice)} />
            <NumberCell
              name="promoPrice"
              label="Promo price £"
              placeholder="—"
              value={v.promoPrice ?? (o.promoPrice === null ? "" : String(o.promoPrice))}
              highlight={promoLive}
            />
            <div className="flex items-center gap-1">
              <input type="date" name="promoUntil" aria-label="Promo until (inclusive)" defaultValue={v.promoUntil ?? o.promoUntil ?? ""} className={`${CELL_INPUT} tabular-nums`} />
              {promoEnded ? (
                <span className="shrink-0 text-xs text-muted" title={`Ended ${shortDate(o.promoUntil!)}`}>
                  ended
                </span>
              ) : null}
            </div>
            <NumberCell name="maxBuys" label="Max buys per order (blank for no limit)" placeholder="no limit" value={v.maxBuys ?? (o.maxBuys === null ? "" : String(o.maxBuys))} />
            <SubmitButton variant="secondary" className="px-2.5 py-1">
              Save
            </SubmitButton>
          </>
        )}
      </ActionForm>
      <ActionForm action={actions.removeOffer} className="contents">
        {() => (
          <>
            <input type="hidden" name="id" value={o.id} />
            <SubmitButton variant="danger" pendingLabel="Removing…" className="px-2.5 py-1">
              Remove
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  );
}

function AddOffer({ supplier, products, create }: { supplier: Supplier; products: Product[]; create: Action }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const unit = products.find((p) => p.id === productId)?.unit ?? "units";
  if (products.length === 0) {
    return <p className="px-5 py-3 text-sm text-muted">Add products under What you need to give {supplier.name} prices.</p>;
  }
  if (!open) {
    return (
      <div className="px-5 py-3">
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-accent hover:underline">
          + Add way to buy
        </button>
      </div>
    );
  }
  return (
    <div className="m-3 rounded-lg border border-line bg-background p-3">
      <ActionForm action={create} className="grid gap-3 sm:grid-cols-4">
        {(v) => (
          <>
            <input type="hidden" name="supplierId" value={supplier.id} />
            <Field label="Product">
              <select name="productId" required defaultValue={v.productId ?? productId} onChange={(e) => setProductId(e.target.value)} className={INPUT}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" hint={`e.g. "Case 6 × 1 ${unit}"`}>
              <input name="label" maxLength={120} defaultValue={v.label} className={INPUT} />
            </Field>
            <Field label={`Units per buy (${unit})`} hint="1 for a single pack, 6 for a case of 6">
              <input name="caseSize" inputMode="decimal" required defaultValue={v.caseSize} className={`${INPUT} tabular-nums`} />
            </Field>
            <Field label="Price per buy £">
              <input name="casePrice" inputMode="decimal" required defaultValue={v.casePrice} className={`${INPUT} tabular-nums`} />
            </Field>
            <Field label="Promo price £" hint="Optional, needs an end date">
              <input name="promoPrice" inputMode="decimal" defaultValue={v.promoPrice} className={`${INPUT} tabular-nums`} />
            </Field>
            <Field label="Promo until" hint="Last day it applies">
              <input type="date" name="promoUntil" defaultValue={v.promoUntil} className={INPUT} />
            </Field>
            <Field label="Max per order" hint="Optional: promo limit or stock">
              <input name="maxBuys" inputMode="numeric" defaultValue={v.maxBuys} className={`${INPUT} tabular-nums`} />
            </Field>
            <div className="flex items-end gap-2">
              <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted hover:text-foreground">
                Close
              </button>
            </div>
          </>
        )}
      </ActionForm>
    </div>
  );
}

function NumberCell({
  name,
  label,
  value,
  placeholder,
  suffix,
  highlight,
}: {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center">
      <input
        name={name}
        aria-label={label}
        inputMode="decimal"
        placeholder={placeholder}
        defaultValue={value}
        className={`${CELL_INPUT} text-right tabular-nums ${highlight ? "bg-promo-soft font-medium text-promo" : ""}`}
      />
      {suffix ? <span className="shrink-0 pl-1 text-xs text-muted">{suffix}</span> : null}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
