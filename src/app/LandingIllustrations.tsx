import type { ReactNode } from "react";

/*
 * The landing page's small product illustrations. Every loop is plain CSS/SVG with
 * one shared 6s tempo (keyframes in globals.css, the .loop and .k-* classes), so they
 * are deterministic, cost no JavaScript and all stop under prefers-reduced-motion.
 */

const ACCENT = "var(--color-accent)";
const LINE = "var(--color-line)";
const MUTED = "var(--color-muted)";

function Panel({ title, body, children, className = "" }: { title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <div className={`lift flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface p-3 sm:p-4 ${className}`}>
      <div className="flex min-h-0 flex-1 items-center justify-center">{children}</div>
      <h3 className="mt-2 text-sm font-semibold sm:text-base">{title}</h3>
      <p className="text-xs text-muted sm:text-sm">{body}</p>
    </div>
  );
}

const NEEDS = [
  ["Whole milk", "60 l", "k-row1"],
  ["Espresso beans", "8 kg", "k-row2"],
  ["Takeaway cups", "1000", "k-row3"],
] as const;

function NeedsList() {
  return (
    <div className="w-full max-w-xs rounded-lg border border-line bg-background p-2 text-xs sm:p-3 sm:text-sm">
      <div className="hidden justify-between border-b border-line pb-1.5 text-muted sm:flex">
        <span>Product</span>
        <span>Need</span>
      </div>
      {NEEDS.map(([name, qty, cls]) => (
        <div key={name} className={`loop ${cls} flex justify-between border-b border-line py-1 last:border-0 sm:py-2`}>
          <span>{name}</span>
          <span className="font-medium tabular-nums">{qty}</span>
        </div>
      ))}
    </div>
  );
}

function MinimumBar() {
  return (
    <svg viewBox="0 0 120 34" className="h-10 w-full max-w-[12rem] sm:h-full sm:max-h-14" aria-hidden>
      <rect x="2" y="16" width="92" height="9" rx="4.5" fill={LINE} />
      <rect className="loop k-fill" x="2" y="16" width="92" height="9" rx="4.5" fill={ACCENT} />
      <line x1="94" y1="10" x2="94" y2="31" stroke={MUTED} strokeDasharray="2 2" />
      <text x="94" y="8" fontSize="8" textAnchor="middle" fill={MUTED}>£79 min</text>
      <g className="loop k-tick">
        <circle cx="110" cy="20.5" r="7" fill={ACCENT} />
        <path d="M106.5 20.5 l2.5 2.5 l4.5 -5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function DeliveryChip() {
  return (
    <div className="flex flex-col items-center gap-1 text-xs">
      <span className="relative inline-grid tabular-nums text-muted">
        <span className="loop k-fee col-start-1 row-start-1 text-center">Basket £96</span>
        <span className="loop k-free col-start-1 row-start-1 text-center">Basket £134</span>
      </span>
      <span className="relative inline-grid">
        <span className="loop k-fee col-start-1 row-start-1 rounded-full border border-line bg-background px-3 py-1 font-medium">
          £12 delivery
        </span>
        <span className="loop k-free col-start-1 row-start-1 rounded-full bg-accent-soft px-3 py-1 text-center font-medium text-accent">
          Free delivery
        </span>
      </span>
    </div>
  );
}

function OptimiseRoutes() {
  const suppliers = [
    { y: 30, name: "Bestway" },
    { y: 80, name: "Jay & Jay" },
    { y: 130, name: "Booker" },
  ];
  return (
    <div className="flex h-full w-full items-center justify-center gap-3">
      <svg viewBox="0 0 220 160" className="h-full min-h-24 max-h-48 w-full max-w-sm" aria-hidden>
        {suppliers.map((s) => (
          <g key={s.name}>
            <path d={`M48 ${s.y} C 110 ${s.y}, 120 80, 170 80`} stroke={ACCENT} strokeWidth="1.5" fill="none" className="k-route" />
            <rect x="4" y={s.y - 11} width="62" height="22" rx="6" fill="var(--color-surface)" stroke={LINE} />
            <text x="35" y={s.y + 3.5} fontSize="9" textAnchor="middle" fill="var(--color-foreground)">{s.name}</text>
          </g>
        ))}
        <circle className="loop k-glow" cx="190" cy="80" r="26" fill="var(--color-accent-soft)" />
        <path d="M175 70 H206 L201 92 H180 Z" fill={ACCENT} />
        <circle cx="184" cy="97" r="3" fill={ACCENT} />
        <circle cx="198" cy="97" r="3" fill={ACCENT} />
      </svg>
      <CountDown />
    </div>
  );
}

/** £570 counting down to £498: five stacked figures, each shown for its slice of the loop. */
function CountDown() {
  const steps = ["£570", "£552", "£531", "£512", "£498"];
  return (
    <div className="shrink-0 text-right">
      <p className="text-xs text-muted">Total</p>
      <p className="relative h-8 w-20 text-2xl font-semibold tabular-nums text-accent">
        {steps.map((s, i) => (
          <span key={s} className={`loop k-count${i} absolute inset-0`}>
            {s}
          </span>
        ))}
      </p>
    </div>
  );
}

function CsvDrop() {
  return (
    <svg viewBox="0 0 80 64" className="h-full max-h-16 w-full" aria-hidden>
      <g className="loop k-drop">
        <path d="M28 4 H46 L54 12 V40 H28 Z" fill="var(--color-surface)" stroke={ACCENT} strokeWidth="1.5" />
        <text x="41" y="30" fontSize="8" textAnchor="middle" fill={ACCENT} fontWeight="600">CSV</text>
      </g>
      <path d="M18 44 V54 H62 V44" stroke={MUTED} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function CopyOrders() {
  return (
    <span className="relative inline-grid text-xs font-medium">
      <span className="loop k-copy col-start-1 row-start-1 flex items-center gap-1.5 rounded-md border border-line bg-background px-3 py-1.5">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <rect x="4" y="2" width="8" height="12" rx="1.5" fill="none" stroke="currentColor" />
          <rect x="6" y="1" width="4" height="2.5" rx="1" fill="currentColor" />
        </svg>
        Copy orders
      </span>
      <span className="loop k-copied col-start-1 row-start-1 flex items-center justify-center gap-1.5 rounded-md bg-accent-soft px-3 py-1.5 text-accent">
        Copied ✓
      </span>
    </span>
  );
}

/** How it works: one frame, six panels; the big panels each span two rows so every
 *  inner edge lines up. Desktop rows have a 9.5rem floor rather than a share of the
 *  viewport: at 720px tall the fractional rows left the small panels shorter than
 *  their illustrations, which spilled over their titles. */
export function HowItWorksBento() {
  return (
    <div className="grid h-[min(72dvh,38rem)] grid-cols-2 grid-rows-[1.5fr_1fr_1.4fr_1fr] gap-2 rounded-2xl border border-line bg-background p-2 sm:gap-3 sm:p-3 md:h-auto md:grid-cols-4 md:grid-rows-[repeat(3,minmax(9.5rem,auto))]">
      <Panel title="Add what you need" body="Each product and how much this order." className="col-span-2 md:row-span-2">
        <NeedsList />
      </Panel>
      <Panel title="Minimum orders" body="We only use a supplier once you clear their minimum.">
        <MinimumBar />
      </Panel>
      <Panel title="Delivery fees" body="Free over £129? We'll get you over it.">
        <DeliveryChip />
      </Panel>
      <Panel
        title="Press optimise"
        body="Every supplier, case size and offer checked. One cheapest split."
        className="col-span-2 md:col-start-3 md:row-span-2 md:row-start-2"
      >
        <OptimiseRoutes />
      </Panel>
      <Panel title="Download CSV" body="One order per supplier." className="md:col-start-1 md:row-start-3">
        <CsvDrop />
      </Panel>
      <Panel title="Copy the orders" body="Paste straight into an email." className="md:col-start-2 md:row-start-3">
        <CopyOrders />
      </Panel>
    </div>
  );
}

/** Reason card illustrations, one per "cheapest isn't cheapest" example. */
export function MinimumIllustration() {
  return (
    <svg viewBox="0 0 200 44" className="h-11 w-full" aria-hidden>
      <rect x="0" y="14" width="200" height="10" rx="5" fill={LINE} />
      <rect x="0" y="14" width="29" height="10" rx="5" fill={ACCENT} />
      <line x1="196" y1="6" x2="196" y2="32" stroke="var(--color-danger)" strokeDasharray="2 2" />
      <text x="0" y="40" fontSize="9" fill={MUTED}>£14.40 of milk</text>
      <text x="196" y="40" fontSize="9" textAnchor="end" fill="var(--color-danger)">£100 minimum</text>
      <rect className="loop k-strike" x="0" y="18" width="200" height="2" fill="var(--color-danger)" />
    </svg>
  );
}

export function DeliveryIllustration() {
  return (
    <svg viewBox="0 0 200 44" className="h-11 w-full" aria-hidden>
      <text x="0" y="9" fontSize="9" fill={MUTED}>Saved £8</text>
      <rect x="54" y="2" width="90" height="9" rx="4.5" fill={ACCENT} />
      <text x="0" y="30" fontSize="9" fill={MUTED}>Fee £12</text>
      <rect className="loop k-grow" x="54" y="23" width="135" height="9" rx="4.5" fill="var(--color-danger)" />
    </svg>
  );
}

export function CasesIllustration() {
  // Two cases of 6 (12 units) against a need of 7: units 8 to 12 fade, one case plus one single remains.
  return (
    <svg viewBox="0 0 200 44" className="h-11 w-full" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x={i * 16 + (i >= 6 ? 6 : 0)}
          y="10"
          width="12"
          height="18"
          rx="2"
          fill={ACCENT}
          className={i >= 7 ? "loop k-fade-out" : undefined}
        />
      ))}
      <text x="0" y="42" fontSize="9" fill={MUTED}>Need 7</text>
    </svg>
  );
}

/** The AI section's mock assistant: three lines type out in turn on the shared tempo. */
export function AiTerminal() {
  const lines = [
    { text: "Added 14 prices from Jay & Jay's PDF.", n: 37, k: "type1" },
    { text: "Optimising…", n: 11, k: "type2" },
    { text: "Saved £72.32 on this order.", n: 27, k: "type3" },
  ];
  return (
    <div className="lift overflow-hidden rounded-xl border border-line bg-[#0f1a14] text-sm text-[#d6eadc] shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-2 text-xs text-white/50">Your AI assistant</span>
      </div>
      <div className="space-y-2 p-4 font-mono text-xs sm:text-sm">
        <p className="text-white/60">
          <span className="text-[#9fd0b0]">you</span> Here&apos;s Jay &amp; Jay&apos;s new price list. Update Splitcart and optimise.
        </p>
        {lines.map((l) => (
          <p key={l.k} className="flex">
            <span className="mr-2 text-[#9fd0b0]">ai</span>
            <span
              className={`loop k-${l.k} inline-block overflow-hidden whitespace-nowrap`}
              style={{ animationTimingFunction: `steps(${l.n})`, maxWidth: `${l.n}ch` }}
            >
              {l.text}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
