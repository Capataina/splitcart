"use client";

import { Fragment, startTransition, useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** What every form-backed server action returns: an error to show, and the values to put back. */
export type FormState = { error?: string; values?: Record<string, string>; ok?: number } | undefined;

type Action = (prev: FormState, data: FormData) => Promise<FormState>;

/**
 * A form wired to a server action through useActionState. The action's error
 * renders under the fields; children receive the submitted values back after a
 * failed submit, since React resets the form when an action finishes.
 */
export function ActionForm({
  action,
  className,
  keepInputs = false,
  children,
}: {
  action: Action;
  className?: string;
  /**
   * Submit without React's post-action form reset, so what was typed stays on screen
   * (for forms with repeated same-named fields, which `values` cannot restore).
   * The trade: useFormStatus does not see the submit, so buttons show no pending label.
   */
  keepInputs?: boolean;
  children: (values: Record<string, string>) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const error = state?.error ? (
    <p role="alert" className="col-span-full basis-full px-2 pb-2 text-sm text-danger">
      {state.error}
    </p>
  ) : null;
  if (keepInputs) {
    return (
      <form
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        {children({})}
        {error}
      </form>
    );
  }
  return (
    <form action={formAction} className={className}>
      {/* Remount the fields per result so defaultValue re-applies after reset. */}
      <FieldsKey stamp={JSON.stringify(state ?? null)}>{children(state?.values ?? {})}</FieldsKey>
      {error}
    </form>
  );
}

function FieldsKey({ stamp, children }: { stamp: string; children: ReactNode }) {
  return <Fragment key={stamp}>{children}</Fragment>;
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  ...rest
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-strong",
    secondary: "border border-line bg-surface text-foreground hover:border-foreground/40",
    danger: "text-muted hover:text-danger hover:bg-danger-soft",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${styles} ${className}`}
      {...rest}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
