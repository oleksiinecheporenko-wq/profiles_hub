import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Профілі" };

// TODO(phase 3): profiles list from the repository and the `Додати профіль` modal.
export default function ProfilesPage() {
  return (
    <>
      <PageHeader
        meta="profiles"
        title="01 · Профілі"
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled>
            Додати профіль
          </Button>
        }
      />
      <EmptyState icon={Users} message="Профілів поки немає." />
    </>
  );
}
