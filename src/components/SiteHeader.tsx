import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="border-b border-line bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Splitcart home" className="rounded-md">
          <Logo />
        </Link>
        {right}
      </div>
    </header>
  );
}
