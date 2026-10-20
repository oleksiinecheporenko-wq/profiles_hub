import type { Metadata } from "next";
import { Archive, SearchX } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ArchiveSearch } from "@/components/estimates/ArchiveSearch";
import { EstimateGrid } from "@/components/estimates/EstimateCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRequestRepository } from "@/lib/data";

export const metadata: Metadata = { title: "Архів" };

export default async function ArchivePage({ searchParams }: PageProps<"/archive">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";
  const estimates = await (await getRequestRepository()).listEstimates({ status: "archived", q: q || undefined });
  return (
    <>
      <PageHeader icon={Archive} title="Архів" count={estimates.length} />
      <div className="mb-5">
        <ArchiveSearch initial={q} />
      </div>
      {estimates.length === 0 ? (
        q ? (
          <EmptyState icon={SearchX} message="Нічого не знайдено. Спробуйте інший запит." />
        ) : (
          <EmptyState icon={Archive} message="Архів порожній. Сюди потрапляють оцінки після «Зберегти»." />
        )
      ) : (
        <EstimateGrid estimates={estimates} />
      )}
    </>
  );
}
