import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EstimateGrid } from "@/components/estimates/EstimateCard";
import { NewEstimateButton } from "@/components/estimates/NewEstimateButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRequestRepository } from "@/lib/data";

export const metadata: Metadata = { title: "Запити" };

export default async function RequestsPage() {
  const estimates = await (await getRequestRepository()).listEstimates({ status: "in_progress" });
  return (
    <>
      <PageHeader icon={Inbox} title="Запити" count={estimates.length} actions={<NewEstimateButton />} />
      {estimates.length === 0 ? (
        <EmptyState icon={Inbox} message="Запитів у роботі немає. Створіть новий, щоб почати оцінку." />
      ) : (
        <EstimateGrid estimates={estimates} />
      )}
    </>
  );
}
