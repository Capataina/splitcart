import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { CreateBusinessForm } from "./CreateBusinessForm";

export const metadata: Metadata = { title: "Create your business · Splitcart" };

export default function NewBusinessPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">Create your business</h1>
          <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
            <CreateBusinessForm />
          </div>
        </div>
      </main>
    </>
  );
}
