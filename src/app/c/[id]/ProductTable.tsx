"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type FormState } from "@/components/ActionForm";
import { CELL_INPUT, INPUT } from "@/components/fieldStyles";
import { money } from "@/app/format";
import type { PriceAdvice, Product } from "@/lib/types";

type Action = (prev: FormState, data: FormData) => Promise<FormState>;

// Rows are CSS grids rather than <table> because each row is its own form (a <form>
// cannot sit inside <tr>); edit and delete forms use display:contents so their fields
// line up with the header columns.
const COLS =
  "grid grid-cols-[minmax(10rem,1.6fr)_minmax(5rem,0.7fr)_minmax(7rem,0.9fr)_minmax(15rem,2fr)_auto_auto] items-center gap-x-2";

const UNITS = ["each", "kg", "g", "l", "ml", "pack", "bottle", "tin", "loaf", "dozen"];

export function ProductTable({
  products,
  advice,
  create,
  save,
  savePricing,
  remove,
}: {
  products: Product[];
  advice: Record<string, PriceAdvice>;
  create: Action;
  save: Action;
  savePricing: Action;
  remove: Action;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <datalist id="unit-options">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="min-w-[52rem]">
        <div className={`${COLS} border-b border-line px-2 pb-2 text-xs font-medium text-muted`}>
          <span className="px-2">Product</span>
          <span className="px-2">Unit</span>
          <span className="px-2 text-right">Needed this order</span>
          <span className="px-2">Sell at</span>
          <span />
          <span />
        </div>
        {products.length === 0 ? <p className="px-4 py-4 text-sm text-muted">Nothing yet. Add your first product below.</p> : null}
        {products.map((p) => (
          <div key={p.id} className="border-b border-line">
            <div className={`${COLS} px-2 py-1`}>
              <ActionForm action={save} className="contents">
                {(v) => (
                  <>
                    <input type="hidden" name="id" value={p.id} />
                    <input name="name" aria-label="Product name" required maxLength={120} defaultValue={v.name ?? p.name} className={`${CELL_INPUT} font-medium`} />
                    <input name="unit" aria-label="Unit" list="unit-options" required maxLength={20} defaultValue={v.unit ?? p.unit} className={CELL_INPUT} />
                    <input
                      name="neededQty"
                      aria-label={`Quantity needed, in ${p.unit}`}
                      inputMode="decimal"
                      required
                      defaultValue={v.neededQty ?? String(p.neededQty)}
                      className={`${CELL_INPUT} text-right tabular-nums`}
                    />
                    <button
                      type="button"
                      aria-expanded={openId === p.id}
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}
                      className="flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm hover:bg-background"
                    >
                      <span aria-hidden className={`text-xs text-muted ${openId === p.id ? "rotate-90" : ""}`}>
                        ▸
                      </span>
                      <AdviceText advice={advice[p.id]} />
                    </button>
                    <SubmitButton variant="secondary" className="px-2.5 py-1">
                      Save
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
              <ActionForm action={remove} className="contents">
                {() => (
                  <>
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton
                      variant="danger"
                      pendingLabel="Deleting…"
                      className="px-2.5 py-1"
                      onClick={(e) => {
                        if (!confirm(`Delete ${p.name} and all its prices?`)) e.preventDefault();
                      }}
                    >
                      Delete
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
            </div>
            {openId === p.id ? <PricingEditor product={p} save={savePricing} /> : null}
          </div>
        ))}
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

function AdviceText({ advice }: { advice: PriceAdvice | undefined }) {
  if (!advice) return <span className="text-muted">—</span>;
  if (advice.kind === "need-data") return <span className="text-muted">{advice.reason}</span>;
  return (
    <span className="font-medium text-accent tabular-nums">
      {money(advice.price)} · ~{Math.round(advice.expectedWeekly)}/wk · {money(advice.weeklyProfit)} profit/wk
    </span>
  );
}

/** Sell range and the prices the owner has tried; the advice is refitted on save. */
function PricingEditor({ product: p, save }: { product: Product; save: Action }) {
  // Row keys only; the values live in the uncontrolled inputs.
  const [rows, setRows] = useState(() => (p.priceTests.length ? p.priceTests : [{ price: NaN, weeklySold: NaN }]).map((t, i) => ({ key: i, ...t })));
  const [nextKey, setNextKey] = useState(rows.length);
  const show = (n: number) => (Number.isFinite(n) ? String(n) : "");
  return (
    <div className="bg-background px-6 py-4">
      <p className="text-sm text-muted">
        We fit a demand curve to the prices you&apos;ve tried and pick the price that makes the most profit — not the highest price.
      </p>
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
