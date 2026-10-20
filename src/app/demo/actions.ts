"use server";

import { redirect } from "next/navigation";
import { grantAccess } from "@/lib/access";
import { createDemoCompany } from "@/lib/demo";

/** Creates a fresh demo café for this visitor and opens it for this browser session. */
export async function startDemo() {
  let id: string;
  try {
    const demo = await createDemoCompany();
    id = demo.id;
    await grantAccess(demo.id, demo.accessHash, false);
  } catch (e) {
    console.error("startDemo failed", e);
    redirect("/?demo=failed");
  }
  redirect(`/c/${id}`);
}
