import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Дії" };

// TODO(phase 9): activity feed grouped by transaction, filters and pagination.
export default function ActionsPage() {
  return (
    <>
      <PageHeader meta="activity" title="03 · Дії" />
      <EmptyState icon={Activity} message="Записів у журналі поки немає." />
    </>
  );
}
