import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyAuth } from "@/lib/repo";
import { SiteHeader } from "@/components/SiteHeader";
import { lock, unlock } from "./actions";
import { Sidebar } from "./Sidebar";
import { UnlockForm } from "./UnlockForm";
import { getUnlockedCompany } from "./unlocked";

export const metadata: Metadata = { title: "Your business · Splitcart", robots: { index: false } };

/** Shell for every /c/[id] route: the unlock screen when locked, else sidebar + page. */
export default async function CompanyLayout({ children, params }: LayoutProps<"/c/[id]">) {
  const { id } = await params;
  const company = await getUnlockedCompany(id);
  if (!company) {
    const auth = await getCompanyAuth(id);
    if (!auth) notFound();
    return (
      <>
        <SiteHeader />
        <main className="flex-1 px-4 py-16">
          <div className="mx-auto max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{auth.company.name}</h1>
            <p className="mt-2 text-muted">Enter the access code to open this business.</p>
            <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
              <UnlockForm action={unlock.bind(null, id)} />
            </div>
          </div>
        </main>
      </>
    );
  }
  return (
    <div className="flex min-h-dvh">
      <Sidebar companyId={id} companyName={company.name} lock={lock.bind(null, id)} />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
