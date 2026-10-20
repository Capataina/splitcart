// Form parsing for the server actions. Each reader returns the parsed value or
// throws a FieldError whose message is shown beside the form, never a 500.

export class FieldError extends Error {}

// repo.ts validates ids with the same pattern but does not export it. A non-uuid
// string reaching a uuid column makes Postgres throw, so ids are checked here first.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Money and quantity columns are numeric(10,2) (db/schema.sql); larger values overflow.
const MAX_NUMBER = 99_999_999;
const MAX_TEXT = 120;

export function text(data: FormData, key: string, label: string): string {
  const raw = data.get(key);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) throw new FieldError(`${label} is required.`);
  if (value.length > MAX_TEXT) throw new FieldError(`${label} must be at most ${MAX_TEXT} characters.`);
  return value;
}

export function id(data: FormData, key: string): string {
  const raw = data.get(key);
  if (typeof raw !== "string" || !UUID.test(raw)) throw new FieldError("That item no longer exists. Reload the page.");
  return raw;
}

function rawNumber(data: FormData, key: string): string {
  const raw = data.get(key);
  return typeof raw === "string" ? raw.trim().replace(/^£/, "").replace(/,/g, "") : "";
}

function parse(raw: string, label: string, opts: { positive?: boolean; integer?: boolean }): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new FieldError(`${label} must be a number, got "${raw.slice(0, 20)}".`);
  if (opts.positive ? n <= 0 : n < 0) throw new FieldError(`${label} must be ${opts.positive ? "more than 0" : "0 or more"}.`);
  if (n > MAX_NUMBER) throw new FieldError(`${label} is too large.`);
  if (opts.integer && !Number.isInteger(n)) throw new FieldError(`${label} must be a whole number.`);
  return Math.round(n * 100) / 100;
}

/** A required number; empty counts as missing. */
export function number(
  data: FormData,
  key: string,
  label: string,
  opts: { positive?: boolean; integer?: boolean } = {},
): number {
  const raw = rawNumber(data, key);
  if (!raw) throw new FieldError(`${label} is required.`);
  return parse(raw, label, opts);
}

/** An optional number; empty means null. */
export function optionalNumber(
  data: FormData,
  key: string,
  label: string,
  opts: { positive?: boolean; integer?: boolean } = {},
): number | null {
  const raw = rawNumber(data, key);
  return raw ? parse(raw, label, opts) : null;
}

/** An optional ISO date (yyyy-mm-dd, as <input type="date"> sends); empty means null. */
export function optionalDate(data: FormData, key: string, label: string): string | null {
  const raw = data.get(key);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new FieldError(`${label} must be a date.`);
  }
  return value;
}

/** Every field the user typed, so a failed submit can put them back. */
export function values(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of data.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

export function isUuid(s: string): boolean {
  return UUID.test(s);
}
