import Link from "next/link";
import type { ReactNode } from "react";
import { DemoLink } from "@/components/DemoLink";
import { FlowBackground } from "./FlowBackground";
import { PRO_PRICE_GBP } from "./pricing";
import { money } from "./format";

// The hero's example order: the single-supplier price struck through beside what the
// split pays. Illustrative figures, labelled as an example on the card.
const EXAMPLE = [
  { item: "Whole milk, 12 l", single: 13.8, split: 11.4 },
  { item: "Espresso beans, 6 kg", single: 118, split: 99 },
  { item: "Takeaway cups, 1000", single: 64, split: 59 },
  { item: "Croissants, 120", single: 66, split: 57.6 },
];
const EXAMPLE_SINGLE = EXAMPLE.reduce((s, r) => s + r.single, 0);
const EXAMPLE_SPLIT = EXAMPLE.reduce((s, r) => s + r.split, 0);

const REASONS = [
  {
    title: "Minimum orders",
    body: "The supplier with milk £1.20 cheaper wants £100 before they deliver. If milk is all you need from them, that saving is out of reach.",
    example: ["Milk elsewhere", "£14.40", "Cheaper milk, £100 minimum", "unusable"],
  },
  {
    title: "Delivery fees",
    body: "A £12 delivery fee wipes out £8 of savings, unless the order crosses that supplier's free-delivery line.",
    example: ["Saved on items", "£8.00", "Delivery fee", "£12.00"],
  },
  {
    title: "Case sizes and offers",
    body: "Need 7, sold in 6s: one case and a single beats two cases. And a promo price stops counting the day after it ends.",
    example: ["Two cases of 6", "£42.00", "One case + one single", "£25.20"],
  },
];

const STEPS = [
  ["Add what you need", "Each product and how much of it this order."],
  ["Add your suppliers", "Their minimum order, delivery fee and every price."],
  ["Press optimise", "The cheapest legal split, against one supplier for everything."],
  ["Send the orders", "Download a CSV or copy each order into an email."],
];

function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`relative flex min-h-dvh snap-start items-center ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">{children}</div>
    </section>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { demo } = await searchParams;
  return (
    // Soft snap: sections rest aligned, but a fast swipe may pass several.
    <div className="h-dvh snap-y snap-proximity overflow-y-auto">
      <header className="fixed inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <span className="text-lg font-semibold tracking-tight">Splitcart</span>
          <Link href="/new" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
            Create your business
          </Link>
        </div>
      </header>

      <Screen className="overflow-hidden">
        <FlowBackground />
        <div className="relative grid items-center gap-12 md:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-sm font-medium text-accent">You decide what to sell. We decide where to buy it.</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Put in your suppliers and what you need — we work out the cheapest way to order it, every time.
            </h1>
            <div className="mt-10 flex flex-col items-start gap-3">
              <Link href="/new" className="rounded-md bg-accent px-6 py-3 font-medium text-white hover:bg-accent-strong">
                Create your business
              </Link>
              <DemoLink />
              {demo === "failed" ? (
                <p role="alert" className="text-sm text-danger">
                  The demo could not be set up just now. Try again in a moment.
                </p>
              ) : null}
            </div>
          </div>

          <figure className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <figcaption className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Example order</span>
              <span className="text-muted">one supplier → split</span>
            </figcaption>
            <ul className="mt-4 divide-y divide-line border-y border-line text-sm tabular-nums">
              {EXAMPLE.map((r) => (
                <li key={r.item} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span>{r.item}</span>
                  <span className="whitespace-nowrap">
                    <s className="mr-3 text-muted">{money(r.single)}</s>
                    <span className="font-medium">{money(r.split)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-baseline justify-between">
              <span className="text-muted">You save</span>
              <span className="text-3xl font-semibold tabular-nums text-accent">{money(EXAMPLE_SINGLE - EXAMPLE_SPLIT)}</span>
            </p>
          </figure>
        </div>
      </Screen>

      <Screen className="bg-surface">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Cheapest everywhere isn&apos;t cheapest.</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {REASONS.map((r) => (
            <article key={r.title} className="flex min-h-[22rem] flex-col rounded-xl border border-line bg-background p-6">
              <h3 className="text-lg font-semibold">{r.title}</h3>
              <p className="mt-3 text-muted">{r.body}</p>
              <dl className="mt-auto grid grid-cols-[1fr_auto] gap-y-1 border-t border-line pt-4 text-sm tabular-nums">
                <dt>{r.example[0]}</dt>
                <dd className="text-right">{r.example[1]}</dd>
                <dt>{r.example[2]}</dt>
                <dd className="text-right font-medium">{r.example[3]}</dd>
              </dl>
            </article>
          ))}
        </div>
      </Screen>

      <Screen>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <span className="text-6xl font-semibold tabular-nums text-accent">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Screen>

      <Screen className="bg-surface">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Hand your price lists to your AI.</h2>
          <p className="mt-6 text-lg text-muted">
            Suppliers send prices as PDFs, emails and screenshots. Point your AI assistant at splitcart&apos;s /llms.txt
            with your link and code — it enters suppliers and prices and presses optimise for you. Nothing to install.
          </p>
          <p className="mt-4 text-muted">
            Next: a shared price book — when one café enters a supplier&apos;s list, everyone on that supplier gets it, and
            you see how your prices compare.
          </p>
        </div>
      </Screen>

      <Screen>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing</h2>
        <div className="mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
          <PriceCard name="Free" price="£0" items={["Your first optimisation", "No card needed"]} />
          <PriceCard
            name="Pro"
            price={`£${PRO_PRICE_GBP}`}
            per="/month"
            items={["Unlimited optimisations", "Run history", "Selling-price advice", "AI assistant access"]}
            highlight
          />
        </div>
        <p className="mt-16 text-sm text-muted">Splitcart · prices in GBP</p>
      </Screen>
    </div>
  );
}

function PriceCard({ name, price, per, items, highlight }: { name: string; price: string; per?: string; items: string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-xl bg-surface p-6 ${highlight ? "border-2 border-accent" : "border border-line"}`}>
      <h3 className="font-semibold">{name}</h3>
      <p className="mt-2 text-4xl font-semibold tabular-nums">
        {price}
        {per ? <span className="text-base font-normal text-muted">{per}</span> : null}
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-accent">✓</span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
