import type { Metadata } from "next";
import { LayoutGrid, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Статус профілів" };

// TODO(phase 8): status metrics, Kanban and grid views.
export default function StatusProfilesPage() {
  return (
    <>
      <PageHeader
        meta="overview"
        title="02 · Статус профілів"
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled>
            Додати профіль
          </Button>
        }
      />
      <EmptyState icon={LayoutGrid} message="Профілів поки немає." />
    </>
  );
}
