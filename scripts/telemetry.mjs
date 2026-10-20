// Prints recent dev telemetry from .telemetry/events.jsonl.
// Run: npm run telemetry [-- --n 100] [-- --errors] [-- --follow]
import { existsSync, openSync, readFileSync, readSync, statSync, watchFile } from "node:fs";

const FILE = new URL("../.telemetry/events.jsonl", import.meta.url);
const ENVELOPE = new Set(["ts", "level", "event", "stack"]);

const args = process.argv.slice(2);
const nIndex = args.indexOf("--n");
const n = nIndex >= 0 ? Number(args[nIndex + 1]) : 40;
if (!Number.isInteger(n) || n <= 0) {
  console.error(`--n expects a positive integer, got ${JSON.stringify(args[nIndex + 1])}`);
  process.exit(2);
}
const errorsOnly = args.includes("--errors");
const follow = args.includes("--follow");

function short(v) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

function format(raw) {
  let e;
  try {
    e = JSON.parse(raw);
  } catch {
    return `?? unparseable line: ${short(raw)}`;
  }
  if (errorsOnly && e.level !== "error") return null;
  // Lines store UTC; print local wall-clock time so it matches the dev server's terminal.
  const d = new Date(e.ts);
  const time = Number.isNaN(d.getTime())
    ? "--"
    : `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  const fields = Object.entries(e)
    .filter(([k, v]) => !ENVELOPE.has(k) && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${short(v)}`)
    .join(" ");
  let out = `${time} ${e.level === "error" ? "ERR " : "info"} ${e.event} ${fields}`;
  if (e.level === "error" && typeof e.stack === "string") {
    out += "\n    " + e.stack.split("\n").slice(1, 4).map((l) => l.trim()).join("\n    ");
  }
  return out;
}

function print(lines) {
  for (const l of lines) {
    const f = format(l);
    if (f) console.log(f);
  }
}

if (!existsSync(FILE)) {
  console.log("no telemetry yet (.telemetry/events.jsonl is created by the dev server on first event)");
  if (!follow) process.exit(0);
}

let offset = 0;
if (existsSync(FILE)) {
  const text = readFileSync(FILE, "utf8");
  offset = Buffer.byteLength(text);
  let lines = text.split("\n").filter(Boolean);
  if (errorsOnly) lines = lines.filter((l) => format(l) !== null);
  print(lines.slice(-n));
}

if (follow) {
  let partial = "";
  watchFile(FILE, { interval: 300 }, () => {
    if (!existsSync(FILE)) return;
    const size = statSync(FILE).size;
    if (size < offset) offset = 0; // file was truncated or replaced
    if (size === offset) return;
    const buf = Buffer.alloc(size - offset);
    const fd = openSync(FILE, "r");
    readSync(fd, buf, 0, buf.length, offset);
    offset = size;
    const chunk = partial + buf.toString("utf8");
    const parts = chunk.split("\n");
    partial = parts.pop() ?? "";
    print(parts.filter(Boolean));
  });
}
