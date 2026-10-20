"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";

const PIN_KEY = "splitcart.sidebarPinned";

// Inline 20px stroke icons; no icon library.
const Icon = ({ children }: { children: ReactNode }) => (
  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const ICONS = {
  overview: (
    <Icon>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  ),
  needs: (
    <Icon>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Icon>
  ),
  suppliers: (
    <Icon>
      <path d="M2 7h12v10H2zM14 10h4l4 4v3h-8z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Icon>
  ),
  lock: (
    <Icon>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  ),
  pin: (
    <Icon>
      <path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z" />
    </Icon>
  ),
};

export function Sidebar({ companyId, companyName, lock }: { companyId: string; companyName: string; lock: () => Promise<void> }) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Read after mount so the server render and the first client render agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinned(localStorage.getItem(PIN_KEY) === "1");
  }, []);

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem(PIN_KEY, next ? "1" : "0");
  }

  const open = pinned || hovered;
  const base = `/c/${companyId}`;
  const items = [
    { href: base, label: "Overview", icon: ICONS.overview, active: pathname === base || pathname.startsWith(`${base}/runs`) },
    { href: `${base}/needs`, label: "What you need", icon: ICONS.needs, active: pathname.startsWith(`${base}/needs`) },
    { href: `${base}/suppliers`, label: "Suppliers", icon: ICONS.suppliers, active: pathname.startsWith(`${base}/suppliers`) },
  ];
  const row = "flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm";
  const label = `whitespace-nowrap ${open ? "opacity-100" : "pointer-events-none opacity-0"}`;

  return (
    // The outer box reserves layout width: narrow when collapsed or hover-expanded
    // (the panel overlays content), wide when pinned (content moves over).
    <div className={`relative shrink-0 ${pinned ? "w-56" : "w-14"}`}>
      <nav
        aria-label="Business"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={`fixed inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r border-line bg-surface px-2 py-3 ${open ? "w-56 shadow-lg" : "w-14"} ${pinned ? "shadow-none" : ""}`}
      >
        <div className="flex h-10 items-center gap-3 px-2.5">
          <Link href="/" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" aria-label="Splitcart home">
            <LogoMark />
          </Link>
          <span className={`truncate text-sm font-semibold ${label}`}>{companyName}</span>
        </div>
        <ul className="mt-4 space-y-1">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={it.active ? "page" : undefined}
                title={open ? undefined : it.label}
                className={`${row} ${it.active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-background hover:text-foreground"}`}
              >
                {it.icon}
                <span className={label}>{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-1">
          <button type="button" onClick={togglePin} aria-pressed={pinned} title={pinned ? "Unpin sidebar" : "Pin sidebar open"} className={`${row} ${pinned ? "text-accent" : "text-muted"} hover:bg-background hover:text-foreground`}>
            {ICONS.pin}
            <span className={label}>{pinned ? "Unpin sidebar" : "Pin sidebar"}</span>
          </button>
          <form action={lock}>
            <button type="submit" title={open ? undefined : "Lock"} className={`${row} text-muted hover:bg-background hover:text-foreground`}>
              {ICONS.lock}
              <span className={label}>Lock</span>
            </button>
          </form>
        </div>
      </nav>
    </div>
  );
}
