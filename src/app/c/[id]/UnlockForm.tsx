"use client";

import { ActionForm, SubmitButton, type FormState } from "@/components/ActionForm";
import { INPUT, LABEL } from "@/components/fieldStyles";

export function UnlockForm({ action }: { action: (prev: FormState, data: FormData) => Promise<FormState> }) {
  return (
    <ActionForm action={action} className="space-y-4">
      {() => (
        <>
          <div>
            <label htmlFor="code" className={LABEL}>
              Access code
            </label>
            <input id="code" name="code" type="password" required autoFocus autoComplete="current-password" className={`${INPUT} mt-1`} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-accent" />
            Remember this device
          </label>
          <SubmitButton pendingLabel="Checking…" className="w-full py-2.5">
            Unlock
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
