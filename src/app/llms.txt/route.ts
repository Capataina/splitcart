// /llms.txt: the API guide an AI assistant reads before acting for a business.
// Generated per request so every example carries the host it was served from.

export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const call = (id: number, name: string, args: object) =>
    `curl -s ${origin}/api/mcp -H "Authorization: Bearer $SPLITCART_ID:$SPLITCART_CODE" -H "content-type: application/json" \\\n  -d '${JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } })}'`;

  const text = `# Splitcart

> Splitcart works out the cheapest legal way for a small food business to split an order across its suppliers (minimum orders, delivery fees, free-delivery thresholds, singles vs cases, dated promos), solved exactly as a mixed-integer program. It also advises a profit-maximising selling price from prices the owner has tried.

You can manage a business's Splitcart workspace for its owner: read supplier price lists from emails, PDFs or screenshots, enter them, then run the optimiser.

## Access
The owner gives you two things: the business id (the UUID in their link ${origin}/c/<id>) and their access code.
Every request: POST ${origin}/api/mcp with header
  Authorization: Bearer <id>:<code>
Body is JSON-RPC 2.0. It is also a standard MCP server (Streamable HTTP), so MCP clients can connect directly:
  claude mcp add --transport http splitcart ${origin}/api/mcp --header "Authorization: Bearer <id>:<code>"

## Tools (method "tools/call", params {name, arguments})
- get_workspace {}: suppliers, products, offers, runs used. Call this first.
- add_supplier {name, minOrder?, deliveryFee?, freeDeliveryOver?}: £ ex-VAT. Omit freeDeliveryOver if delivery is never free.
- add_product {name, unit, neededQty?}: unit is kg, l, each…; neededQty is how much this order needs.
- set_quantity {product, neededQty}: product by name or id; 0 skips it this time.
- add_offer {supplier, product, unitsPerBuy, price, label?, promoPrice?, promoUntil?, maxBuys?}: one way to buy. A single 2 l bottle is unitsPerBuy 2; a case of 6 x 2 l is unitsPerBuy 12. Add singles and cases as separate offers; the optimiser picks the mix. promoUntil is YYYY-MM-DD, inclusive.
- update_product {product, name?, unit?, neededQty?} / delete_product {product}
- update_supplier {supplier, name?, minOrder?, deliveryFee?, freeDeliveryOver?, email?} / delete_supplier {supplier}
- delete_offer {offerId}
- record_price_test {product, price, weeklySold}: a selling price tried and units sold per week.
- set_sell_range {product, sellMin?, sellMax?}
- price_advice {}: recommended selling price per product.
- cheaper_elsewhere {}: suppliers the business doesn't use that list its products cheaper, from the shared price book.
- optimise {}: solves and saves a run. The free plan includes one run; later calls return an upgrade message.

Errors come back as a result with isError: true and a message saying what to fix (e.g. the list of known supplier names).

## Example
${call(1, "add_supplier", { name: "Jay & Jay Wholesale", minOrder: 79, deliveryFee: 5, freeDeliveryOver: 129 })}

${call(2, "add_offer", { supplier: "Jay & Jay Wholesale", product: "Whole milk", label: "Case 6 x 2 l", unitsPerBuy: 12, price: 10.5 })}

${call(3, "optimise", {})}

## Rules of thumb when reading a price list
- Prices are per sellable unit as listed; convert to unitsPerBuy in the product's own unit.
- Enter the supplier's rules once (minimum, fee, free-over) even if the price list only mentions them in small print.
- Don't invent prices. If a line is ambiguous, ask the owner.
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
