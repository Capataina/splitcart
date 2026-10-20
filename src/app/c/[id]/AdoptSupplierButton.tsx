"use client";

import { ActionForm, SubmitButton, type FormState } from "@/components/ActionForm";

/** "Add to my suppliers" on a price-book suggestion; the server action re-checks access. */
export function AdoptSupplierButton({
  supplierId,
  action,
}: {
  supplierId: string;
  action: (prev: FormState, data: FormData) => Promise<FormState>;
}) {
  return (
    <ActionForm action={action} className="flex flex-col items-end gap-1">
      {() => (
        <>
          <input type="hidden" name="supplierId" value={supplierId} />
          <SubmitButton pendingLabel="Adding…" className="shadow-sm">
            Add to my suppliers
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
