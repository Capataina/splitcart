"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { ActionForm, SubmitButton, type FormState } from "@/components/ActionForm";
import { INPUT } from "@/components/fieldStyles";
import { money, qty } from "@/app/format";
import type { PriceAdvice, Product } from "@/lib/types";

type Action = (prev: FormState, data: FormData) => Promise<FormState>;

// The edit-mode rows and the add-product form share one grid so their columns line up.
const COLS =
  "grid grid-cols-[minmax(10rem,1.6fr)_minmax(5rem,0.7fr)_minmax(7rem,0.9fr)_minmax(15rem,2fr)_auto_auto] items-center gap-x-2";

const UNITS = ["each", "kg", "g", "l", "ml", "pack", "bottle", "tin", "loaf", "dozen"];

export function ProductTable({
  products,
  advice,
  create,
  saveAll,
  savePricing,
}: {
  products: Product[];
  advice: Record<string, PriceAdvice>;
  create: Action;
  saveAll: Action;
  savePricing: Action;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  return (
    <div className="overflow-x-auto">
      <datalist id="unit-options">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="min-w-[36rem]">
        {editing ? (
          <ProductsEditor products={products} saveAll={saveAll} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line px-4 pb-2">
              <span className="text-xs font-medium text-muted">Product · this order · sell at</span>
              {products.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Edit what you need"
                  title="Edit what you need"
                  className="press rounded-md p-2 text-muted hover:bg-background hover:text-foreground"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
                    <path d="M13.5 3.5l3 3L7 16H4v-3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
            </div>
            {products.length === 0 ? <p className="px-4 py-4 text-sm text-muted">Nothing yet. Add your first product below.</p> : null}
            {products.map((p) => (
              <div key={p.id} className="border-b border-line">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted tabular-nums">
                    · {qty(p.neededQty)} {p.unit} this order
                  </span>
                  <button
                    type="button"
                    aria-expanded={openId === p.id}
                    onClick={() => setOpenId(openId === p.id ? null : p.id)}
                    className="ml-auto flex items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-background"
                  >
                    <span aria-hidden className={`text-xs text-muted ${openId === p.id ? "rotate-90" : ""}`}>
                      ▸
                    </span>
                    <AdviceText advice={advice[p.id]} />
                  </button>
                </div>
                {openId === p.id ? <PricingEditor product={p} advice={advice[p.id]} save={savePricing} /> : null}
              </div>
            ))}
          </>
        )}
        <ActionForm action={create} className={`${COLS} gap-y-2 bg-background/60 px-2 py-3`}>
          {(v) => (
            <>
              <input name="name" aria-label="New product name" placeholder="New product, e.g. Whole milk" required maxLength={120} defaultValue={v.name} className={INPUT} />
              <input name="unit" aria-label="Unit" list="unit-options" placeholder="unit, e.g. l" required maxLength={20} defaultValue={v.unit} className={INPUT} />
              <input name="neededQty" aria-label="Quantity needed" inputMode="decimal" placeholder="how much" required defaultValue={v.neededQty} className={`${INPUT} text-right tabular-nums`} />
              <span />
              <SubmitButton pendingLabel="Adding…" className="col-span-2">
                Add product
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </div>
    </div>
  );
}

/** Edit mode for the whole table: one form, one Save changes, rows marked for deletion until saved. */
function ProductsEditor({ products, saveAll, onDone }: { products: Product[]; saveAll: Action; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveAll, undefined);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form
      onSubmit={(e) => {
        // Keep what was typed on screen if the save fails.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <div className="flex items-center justify-between border-b border-line px-4 pb-2">
        <span className="text-xs font-medium text-muted">Editing what you need</span>
        <span className="flex gap-2">
          <button type="button" onClick={onDone} className="press rounded-md px-3 py-1.5 text-sm text-muted hover:bg-background hover:text-foreground">
            Discard
          </button>
          <button type="submit" disabled={pending} className="press rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </span>
      </div>
      {state?.error ? (
        <p role="alert" className="border-b border-line bg-danger-soft px-4 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className={`${COLS} px-2 pt-2 text-xs font-medium text-muted`}>
        <span className="px-2">Product</span>
        <span className="px-2">Unit</span>
        <span className="px-2 text-right">Needed this order</span>
        <span />
        <span />
        <span />
      </div>
      {products.map((p) => {
        const gone = removed.has(p.id);
        const k = `p.${p.id}.`;
        return (
          <div key={p.id} className={`${COLS} border-b border-line px-2 py-1 ${gone ? "bg-danger-soft/50" : ""}`}>
            {gone ? <input type="hidden" name={`${k}remove`} value="1" /> : null}
            <input name={`${k}name`} aria-label="Product name" required maxLength={120} defaultValue={p.name} disabled={gone} className={`${INPUT} py-1.5 font-medium`} />
            <input name={`${k}unit`} aria-label="Unit" list="unit-options" required maxLength={20} defaultValue={p.unit} disabled={gone} className={`${INPUT} py-1.5`} />
            <input
              name={`${k}neededQty`}
              aria-label={`Quantity needed, in ${p.unit}`}
              inputMode="decimal"
              required
              defaultValue={String(p.neededQty)}
              disabled={gone}
              className={`${INPUT} py-1.5 text-right tabular-nums`}
            />
            <span className="text-xs text-danger">{gone ? "Will be deleted with its prices" : ""}</span>
            <span />
            <button
              type="button"
              onClick={() =>
                setRemoved((r) => {
                  const next = new Set(r);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                })
              }
              aria-label={gone ? `Keep ${p.name}` : `Delete ${p.name}`}
              className="press rounded px-2 py-1 text-sm text-muted hover:bg-danger-soft hover:text-danger"
            >
              {gone ? "Undo" : "✕"}
            </button>
          </div>
        );
      })}
    </form>
  );
}

function AdviceText({ advice }: { advice: PriceAdvice | undefined }) {
  if (!advice) return <span className="text-muted">No advice yet</span>;
  // The full reason is long and repeats on most rows; the cell says what to do, the expander says why.
  if (advice.kind === "need-data") return <span className="text-muted" title={advice.reason}>Add 2 prices you&apos;ve tried</span>;
  return (
    <span className="font-medium text-accent tabular-nums">
      {money(advice.price)} · ~{Math.round(advice.expectedWeekly)}/wk · {money(advice.weeklyProfit)} profit/wk
    </span>
  );
}

/** Sell range and the prices the owner has tried; the advice is refitted on save. */
function PricingEditor({ product: p, advice, save }: { product: Product; advice: PriceAdvice | undefined; save: Action }) {
  // Row keys only; the values live in the uncontrolled inputs.
  const [rows, setRows] = useState(() => (p.priceTests.length ? p.priceTests : [{ price: NaN, weeklySold: NaN }]).map((t, i) => ({ key: i, ...t })));
  const [nextKey, setNextKey] = useState(rows.length);
  const show = (n: number) => (Number.isFinite(n) ? String(n) : "");
  return (
    <div className="bg-background px-6 py-4">
      <p className="text-sm text-muted">
        We fit a demand curve to the prices you&apos;ve tried and pick the price that makes the most profit, not the highest price.
      </p>
      {advice?.kind === "need-data" && <p className="mt-1 text-sm text-muted">{advice.reason}</p>}
      <ActionForm action={save} keepInputs className="mt-4 flex flex-wrap items-start gap-8">
        {() => (
          <>
            <input type="hidden" name="id" value={p.id} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Sell range £ per {p.unit} (optional)</legend>
              <div className="flex items-center gap-2">
                <input name="sellMin" aria-label="Lowest sell price £" inputMode="decimal" placeholder="min" defaultValue={p.sellMin ?? ""} className={`${INPUT} w-24 tabular-nums`} />
                <span className="text-muted">to</span>
                <input name="sellMax" aria-label="Highest sell price £" inputMode="decimal" placeholder="max" defaultValue={p.sellMax ?? ""} className={`${INPUT} w-24 tabular-nums`} />
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Prices you&apos;ve tried</legend>
              <div className="grid grid-cols-[6rem_7rem_auto] items-center gap-2 text-xs text-muted">
                <span>Price £</span>
                <span>Sold per week</span>
                <span />
              </div>
              {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-[6rem_7rem_auto] items-center gap-2">
                  <input name="testPrice" aria-label="Price tried £" inputMode="decimal" defaultValue={show(r.price)} className={`${INPUT} tabular-nums`} />
                  <input name="testSold" aria-label="Sold per week at that price" inputMode="decimal" defaultValue={show(r.weeklySold)} className={`${INPUT} tabular-nums`} />
                  <button
                    type="button"
                    aria-label="Remove this price"
                    onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                    className="rounded px-2 py-1 text-sm text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setRows([...rows, { key: nextKey, price: NaN, weeklySold: NaN }]);
                  setNextKey(nextKey + 1);
                }}
                className="text-sm font-medium text-accent hover:underline"
              >
                + Add a price
              </button>
            </fieldset>
            <div className="self-end">
              <SubmitButton>Save prices</SubmitButton>
            </div>
          </>
        )}
      </ActionForm>
    </div>
  );
}
