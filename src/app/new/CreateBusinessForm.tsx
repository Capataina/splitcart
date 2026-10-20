"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { HINT, INPUT, LABEL } from "@/components/fieldStyles";
import { createBusiness } from "./actions";

export function CreateBusinessForm() {
  return (
    <ActionForm action={createBusiness} className="space-y-5">
      {(v) => (
        <>
          <div>
            <label htmlFor="name" className={LABEL}>
              Business name
            </label>
            <input id="name" name="name" required maxLength={120} autoFocus defaultValue={v.name} className={`${INPUT} mt-1`} />
          </div>
          <div>
            <label htmlFor="kind" className={LABEL}>
              Business type
            </label>
            <select id="kind" name="kind" defaultValue={v.kind ?? "cafe"} className={`${INPUT} mt-1`}>
              <option value="cafe">Café</option>
              <option value="restaurant">Restaurant</option>
              <option value="takeaway">Takeaway</option>
              <option value="shop">Shop</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="code" className={LABEL}>
              Access code
            </label>
            {/* Shown as typed: with no confirm field, seeing it is the typo check. */}
            <input id="code" name="code" required minLength={4} maxLength={200} autoComplete="off" spellCheck={false} className={`${INPUT} mt-1 font-mono`} />
            <p className={HINT}>At least 4 characters. We store only a hash of it.</p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-foreground">
              Back
            </Link>
            <SubmitButton pendingLabel="Creating…" className="px-6">
              Next
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
