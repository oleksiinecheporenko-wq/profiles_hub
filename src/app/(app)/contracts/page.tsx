import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Контракти" };

// TODO(phase 10): contracts list with status segments, profile filter and search.
export default function ContractsPage() {
  return (
    <>
      <PageHeader
        meta="contracts"
        title="04 · Контракти"
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled>
            Додати контракт
          </Button>
        }
      />
      <EmptyState icon={FileText} message="Контрактів поки немає." />
    </>
  );
}
