"use client";

import { useState } from "react";
import type { Plan } from "@/lib/types";

const pounds = (n: number) => n.toFixed(2);
const num = (n: number) => String(Number(n.toFixed(2)));

/** RFC 4180 quoting, plus a leading quote on anything a spreadsheet would run as a formula. */
function cell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function planCsv(plan: Plan): string {
  const rows: (string | number)[][] = [["Supplier", "Product", "Offer", "Buys", "Units", "Price per buy (GBP)", "Line total (GBP)"]];
  for (const o of plan.orders) {
    for (const l of o.lines) {
      rows.push([o.supplierName, l.productName, l.offerLabel, l.cases, `${num(l.unitsBought)} ${l.unit}`, pounds(l.casePrice), pounds(l.lineTotal)]);
    }
    rows.push([o.supplierName, "Subtotal", "", "", "", "", pounds(o.subtotal)]);
    rows.push([o.supplierName, "Delivery", "", "", "", "", pounds(o.deliveryFee)]);
    rows.push([o.supplierName, "Total", "", "", "", "", pounds(o.total)]);
  }
  rows.push(["All suppliers", "Total", "", "", "", "", pounds(plan.total)]);
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** One purchase order per supplier, as plain text to paste into an email. */
export function planText(plan: Plan, businessName: string): string {
  return plan.orders
    .map((o) => {
      const lines = o.lines.map(
        (l) =>
          `- ${l.cases} × ${l.offerLabel || `${num(l.caseSize)} ${l.unit}`} ${l.productName} (${num(l.unitsBought)} ${l.unit}) @ £${pounds(l.casePrice)} = £${pounds(l.lineTotal)}`,
      );
      return [
        `Order for ${o.supplierName} from ${businessName}`,
        ...lines,
        `Subtotal: £${pounds(o.subtotal)}`,
        `Delivery: ${o.deliveryFee === 0 ? "free" : `£${pounds(o.deliveryFee)}`}`,
        `Total: £${pounds(o.total)}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function ExportOrders({ plan, businessName, fileName }: { plan: Plan; businessName: string; fileName: string }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  function download() {
    const url = URL.createObjectURL(new Blob([planCsv(plan)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    // Attached before clicking: Firefox has ignored clicks on a detached anchor.
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(planText(plan, businessName));
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 2000);
  }

  const button = "rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-foreground/40";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={download} className={button}>
        Download CSV
      </button>
      <button type="button" onClick={copy} className={button}>
        {copied === "yes" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy orders"}
      </button>
    </div>
  );
}
