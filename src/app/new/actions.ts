"use server";

import { redirect } from "next/navigation";
import { grantAccess, hashCode } from "@/lib/access";
import { createCompany } from "@/lib/repo";
import type { CompanyKind } from "@/lib/types";
import type { FormState } from "@/components/ActionForm";
import { FieldError, text, values } from "../validate";

const KINDS: CompanyKind[] = ["cafe", "restaurant", "takeaway", "shop", "other"];
const MIN_CODE = 4;

export async function createBusiness(_prev: FormState, data: FormData): Promise<FormState> {
  const back = values(data);
  delete back.code;
  let id: string;
  try {
    const name = text(data, "name", "Business name");
    const kind = data.get("kind");
    if (typeof kind !== "string" || !KINDS.includes(kind as CompanyKind)) throw new FieldError("Choose a business type.");
    const code = data.get("code");
    if (typeof code !== "string" || code.length < MIN_CODE) {
      throw new FieldError(`Access code must be at least ${MIN_CODE} characters.`);
    }
    if (code.length > 200) throw new FieldError("Access code is too long.");
    const hash = hashCode(code);
    id = await createCompany(name, kind as CompanyKind, hash);
    await grantAccess(id, hash, true);
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message, values: back };
    console.error("createBusiness failed", e);
    return { error: "Could not create the business right now. Try again in a moment.", values: back };
  }
  redirect(`/c/${id}`);
}
