import { hasAccess } from "@/lib/access";
import { getCompanyAuth } from "@/lib/repo";
import type { Company } from "@/lib/types";

/**
 * The company if this browser holds its access cookie, else null. Every page under
 * /c/[id] calls this itself rather than trusting the layout: Next renders a layout
 * and its page in parallel and keeps layouts across client navigation, so the
 * layout's check alone does not stop a page from loading data.
 * The access hash stays inside this function.
 */
export async function getUnlockedCompany(id: string): Promise<Company | null> {
  const auth = await getCompanyAuth(id);
  if (!auth || !(await hasAccess(id, auth.accessHash))) return null;
  return auth.company;
}
