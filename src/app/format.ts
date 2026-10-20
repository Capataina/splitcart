// Display formatting shared by every page. Money is GBP as a plain number (src/lib/types.ts).

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function money(n: number): string {
  return gbp.format(n);
}

/** A plain number without trailing zeros, for quantities and case sizes ("6", "2.5"). */
export function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-31" -> "31 Oct". Read from the string so no timezone can shift the day. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/** A timestamp from the database -> "20 Oct 2026, 10:46" in UK time. */
export function dateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export const KIND_LABEL: Record<string, string> = {
  cafe: "Café",
  restaurant: "Restaurant",
  takeaway: "Takeaway",
  shop: "Shop",
  other: "Food business",
};
