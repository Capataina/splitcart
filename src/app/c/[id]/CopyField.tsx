"use client";

import { useState } from "react";

/** A read-only value with a Copy button: the private link, the MCP command. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      // Clipboard needs a secure context or permission; the field stays selectable either way.
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 2000);
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2 font-mono text-sm"
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-foreground/40 sm:w-32"
      >
        {copied === "yes" ? "Copied" : copied === "failed" ? "Select & copy" : "Copy"}
      </button>
    </div>
  );
}
