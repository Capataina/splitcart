// Hero background: four supplier stalls send price tags along curved routes that
// merge into one basket; the two cheapest routes are solid green with a slow light
// running along them, the others dashed and fainter. Purely decorative (aria-hidden).
//
// Calm by construction: the whole scene sits at 12% opacity, and a CSS mask
// (.flow-mask in globals.css) drops it to about a third of that behind the text
// column. Muted text (#5b675f) over a solid shape at full 12% still measures 4.66:1
// (4.49:1 at 14%, which is why it is not higher); behind the mask it is 5.2:1. Every
// moving part shares one 8s tempo; tags move at constant speed (animateMotion is
// paced) and are invisible at both ends, so the loop seam never shows a jump.
// Under reduced motion the tags and the light are hidden and the static map stays.

const BASKET = { x: 1060, y: 430 };
const SUPPLIERS = [
  { x: 120, y: 150, cheapest: false },
  { x: 150, y: 340, cheapest: true },
  { x: 130, y: 540, cheapest: true },
  { x: 160, y: 730, cheapest: false },
];
const ROUTES = SUPPLIERS.map((s) => ({
  ...s,
  d: `M${s.x + 24} ${s.y} C ${s.x + 420} ${s.y}, ${BASKET.x - 420} ${BASKET.y}, ${BASKET.x - 34} ${BASKET.y}`,
}));
const DUR = 8;
const TAGS_PER_ROUTE = 2;

/** A small price tag with its string hole, centred on the origin so animateMotion carries it. */
function Tag({ strong }: { strong: boolean }) {
  return (
    <g>
      <path d="M-11 -7 h16 l7 7 l-7 7 h-16 z" fill="currentColor" opacity={strong ? 1 : 0.6} />
      <circle cx="4" cy="0" r="2" fill="var(--background)" />
    </g>
  );
}

export function FlowBackground() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 840"
      preserveAspectRatio="xMidYMid slice"
      className="flow-mask pointer-events-none absolute inset-0 h-full w-full text-accent opacity-[0.12]"
    >
      <defs>
        <pattern id="flow-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="currentColor" />
        </pattern>
      </defs>
      {/* Grid texture: fainter again than the routes. */}
      <rect width="1200" height="840" fill="url(#flow-dots)" opacity="0.45" />

      {ROUTES.map((r, i) => (
        <g key={i}>
          <path
            d={r.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={r.cheapest ? 3 : 1.5}
            strokeDasharray={r.cheapest ? undefined : "6 8"}
            opacity={r.cheapest ? 1 : 0.55}
          />
          {r.cheapest ? (
            // The "lit" cheapest route: a short bright segment travelling the path once per tempo.
            <path d={r.d} fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" pathLength={100} className="flow-light" />
          ) : null}
          {/* Supplier stall: a box with an awning stripe. */}
          <rect x={r.x - 22} y={r.y - 18} width={44} height={36} rx={6} fill="currentColor" opacity={r.cheapest ? 1 : 0.6} />
          <rect x={r.x - 22} y={r.y - 18} width={44} height={8} rx={3} fill="var(--background)" opacity={0.5} />
          {Array.from({ length: TAGS_PER_ROUTE }, (_, k) => {
            const begin = `${-(k * DUR) / TAGS_PER_ROUTE - i * 1.3}s`;
            return (
              <g key={k} className="flow-dot" opacity={0}>
                <animateMotion dur={`${DUR}s`} begin={begin} repeatCount="indefinite" path={r.d} rotate="auto" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur={`${DUR}s`} begin={begin} repeatCount="indefinite" />
                <Tag strong={r.cheapest} />
              </g>
            );
          })}
        </g>
      ))}

      {/* The basket everything merges into. */}
      <path d={`M${BASKET.x - 34} ${BASKET.y - 14} h88 l-10 50 h-68 z`} fill="currentColor" />
      <path d={`M${BASKET.x - 18} ${BASKET.y - 14} q 28 -40 56 0`} fill="none" stroke="currentColor" strokeWidth={5} />
    </svg>
  );
}
