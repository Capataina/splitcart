"use client";

import { useFormStatus } from "react-dom";
import { startDemo } from "@/app/demo/actions";

/** "or try the demo café": a quiet text link that creates a fresh demo workspace. */
export function DemoLink() {
  return (
    <form action={startDemo}>
      <DemoSubmit />
    </form>
  );
}

function DemoSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60">
      {pending ? "Setting up the demo café…" : "or try the demo café"}
    </button>
  );
}
