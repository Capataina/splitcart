"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PRO_PRICE_LABEL } from "@/app/pricing";
import type { OptimiseState } from "./actions";

export function OptimisePanel({
  action,
  summary,
  freePlanNote,
  firstRun,
}: {
  action: (prev: OptimiseState) => Promise<OptimiseState>;
  summary: string;
  freePlanNote: string | null;
  /** No run yet: the button shimmers to say "start here". */
  firstRun: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // The modal opens on each new { upgrade } result and closes locally.
  const [dismissed, setDismissed] = useState<OptimiseState>(undefined);
  const showUpgrade = state?.upgrade === true && dismissed !== state;

  return (
    <div className="lift flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold">Find the cheapest split</h2>
        <p className="mt-1 text-sm text-muted tabular-nums">{summary}</p>
        {freePlanNote ? <p className="mt-1 text-sm text-muted">{freePlanNote}</p> : null}
        {state?.error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className={`press w-full rounded-lg bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-accent-strong hover:shadow-md disabled:opacity-60 sm:w-auto ${firstRun && !pending ? "shimmer" : ""}`}
        >
          {pending ? "Optimising…" : "Optimise order"}
        </button>
      </form>
      {showUpgrade ? <UpgradeModal onClose={() => setDismissed(state)} /> : null}
    </div>
  );
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="upgrade-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id="upgrade-title" className="text-lg font-semibold">
        You&apos;ve used your free optimisation
      </h2>
      <p className="mt-2 text-muted">Pro is {PRO_PRICE_LABEL} for unlimited runs.</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-foreground/40"
        >
          Close
        </button>
        <button type="button" disabled className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white opacity-50">
          Upgrade to Pro · coming soon
        </button>
      </div>
    </dialog>
  );
}
