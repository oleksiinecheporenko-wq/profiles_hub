import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EstimateGrid } from "@/components/estimates/EstimateCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRequestRepository } from "@/lib/data";

export const metadata: Metadata = { title: "Готові запити" };

export default async function ReadyPage() {
  const estimates = await (await getRequestRepository()).listEstimates({ status: "ready" });
  return (
    <>
      <PageHeader icon={CheckCircle2} title="Готові запити" count={estimates.length} />
      {estimates.length === 0 ? (
        <EmptyState icon={CheckCircle2} message="Готових оцінок немає. Сюди потрапляють запити після «Готово»." />
      ) : (
        <EstimateGrid estimates={estimates} />
      )}
    </>
  );
}
