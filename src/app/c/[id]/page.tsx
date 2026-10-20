import Link from "next/link";
import { headers } from "next/headers";
import { DEMO_CODE } from "@/lib/demo";
import { getWorkspace, listRuns } from "@/lib/repo";
import { KIND_LABEL, dateTime, money } from "@/app/format";
import { runOptimiser } from "./actions";
import { CopyField } from "./CopyField";
import { OptimisePanel } from "./OptimisePanel";
import { getUnlockedCompany } from "./unlocked";

/** The site origin, from the request, so links are right on any host. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function OverviewPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  const company = await getUnlockedCompany(id);
  if (!company) return null; // the layout is showing the unlock form
  const [ws, runs, site] = await Promise.all([getWorkspace(id), listRuns(id), origin()]);
  if (!ws) return null;

  const toOrder = ws.products.filter((p) => p.neededQty > 0).length;
  const summary = `${plural(toOrder, "product")} to order · ${plural(ws.suppliers.length, "supplier")} · ${plural(ws.offers.length, "price")}`;
  const freePlanNote =
    company.plan === "free" ? (ws.runCount === 0 ? "Free plan: 1 optimisation included." : "Free plan: optimisation used.") : null;
  const mcpCommand = `claude mcp add --transport http splitcart ${site}/api/mcp --header "Authorization: Bearer ${id}:<your access code>"`;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {KIND_LABEL[company.kind] ?? company.kind} · {company.plan === "pro" ? "Pro" : "Free"} plan
          {company.name.endsWith("(demo)") ? (
            <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-accent">Demo workspace — access code: {DEMO_CODE}</span>
          ) : null}
        </p>
      </header>

      <OptimisePanel action={runOptimiser.bind(null, id)} summary={summary} freePlanNote={freePlanNote} />

      <Card title="Past runs">
        {runs.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 pb-2 font-medium">Run</th>
                  <th className="px-5 pb-2 text-right font-medium">Total</th>
                  <th className="px-5 pb-2 text-right font-medium">Saved vs one supplier</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {runs.map((r) => {
                  const saved = r.total !== null && r.baseline !== null ? r.baseline - r.total : null;
                  return (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-background">
                      <td className="px-5 py-2.5">
                        <Link href={`/c/${id}/runs/${r.id}`} className="font-medium text-accent hover:underline">
                          {dateTime(r.createdAt)}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-right">{r.total === null ? "No plan" : money(r.total)}</td>
                      <td className={`px-5 py-2.5 text-right ${saved !== null && saved > 0.005 ? "font-medium text-accent" : "text-muted"}`}>
                        {saved === null ? "—" : money(saved)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Your private link" note="Bookmark it. Anyone with the link and the access code can edit.">
          <div className="px-5 pb-5">
            <CopyField value={`${site}/c/${id}`} label="Private link" />
          </div>
        </Card>
        <Card
          title="Connect your AI assistant (MCP)"
          note="Your assistant can read supplier emails and PDFs, add suppliers and prices, and run the optimiser."
        >
          <div className="px-5 pb-5">
            <CopyField value={mcpCommand} label="MCP command" />
            <p className="mt-3 text-sm text-muted">
              Or point any AI at{" "}
              <a href="/llms.txt" className="font-mono text-accent hover:underline">
                {site}/llms.txt
              </a>{" "}
              — it explains the API.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="px-5 pb-3 pt-4">
        <h2 className="font-semibold">{title}</h2>
        {note ? <p className="mt-0.5 text-sm text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}
