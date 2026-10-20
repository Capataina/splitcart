import { createHmac } from "node:crypto";
import { sql } from "./db";
import type { OptimisationResult } from "./types";

// Abuse limits for a product with no accounts: wrong-code throttling, and one free
// optimisation per network (not per business, since a new business costs nothing).

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;
const FREE_RUN_DAYS = 30;

/** Salted hash of the caller's IP: enough to recognise a repeat, useless if leaked. */
export function ipHash(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.ACCESS_SECRET ?? "dev-only-secret").update(ip).digest("hex").slice(0, 32);
}

/** Minutes until another code attempt is allowed for this business, or 0. */
export async function lockoutMinutes(companyId: string): Promise<number> {
  const [r] = (await sql()`select count(*)::int as n, min(at) as first from auth_failures
    where key = ${companyId} and at > now() - make_interval(mins => ${WINDOW_MINUTES})`) as { n: number; first: string | null }[];
  if (r.n < MAX_FAILURES || !r.first) return 0;
  return Math.max(1, Math.ceil((Date.parse(r.first) + WINDOW_MINUTES * 60_000 - Date.now()) / 60_000));
}

export async function recordFailure(companyId: string) {
  await sql()`insert into auth_failures (key) values (${companyId})`;
}

/**
 * Saves the run only if the plan allows it, in one statement so two simultaneous
 * clicks can't both take the free run. Free plan: no earlier run for this business
 * and none from this network in the last 30 days. Demo businesses are sandboxes:
 * each still gets exactly one run, but they neither use up nor check the network's. Returns the run id, or null when
 * the owner must upgrade.
 */
export async function saveRunIfAllowed(companyId: string, ip: string, result: OptimisationResult): Promise<string | null> {
  const rows = (await sql()`insert into runs (company_id, total, baseline, result, ip_hash)
    select ${companyId}, ${result.plan?.total ?? null}, ${result.baseline?.plan.total ?? null}, ${JSON.stringify(result)}, ${ip}
    where (select plan from companies where id = ${companyId}) = 'pro'
       or not exists (select 1 from runs r join companies c on c.id = r.company_id
         where r.company_id = ${companyId}
            or (not (select is_demo from companies where id = ${companyId}) and not c.is_demo
                and r.ip_hash = ${ip} and r.created_at > now() - make_interval(days => ${FREE_RUN_DAYS})))
    returning id`) as { id: string }[];
  return rows[0]?.id ?? null;
}

/** Cheap pre-check so the UI can show the upgrade prompt before solving. */
export async function freeRunUsed(companyId: string, ip: string): Promise<boolean> {
  const [r] = (await sql()`select (select plan from companies where id = ${companyId}) <> 'pro'
    and exists (select 1 from runs r join companies c on c.id = r.company_id
      where r.company_id = ${companyId}
         or (not (select is_demo from companies where id = ${companyId}) and not c.is_demo
             and r.ip_hash = ${ip} and r.created_at > now() - make_interval(days => ${FREE_RUN_DAYS}))) as used`) as { used: boolean }[];
  return r.used;
}
