import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AddProfileButton } from "@/components/profiles/AddProfileDialog";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Статус профілів" };

// TODO(phase 8): status metrics, Kanban and grid views.
export default function StatusProfilesPage() {
  return (
    <>
      <PageHeader meta="overview" title="02 · Статус профілів" actions={<AddProfileButton />} />
      <EmptyState icon={LayoutGrid} message="Огляд статусів ще недоступний." />
    </>
  );
}
