// Server-only telemetry: one JSON line per event. Every line goes to stdout/stderr
// (Vercel's runtime logs capture it in production); in development it is also
// appended to .telemetry/events.jsonl, which `npm run telemetry` reads.
// Imports node:fs, so never import this from client code or the edge runtime.
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type Level = "info" | "error";
type Data = Record<string, unknown>;

const DEV = process.env.NODE_ENV !== "production";
const DIR = path.join(process.cwd(), ".telemetry");
const FILE = path.join(DIR, "events.jsonl");

function serialise(line: Data): string {
  try {
    return JSON.stringify(line, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  } catch {
    // Circular or otherwise unserialisable data: keep the envelope so the event is not lost.
    return JSON.stringify({ ts: line.ts, level: line.level, event: line.event, unserialisable: true });
  }
}

function write(level: Level, event: string, data?: Data): void {
  // The envelope keys are written last so caller data cannot overwrite them,
  // while keeping them first in the JSON for readability.
  const line: Data = { ts: new Date().toISOString(), level, event, ...data };
  line.level = level;
  line.event = event;
  const json = serialise(line);
  if (level === "error") console.error(json);
  else console.log(json);
  if (!DEV) return;
  try {
    mkdirSync(DIR, { recursive: true });
    appendFileSync(FILE, json + "\n");
  } catch {
    // Deliberately swallowed: telemetry must never break a request, and the
    // line has already reached the console above.
  }
}

export function track(event: string, data?: Data): void {
  write("info", event, data);
}

export function errorFields(err: unknown): Data {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: unknown }).digest;
    return {
      error: err.name,
      message: err.message,
      stack: err.stack,
      ...(digest !== undefined ? { digest: String(digest) } : {}),
    };
  }
  return { error: typeof err, message: String(err) };
}

export function trackError(where: string, err: unknown, data?: Data): void {
  write("error", "error", { where, ...data, ...errorFields(err) });
}

export async function timed<T>(event: string, data: Data | undefined, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    track(event, { ...data, ok: true, duration_ms: Math.round(performance.now() - start) });
    return result;
  } catch (err) {
    write("error", event, {
      ...data,
      ok: false,
      duration_ms: Math.round(performance.now() - start),
      ...errorFields(err),
    });
    throw err;
  }
}
