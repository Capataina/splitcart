import { verifyCode } from "@/lib/access";
import { freeRunUsed, ipHash, lockoutMinutes, recordFailure, saveRunIfAllowed } from "@/lib/guard";
import { optimise, todayInLondon } from "@/lib/optimise";
import { adoptSupplier, findCheaperElsewhere, outsideOptions } from "@/lib/network";
import { adviseSellPrice, unitCost } from "@/lib/pricing";
import { addOffer, addProduct, addSupplier, getCompanyAuth, getRun, getWorkspace, listRuns, updateProduct, deleteProduct, updateSupplier, deleteSupplier, deleteOffer } from "@/lib/repo";
import { track, trackError } from "@/lib/telemetry";
import type { OrderLine, Workspace } from "@/lib/types";

/*
 * Minimal MCP server (Streamable HTTP, stateless JSON responses) so an owner's AI
 * assistant can turn supplier emails/PDFs into suppliers, prices and quantities,
 * then run the optimiser. Auth: `Authorization: Bearer <companyId>:<accessCode>`,
 * the same link + code a person uses. Claude Code:
 *   claude mcp add --transport http splitcart https://<host>/api/mcp --header "Authorization: Bearer <id>:<code>"
 */

const PROTOCOL = "2025-06-18";
const money = { type: "number", minimum: 0 };

const TOOLS = [
  { name: "get_workspace", description: "Suppliers (with rules), products (with quantity needed) and every offer (way to buy) in this business.", inputSchema: { type: "object", properties: {} } },
  {
    name: "add_supplier",
    description: "Add a supplier and its ordering rules. All money in GBP ex-VAT.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" }, minOrder: money, deliveryFee: money, freeDeliveryOver: { ...money, description: "Omit if delivery is never free" } },
    },
  },
  {
    name: "add_product",
    description: "Add a product the business buys, with how much this order needs.",
    inputSchema: { type: "object", required: ["name", "unit"], properties: { name: { type: "string" }, unit: { type: "string", description: "kg, l, each…" }, neededQty: money } },
  },
  {
    name: "set_quantity",
    description: "Set how much of a product this order needs (0 = skip it this time).",
    inputSchema: { type: "object", required: ["product", "neededQty"], properties: { product: { type: "string", description: "Product name or id" }, neededQty: money } },
  },
  {
    name: "add_offer",
    description: "Add one way a supplier sells a product: unitsPerBuy units (in the product's unit) for price. Singles and cases are separate offers.",
    inputSchema: {
      type: "object",
      required: ["supplier", "product", "unitsPerBuy", "price"],
      properties: {
        supplier: { type: "string", description: "Supplier name or id" },
        product: { type: "string", description: "Product name or id" },
        label: { type: "string", description: 'e.g. "Case 6 x 2 l"' },
        unitsPerBuy: { type: "number", exclusiveMinimum: 0 },
        price: money,
        promoPrice: money,
        promoUntil: { type: "string", description: "ISO date the promo price ends (inclusive)" },
        maxBuys: { type: "integer", minimum: 1 },
      },
    },
  },
  {
    name: "update_product",
    description: "Rename a product, change its unit, or set how much this order needs. Omitted fields stay as they are.",
    inputSchema: { type: "object", required: ["product"], properties: { product: { type: "string", description: "Product name or id" }, name: { type: "string" }, unit: { type: "string" }, neededQty: money } },
  },
  { name: "delete_product", description: "Remove a product and every price for it.", inputSchema: { type: "object", required: ["product"], properties: { product: { type: "string" } } } },
  {
    name: "update_supplier",
    description: "Change a supplier's name, rules or order email. Omitted fields stay as they are; send freeDeliveryOver null to make delivery never free.",
    inputSchema: {
      type: "object",
      required: ["supplier"],
      properties: { supplier: { type: "string" }, name: { type: "string" }, minOrder: money, deliveryFee: money, freeDeliveryOver: { type: ["number", "null"] }, email: { type: "string" } },
    },
  },
  { name: "delete_supplier", description: "Remove a supplier and all its prices.", inputSchema: { type: "object", required: ["supplier"], properties: { supplier: { type: "string" } } } },
  { name: "delete_offer", description: "Remove one way to buy (an offer id from get_workspace).", inputSchema: { type: "object", required: ["offerId"], properties: { offerId: { type: "string" } } } },
  {
    name: "record_price_test",
    description: "Log a selling price the business has tried and how many units sold per week at it. Two or more different prices unlock price advice.",
    inputSchema: { type: "object", required: ["product", "price", "weeklySold"], properties: { product: { type: "string" }, price: money, weeklySold: money } },
  },
  {
    name: "set_sell_range",
    description: "Set the selling-price range (£ per unit) the owner is willing to charge for a product.",
    inputSchema: { type: "object", required: ["product"], properties: { product: { type: "string" }, sellMin: money, sellMax: money } },
  },
  { name: "cheaper_elsewhere", description: "From the shared price book: suppliers this business doesn't use that list its products cheaper (only supplier list prices are shared between businesses).", inputSchema: { type: "object", properties: {} } },
  { name: "price_advice", description: "Profit-maximising selling price per product, fitted from the logged price tests and the cheapest unit cost.", inputSchema: { type: "object", properties: {} } },
  { name: "list_runs", description: "Past optimisations: id, date, total and the single-supplier baseline.", inputSchema: { type: "object", properties: {} } },
  { name: "get_run", description: "The full result of one optimisation (orders per supplier, saving, network suggestion).", inputSchema: { type: "object", required: ["runId"], properties: { runId: { type: "string" } } } },
  {
    name: "export_orders",
    description: "A run's orders as CSV (one row per line) or as plain text per supplier, ready to paste.",
    inputSchema: { type: "object", required: ["runId"], properties: { runId: { type: "string" }, format: { type: "string", enum: ["csv", "text"] } } },
  },
  {
    name: "draft_order_emails",
    description: "One ready-to-send email per supplier for a run: to, subject, body. Send them with your own mail tool, or show them to the owner to approve.",
    inputSchema: { type: "object", required: ["runId"], properties: { runId: { type: "string" } } },
  },
  {
    name: "adopt_supplier",
    description: "Add a supplier from the shared price book (cheaper_elsewhere) to this business, with its list prices for your products.",
    inputSchema: { type: "object", required: ["supplierId"], properties: { supplierId: { type: "string" } } },
  },
  { name: "optimise", description: "Compute the cheapest legal split of the current order across suppliers and save it as a run.", inputSchema: { type: "object", properties: {} } },
];

type Args = Record<string, unknown>;
const str = (a: Args, k: string) => (typeof a[k] === "string" && (a[k] as string).trim() ? (a[k] as string).trim() : null);
const nonNeg = (a: Args, k: string, fallback: number | null = 0) => {
  if (a[k] === undefined || a[k] === null || a[k] === "") return fallback;
  const n = Number(a[k]);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${k} must be a number ≥ 0`);
  return n;
};
const find = <T extends { id: string; name: string }>(items: T[], ref: string | null, kind: string): T => {
  const hit = items.find((i) => i.id === ref) ?? items.find((i) => i.name.toLowerCase() === ref?.toLowerCase());
  if (!hit) throw new Error(`No ${kind} called "${ref}". Known: ${items.map((i) => i.name).join(", ") || "none"}`);
  return hit;
};

async function callTool(companyId: string, ip: string, name: string, a: Args): Promise<unknown> {
  const ws = (await getWorkspace(companyId)) as Workspace;
  switch (name) {
    case "get_workspace":
      return { company: ws.company, suppliers: ws.suppliers, products: ws.products, offers: ws.offers, runsUsed: ws.runCount };
    case "add_supplier": {
      const n = str(a, "name");
      if (!n) throw new Error("name is required");
      await addSupplier(companyId, { name: n, minOrder: nonNeg(a, "minOrder")!, deliveryFee: nonNeg(a, "deliveryFee")!, freeDeliveryOver: nonNeg(a, "freeDeliveryOver", null) });
      return `Added supplier ${n}`;
    }
    case "add_product": {
      const n = str(a, "name");
      if (!n) throw new Error("name is required");
      await addProduct(companyId, { name: n, unit: str(a, "unit") ?? "each", neededQty: nonNeg(a, "neededQty")! });
      return `Added product ${n}`;
    }
    case "set_quantity": {
      const p = find(ws.products, str(a, "product"), "product");
      await updateProduct(companyId, { ...p, neededQty: nonNeg(a, "neededQty")! });
      return `${p.name}: need ${a.neededQty} ${p.unit}`;
    }
    case "add_offer": {
      const s = find(ws.suppliers, str(a, "supplier"), "supplier");
      const p = find(ws.products, str(a, "product"), "product");
      const units = Number(a.unitsPerBuy);
      if (!(units > 0)) throw new Error("unitsPerBuy must be > 0");
      const promoUntil = str(a, "promoUntil");
      if (promoUntil && !/^\d{4}-\d{2}-\d{2}$/.test(promoUntil)) throw new Error("promoUntil must be YYYY-MM-DD");
      const maxBuys = a.maxBuys === undefined || a.maxBuys === null ? null : Math.floor(Number(a.maxBuys));
      if (maxBuys !== null && !(maxBuys >= 1)) throw new Error("maxBuys must be an integer ≥ 1");
      await addOffer(companyId, {
        supplierId: s.id, productId: p.id, label: str(a, "label") ?? "", caseSize: units, casePrice: nonNeg(a, "price")!,
        promoPrice: nonNeg(a, "promoPrice", null), promoUntil, maxBuys,
      });
      return `Added offer: ${s.name} sells ${units} ${p.unit} of ${p.name} for £${a.price}`;
    }
    case "update_product": {
      const p = find(ws.products, str(a, "product"), "product");
      await updateProduct(companyId, { ...p, name: str(a, "name") ?? p.name, unit: str(a, "unit") ?? p.unit, neededQty: nonNeg(a, "neededQty", p.neededQty)! });
      return `Updated ${p.name}`;
    }
    case "delete_product": {
      const p = find(ws.products, str(a, "product"), "product");
      await deleteProduct(companyId, p.id);
      return `Deleted ${p.name}`;
    }
    case "update_supplier": {
      const s = find(ws.suppliers, str(a, "supplier"), "supplier");
      await updateSupplier(companyId, {
        ...s,
        name: str(a, "name") ?? s.name,
        minOrder: nonNeg(a, "minOrder", s.minOrder)!,
        deliveryFee: nonNeg(a, "deliveryFee", s.deliveryFee)!,
        freeDeliveryOver: "freeDeliveryOver" in a ? nonNeg(a, "freeDeliveryOver", null) : s.freeDeliveryOver,
        email: "email" in a ? str(a, "email") : undefined,
      });
      return `Updated ${s.name}`;
    }
    case "delete_supplier": {
      const s = find(ws.suppliers, str(a, "supplier"), "supplier");
      await deleteSupplier(companyId, s.id);
      return `Deleted ${s.name}`;
    }
    case "delete_offer": {
      const o = ws.offers.find((x) => x.id === str(a, "offerId"));
      if (!o) throw new Error("No offer with that id; get_workspace lists them.");
      await deleteOffer(companyId, o.id);
      return "Deleted offer";
    }
    case "record_price_test": {
      const p = find(ws.products, str(a, "product"), "product");
      const price = nonNeg(a, "price")!;
      if (!(price > 0)) throw new Error("price must be > 0");
      await updateProduct(companyId, { ...p, priceTests: [...p.priceTests, { price, weeklySold: nonNeg(a, "weeklySold")! }] });
      return `${p.name}: logged ${a.weeklySold}/week at £${price}`;
    }
    case "set_sell_range": {
      const p = find(ws.products, str(a, "product"), "product");
      await updateProduct(companyId, { ...p, sellMin: nonNeg(a, "sellMin", null), sellMax: nonNeg(a, "sellMax", null) });
      return `${p.name}: sell range updated`;
    }
    case "cheaper_elsewhere":
      return await findCheaperElsewhere(companyId);
    case "price_advice": {
      const today = todayInLondon();
      return ws.products.map((p) => ({ product: p.name, advice: adviseSellPrice(p, unitCost(p, ws.offers, today)) }));
    }
    case "list_runs":
      return await listRuns(companyId);
    case "get_run":
    case "export_orders":
    case "draft_order_emails": {
      const run = await getRun(companyId, str(a, "runId") ?? "");
      if (!run) throw new Error("No run with that id; list_runs shows them.");
      if (name === "get_run") return run;
      const plan = run.result.plan;
      if (!plan) throw new Error(`That run has no orders (status: ${run.result.status}).`);
      const date = new Date(run.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
      const line = (l: OrderLine) => `${l.cases} x ${l.offerLabel || `${l.caseSize} ${l.unit}`} ${l.productName} @ £${l.casePrice.toFixed(2)} = £${l.lineTotal.toFixed(2)}`;
      if (name === "export_orders" && str(a, "format") !== "text") {
        const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
        const rows = [["supplier", "product", "offer", "buys", "units", "price_per_buy", "line_total"]];
        for (const o of plan.orders) for (const l of o.lines) rows.push([o.supplierName, l.productName, l.offerLabel, String(l.cases), String(l.unitsBought), l.casePrice.toFixed(2), l.lineTotal.toFixed(2)]);
        return rows.map((r) => r.map(cell).join(",")).join("\n");
      }
      if (name === "export_orders") {
        return plan.orders.map((o) => [`Order for ${o.supplierName}`, ...o.lines.map((l) => `- ${line(l)}`), `Total: £${o.total.toFixed(2)}`].join("\n")).join("\n\n");
      }
      return plan.orders.map((o) => ({
        to: o.supplierEmail ?? null,
        subject: `Order from ${ws.company.name}, ${date}`,
        body: ["Hello,", "", "Please could we order the following for delivery:", "", ...o.lines.map((l) => `- ${line(l)}`), "", `Goods total: £${o.subtotal.toFixed(2)}`, "", "Thanks,", ws.company.name].join("\n"),
      }));
    }
    case "adopt_supplier": {
      const added = await adoptSupplier(companyId, str(a, "supplierId") ?? "");
      if (!added) throw new Error("That supplier isn't in your cheaper_elsewhere list.");
      return `Added ${added} with its list prices`;
    }
    case "optimise": {
      const upgrade = "The free optimisation has been used. Upgrade to Pro (£29/month) for unlimited runs.";
      if (await freeRunUsed(companyId, ip)) throw new Error(upgrade);
      const result = await optimise(ws, todayInLondon(), await outsideOptions(companyId));
      const runId = await saveRunIfAllowed(companyId, ip, result);
      if (!runId) throw new Error(upgrade);
      return { runId, ...result };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

const rpc = (id: unknown, body: object) => Response.json({ jsonrpc: "2.0", id, ...body });

export async function POST(req: Request) {
  const [companyId, ...rest] = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").split(":");
  const auth = companyId ? await getCompanyAuth(companyId) : null;
  if (auth) {
    const wait = await lockoutMinutes(companyId);
    if (wait) return Response.json({ error: `Too many wrong codes. Try again in ${wait} minutes.` }, { status: 429 });
  }
  if (!auth || !verifyCode(rest.join(":"), auth.accessHash)) {
    if (auth) await recordFailure(companyId);
    return Response.json({ error: "Send Authorization: Bearer <companyId>:<accessCode>" }, { status: 401 });
  }
  const ip = ipHash(req.headers);

  let msg: { id?: unknown; method?: string; params?: { name?: string; arguments?: Args } };
  try {
    msg = await req.json();
  } catch {
    return rpc(null, { error: { code: -32700, message: "Parse error" } });
  }
  if (msg.id === undefined) return new Response(null, { status: 202 }); // notifications need no reply

  switch (msg.method) {
    case "initialize":
      return rpc(msg.id, { result: { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: "splitcart", version: "0.1.0" } } });
    case "ping":
      return rpc(msg.id, { result: {} });
    case "tools/list":
      return rpc(msg.id, { result: { tools: TOOLS } });
    case "tools/call": {
      const name = msg.params?.name ?? "";
      try {
        const out = await callTool(companyId, ip, name, msg.params?.arguments ?? {});
        track("mcp_tool", { tool: name, ok: true });
        return rpc(msg.id, { result: { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] } });
      } catch (err) {
        trackError("mcp_tool", err, { tool: name });
        // Tool failures go back to the model as isError results so it can correct itself.
        return rpc(msg.id, { result: { isError: true, content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }] } });
      }
    }
    default:
      return rpc(msg.id, { error: { code: -32601, message: `Method not found: ${msg.method}` } });
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } }); // no server-initiated stream
}
