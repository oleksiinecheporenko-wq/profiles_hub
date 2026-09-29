import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Новий контракт" };

// TODO(phase 10): contract form (profile, date, title, rate, description, dialog).
export default function NewContractPage() {
  return (
    <>
      <BackLink />
      <PageHeader meta="contracts / new" title="Новий контракт" />
      <EmptyState icon={FileText} message="Форма контракту ще недоступна." />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/contracts"
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Контракти
    </Link>
  );
}
