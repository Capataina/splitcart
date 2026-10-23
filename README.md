# Splitcart

The cheapest legal way to split a supplier order, for independent cafés, restaurants, takeaways and corner shops.

An owner buying from three or four wholesalers faces a different rulebook at each: a minimum order value, a delivery fee that disappears over some threshold, items sold only as singles or whole cases, promo prices that run until a date, "limit 4 per order". Picking the cheapest combination by hand is a combinatorial problem nobody solves at 9pm after close, so most owners send everything to one supplier and overpay. Splitcart solves it exactly.

Live: **[splitcart-pi.vercel.app](https://splitcart-pi.vercel.app)** · Demo: click **Try the demo café** (access code `demo`).

## Built in one hour

Splitcart was built and deployed in a single timed hour on 20 October 2026, from 10:42 to 11:44, as a take-home assignment: build a real product a business would pay for, then submit the repo, the live link and the full unedited agent log. Every commit in this repository falls inside that hour (the first at 10:43, the last at 11:43).

It was built with Claude Code (Opus 5.5) from spoken prompts. The method:

- **One main session wrote the product.** The data layer, the solver, the API and every page were written in one context, so the parts were designed together rather than stitched from separate agents.
- **Background agents worked on everything that did not need the main thread.** One researched how real UK wholesalers set their ordering rules (minimums, free-delivery thresholds, case sizes, promos, per-order caps), which decided the supplier model. One built the local telemetry. Others ran the landing page's visuals and wrote extra tests without touching product code.
- **The maths is exact, never guessed by AI.** The supplier split is a mixed-integer program solved by HiGHS, checked by solver tests with hand-computed optimal answers, adversarial cases and property tests (29 passing at submission).
- **Testing was real use.** Rather than scripted browser tests, every click, form submit, failed request and error in the running app was logged to a local file the session read back, so each bug was fixed from what had actually happened.
- **Shipped as it went.** Vercel and a Neon Postgres database in London from the first commits, with the live site updated through the hour.

The full session log was submitted with the assignment; it is not published here because it contains private workspace links and access codes.

## How it works

1. **Create your business.** No accounts. You pick a name, a type and an access code, and you get an unguessable link (`/c/<uuid>`). The link plus the code opens the workspace; the code is stored only as a salted scrypt hash, and a correct code sets an HMAC cookie (session-long, or a year with "remember this device").
2. **Add suppliers and their rules**: minimum order £, delivery fee £, free delivery over £.
3. **Add what you need this order**: product, unit, quantity.
4. **Add the ways to buy each product**: per supplier, as many offers as they list (single 2 l, case of 6 × 2 l…), with an optional promo price, its end date, and a per-order cap.
5. **Optimise.** A mixed-integer program solved by [HiGHS](https://highs.dev) returns one purchase order per supplier and what it saves against the best single-supplier order. Every run is kept.

6. **Price what you sell.** Log prices you've tried and how many sold per week; Splitcart fits a demand line and recommends the profit-maximising price inside your range (not the highest one), using the unit cost from your cheapest supplier option.
7. **See who sells it cheaper.** The shared price book compares your products against list prices other Splitcart businesses have entered for suppliers you don't use ("Riverside Wholesale sells whole milk at £0.70/l; you pay £0.80"). Only supplier list prices are shared, never quantities or business names. This is the part a business's own AI can't do: it only ever sees its own suppliers.
8. **Let your AI do the typing.** `/api/mcp` is an MCP server and a plain JSON API; `/llms.txt` explains it to any assistant, which can then turn supplier emails and PDFs into suppliers and prices and run the optimiser.

Pricing: the first optimisation per business is free; after that an upgrade prompt offers Pro at £29/month (payments not wired in this proof of concept).

## The model (`src/lib/optimise.ts`)

```
n_k ∈ ℤ≥0     buys of offer k            ≤ its cap (enough to cover the need, or the per-order limit)
y_s ∈ {0,1}   an order is placed with supplier s
f_s ∈ {0,1}   supplier s's free-delivery threshold is reached

min  Σ price_k·n_k + Σ fee_s·(y_s − f_s)
s.t. Σ units_k·n_k ≥ need_p              every product covered
     n_k ≤ cap_k·y_s                     no lines without an order
     subtotal_s ≥ minOrder_s·y_s         supplier minimum
     subtotal_s ≥ threshold_s·f_s        free delivery only when earned
```

Promo prices apply only while `promoUntil ≥ today`. Products no supplier sells are reported rather than failing the run; an order that can't satisfy any minimum comes back as infeasible with a reason. The baseline re-solves the same model restricted to each supplier that stocks everything.

Deliberately left for v2: basket-wide "mix and save" discounts, delivery days and cut-offs, and VAT. The solver does top up past the need when the extra clears a minimum or earns free delivery.

## Stack

Next.js 16 (App Router, server actions) · Neon Postgres via plain SQL (`db/schema.sql`, no ORM) · `highs` (WASM MILP solver) · Tailwind · Vercel.

```
src/lib/optimise.ts    the MILP and the single-supplier baseline
src/lib/repo.ts        all SQL, every query scoped by company id
src/lib/access.ts      access-code hashing and the device cookie
src/lib/telemetry.ts   track()/trackError(): JSONL locally, structured logs on Vercel
src/lib/demo.ts        the demo café seed
src/app/               landing, /new, /c/[id] dashboard, /c/[id]/runs/[runId]
tests/                 solver scenarios with hand-computed optima, plus property tests
```

## Run it

```sh
npm install
vercel env pull .env.local        # DATABASE_URL (Neon) and ACCESS_SECRET
npm run db:migrate
npm run dev                        # http://localhost:3000
npm test                           # solver tests
npm run telemetry -- --errors      # read the local event log
```
