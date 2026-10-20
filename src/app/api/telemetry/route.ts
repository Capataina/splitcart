import { track } from "@/lib/telemetry";

// Browser error reports from ErrorReporter. Unauthenticated by necessity (errors
// happen before and outside access), so the body is size-capped and only known
// fields are copied, each truncated.
const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELD = 4000;

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v.slice(0, MAX_FIELD) : undefined;
}

export async function POST(req: Request): Promise<Response> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return new Response("body too large", { status: 413 });
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return new Response("body too large", { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response("expected a JSON body", { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return new Response("expected a JSON object", { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const event = str(b.event);
  if (!event) return new Response("expected a string `event`", { status: 400 });
  const data = typeof b.data === "object" && b.data !== null && !Array.isArray(b.data) ? b.data : undefined;
  track(event.slice(0, 200), {
    source: "client",
    message: str(b.message),
    stack: str(b.stack),
    url: str(b.url),
    data,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return new Response(null, { status: 204 });
}
