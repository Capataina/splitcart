/** Splitcart's mark: three supplier lines converging into one basket. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <path d="M6 8 L14 16 M6 16 H14 M6 24 L14 16" stroke="#9fd0b0" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M15 13 H26 L24 21 H17 Z" fill="#ffffff" />
      <circle cx="18.5" cy="24" r="1.6" fill="#ffffff" />
      <circle cx="23" cy="24" r="1.6" fill="#ffffff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">Splitcart</span>
    </span>
  );
}
