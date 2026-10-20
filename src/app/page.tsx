import Link from "next/link";
import type { ReactNode } from "react";
import { DemoLink } from "@/components/DemoLink";
import { Logo } from "@/components/Logo";
import { FlowBackground } from "./FlowBackground";
import {
  AiTerminal,
  CasesIllustration,
  DeliveryIllustration,
  HowItWorksBento,
  MinimumIllustration,
} from "./LandingIllustrations";
import { PRO_PRICE_GBP } from "./pricing";
import { money } from "./format";
import { Reveal } from "./Reveal";

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
    body: "Their milk is £1.20 cheaper, but they want £100 before they'll deliver. If milk is all you need, you can't have it.",
    art: <MinimumIllustration />,
  },
  {
    title: "Delivery fees",
    body: "Save £8 on the items, pay £12 to have them delivered. Unless the order clears their free-delivery line.",
    art: <DeliveryIllustration />,
  },
  {
    title: "Case sizes and offers",
    body: "Need 7, sold in 6s? One case and a single beats two cases. And an offer stops counting the day it ends.",
    art: <CasesIllustration />,
  },
];

// The agent story in three steps, in the order an owner lives them.
const AI_STEPS = [
  ["Forward your price lists", "PDFs, emails or photos. Your agent types in every supplier and price."],
  ["Ask in plain English", "\"Where should we buy next month?\" is enough."],
  ["Approve the orders", "It writes one email per supplier. You say send."],
];
const SETUP_MAILTO = "mailto:hello@splitcart.example?subject=Set%20up%20my%20agent";

const FREE_FEATURES = ["Your first optimisation", "Unlimited suppliers and products", "CSV download and copy-ready orders"];
const PRO_FEATURES = ["Unlimited optimisations", "Every past run, kept", "Selling-price advice", "Run it from your AI agent"];

/** One landing screen: exactly the viewport tall, so mandatory snapping always rests on a section start. */
function Screen({ children, className = "", inner = "", backdrop }: { children: ReactNode; className?: string; inner?: string; backdrop?: ReactNode }) {
  return (
    <section className={`relative flex h-dvh snap-start items-center overflow-hidden ${className}`}>
      {/* A backdrop fills the whole section; inside the padded content box it would end in a hard edge. */}
      {backdrop}
      <div className={`relative mx-auto w-full max-w-6xl px-5 pt-16 pb-4 sm:px-8 ${inner}`}>{children}</div>
    </section>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden>
      <circle cx="8" cy="8" r="8" fill="var(--color-accent-soft)" />
      <path d="M4.5 8.2 l2.2 2.2 l4.6 -4.8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { demo } = await searchParams;
  return (
    // Mandatory snap with no snap-stop: a fast flick may pass several sections, but the
    // page always comes to rest on a section start. Every section is exactly h-dvh, because
    // a section taller than the viewport would give mandatory snapping a place to strand you.
    <div className="h-dvh snap-y snap-mandatory overflow-y-auto">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-line/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link href="/new" className="press rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-strong hover:shadow-md">
            Create your business
          </Link>
        </div>
      </header>

      {/* 1. Hero: a faint moving supply map behind still copy. */}
      <Screen backdrop={<FlowBackground />}>
        <div className="relative grid items-center gap-6 md:grid-cols-[1.1fr_1fr] md:gap-12">
          <Reveal>
            <p className="text-sm font-medium text-accent">For cafés, kitchens and corner shops</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Stop overpaying your suppliers.</h1>
            <p className="mt-4 max-w-lg text-base text-muted sm:text-lg">
              Add your suppliers and what you need. Splitcart works out the cheapest way to split the order, down to the last case.{" "}
              <span className="text-foreground">Or let your AI agent do it all.</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/new" className="press rounded-md bg-accent px-6 py-3 font-medium text-white shadow-sm hover:bg-accent-strong hover:shadow-md">
                Create your business
              </Link>
              <DemoLink />
            </div>
            {demo === "failed" ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                The demo couldn&apos;t start just now. Try again in a moment.
              </p>
            ) : null}
          </Reveal>

          <Reveal>
            <figure className="lift rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-6">
              <figcaption className="flex items-baseline justify-between text-sm">
                <span className="font-medium">Example order</span>
                <span className="text-muted">one supplier vs split</span>
              </figcaption>
              <ul className="mt-3 divide-y divide-line border-y border-line text-sm tabular-nums">
                {EXAMPLE.map((r) => (
                  <li key={r.item} className="flex items-baseline justify-between gap-4 py-2">
                    <span>{r.item}</span>
                    <span className="whitespace-nowrap">
                      <s className="mr-3 text-muted">{money(r.single)}</s>
                      <span className="font-medium">{money(r.split)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-baseline justify-between">
                <span className="text-muted">You save</span>
                <span className="text-3xl font-semibold tabular-nums text-accent">{money(EXAMPLE_SINGLE - EXAMPLE_SPLIT)}</span>
              </p>
            </figure>
          </Reveal>
        </div>
      </Screen>

      {/* 2. Reasons: heading beside its lede, then three cards whose drawings move. */}
      <Screen className="bg-surface">
        <Reveal>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr] md:items-end">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">The cheapest price isn&apos;t the cheapest order.</h2>
            <p className="text-muted md:text-lg">Picking the lowest price on every line usually costs more. Three reasons why:</p>
          </div>
          <div className="mt-6 grid gap-3 md:mt-12 md:grid-cols-3 md:gap-5">
            {REASONS.map((r, i) => (
              <article key={r.title} className="lift flex flex-col rounded-xl border border-line bg-background p-4 md:p-6">
                {/* Staggered by 0.8s per card on the shared 6s tempo (see .loop in globals.css). */}
                <div className="rounded-lg bg-surface px-3 py-2 md:py-4" style={{ ["--phase" as string]: `${-i * 0.8}s` }}>
                  {r.art}
                </div>
                <h3 className="mt-3 font-semibold md:mt-5 md:text-lg">{r.title}</h3>
                <p className="mt-1 text-sm text-muted md:text-base">{r.body}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </Screen>

      {/* 3. How it works: a centred title over one bento frame. */}
      <Screen>
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-2 text-center text-muted">Five minutes to set up. One click every time you order.</p>
          <div className="mt-5 md:mt-8">
            <HowItWorksBento />
          </div>
        </Reveal>
      </Screen>

      {/* 4. AI agent, the centrepiece: the pitch and its three steps on the left, the agent
          answering the one question an owner asks on the right, on a soft green ground. */}
      <Screen className="bg-accent-soft">
        <Reveal>
          <div className="grid items-center gap-5 md:grid-cols-2 md:gap-12">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Too busy to enter your suppliers? Don&apos;t.</h2>
              <p className="mt-3 text-muted md:text-lg">
                Connect your AI agent and it does everything you could do here: reads price lists, adds suppliers and prices, finds the cheapest split and writes the orders.
              </p>
              <ol className="mt-4 space-y-2 md:mt-6 md:space-y-3">
                {AI_STEPS.map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{i + 1}</span>
                    <span className="text-sm md:text-base">
                      <span className="font-medium">{title}.</span> <span className="text-muted">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 md:mt-7">
                <span className="text-sm font-medium md:text-base">No agent? We&apos;ll set one up for you.</span>
                <a
                  href={SETUP_MAILTO}
                  className="press rounded-md border border-accent bg-surface px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white"
                >
                  Set up my agent
                </a>
              </div>
              <p className="mt-3 text-xs text-muted md:text-sm">
                Already have one? Point it at{" "}
                <a href="/llms.txt" className="link-slide font-mono text-accent">
                  splitcart/llms.txt
                </a>
                . Nothing to install.
              </p>
            </div>
            <AiTerminal />
          </div>
        </Reveal>
      </Screen>

      {/* 5. Pricing: two equal cards as a centred pair, the small print in one row under them. */}
      <Screen inner="flex flex-col items-center">
        <Reveal className="w-full">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing</h2>
          <p className="mt-2 text-center text-muted">Try it on a real order for free. Upgrade when it&apos;s saving you money.</p>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:gap-5 md:mt-10">
            <PriceCard
              name="Free"
              price="£0"
              note="See what you'd save."
              items={FREE_FEATURES}
              cta={
                <Link href="/new" className="press block rounded-md border border-line bg-surface px-4 py-2.5 text-center text-sm font-medium hover:border-accent hover:text-accent">
                  Create your business
                </Link>
              }
            />
            <PriceCard
              name="Pro"
              price={`£${PRO_PRICE_GBP}`}
              per="/month"
              note="Pays for itself if it saves you £1 a day."
              items={PRO_FEATURES}
              highlight
              cta={
                <Link href="/new" className="press block rounded-md bg-accent px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-accent-strong hover:shadow-md">
                  Start free, upgrade later
                </Link>
              }
            />
          </div>
          <ul className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted">
            <li>No card needed</li>
            <li>Cancel anytime</li>
            <li>Prices ex-VAT</li>
          </ul>
          <p className="mt-6 text-center text-xs text-muted md:mt-12">Splitcart · prices in GBP</p>
        </Reveal>
      </Screen>
    </div>
  );
}

function PriceCard({
  name,
  price,
  per,
  note,
  items,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  per?: string;
  note: string;
  items: string[];
  cta: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`lift flex h-full flex-col rounded-xl bg-surface p-4 sm:p-6 ${highlight ? "border-2 border-accent shadow-md" : "border-2 border-line"}`}>
      <h3 className="font-semibold">{name}</h3>
      <p className="mt-1 text-3xl font-semibold tabular-nums sm:text-4xl">
        {price}
        {per ? <span className="text-sm font-normal text-muted sm:text-base">{per}</span> : null}
      </p>
      <p className="mt-1 min-h-[2.5rem] text-xs text-muted sm:text-sm">{note}</p>
      <ul className="mt-3 flex-1 space-y-2 text-xs sm:mt-4 sm:text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Check />
            {i}
          </li>
        ))}
      </ul>
      <div className="mt-4 sm:mt-6">{cta}</div>
    </div>
  );
}
