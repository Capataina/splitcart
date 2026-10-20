// Hero background: three supplier nodes send small dots along curves into one
// basket; the cheapest route (the middle one here) is drawn a shade stronger.
// Purely decorative, so aria-hidden, very low contrast, and one 9s tempo for every
// dot so the loops read as one scene. Static paths remain under reduced motion.

const BASKET = { x: 1040, y: 420 };
const ROUTES = [
  { from: { x: 160, y: 170 }, cheapest: false },
  { from: { x: 160, y: 420 }, cheapest: true },
  { from: { x: 160, y: 670 }, cheapest: false },
].map((r) => ({
  ...r,
  d: `M${r.from.x} ${r.from.y} C ${r.from.x + 380} ${r.from.y}, ${BASKET.x - 380} ${BASKET.y}, ${BASKET.x} ${BASKET.y}`,
}));
const DUR = 9;
const DOTS_PER_ROUTE = 3;

export function FlowBackground() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 840"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full text-accent opacity-[0.12]"
    >
      {ROUTES.map((r, i) => (
        <g key={i}>
          <path d={r.d} fill="none" stroke="currentColor" strokeWidth={r.cheapest ? 3 : 1.5} strokeDasharray={r.cheapest ? undefined : "6 8"} />
          <circle cx={r.from.x} cy={r.from.y} r={14} fill="currentColor" />
          {Array.from({ length: DOTS_PER_ROUTE }, (_, k) => (
            <circle key={k} r={r.cheapest ? 6 : 4} fill="currentColor" className="flow-dot" opacity={0}>
              <animateMotion dur={`${DUR}s`} begin={`${-(k * DUR) / DOTS_PER_ROUTE - i}s`} repeatCount="indefinite" path={r.d} />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.9;1"
                dur={`${DUR}s`}
                begin={`${-(k * DUR) / DOTS_PER_ROUTE - i}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
      ))}
      <rect x={BASKET.x} y={BASKET.y - 30} width={60} height={60} rx={10} fill="currentColor" />
    </svg>
  );
}
