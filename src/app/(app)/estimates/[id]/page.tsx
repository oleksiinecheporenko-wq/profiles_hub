import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DescriptionTab } from "@/components/estimates/DescriptionTab";
import { EstimateHeader } from "@/components/estimates/EstimateHeader";
import { EstimateTab } from "@/components/estimates/EstimateTab";
import { EstimateWorkspace, type WorkspaceTab } from "@/components/estimates/EstimateWorkspace";
import { MarkSection } from "@/components/shell/SidebarProvider";
import { getRequestRepository } from "@/lib/data";
import { STATUS_SECTIONS } from "@/lib/domain/estimate";
import { uuid } from "@/lib/validation/estimate";

async function load(id: string) {
  if (!uuid.safeParse(id).success) return null;
  return (await getRequestRepository()).getEstimate(id);
}

export async function generateMetadata({ params }: PageProps<"/estimates/[id]">): Promise<Metadata> {
  const estimate = await load((await params).id);
  return { title: estimate?.clientName ?? "Запит" };
}

export default async function EstimatePage({ params, searchParams }: PageProps<"/estimates/[id]">) {
  const { id } = await params;
  const estimate = await load(id);
  if (!estimate) notFound();

  const { tab } = await searchParams;
  // Ready and archived estimates open on the report; new ones on the job post.
  const initialTab: WorkspaceTab =
    tab === "estimate" || tab === "description" ? tab : estimate.status === "in_progress" ? "description" : "estimate";

  const repo = await getRequestRepository();
  const urls = await repo.signedUrls(estimate.files.map((f) => f.path));
  const files = estimate.files.map((f) => ({ ...f, url: urls[f.path] ?? null }));

  return (
    <div>
      <MarkSection href={STATUS_SECTIONS[estimate.status].href} />
      <EstimateHeader estimate={estimate} />
      <EstimateWorkspace
        initialTab={initialTab}
        description={<DescriptionTab estimate={estimate} files={files} />}
        // Remount on status change so the controls start from the saved state.
        estimate={<EstimateTab key={estimate.status} estimate={estimate} />}
      />
    </div>
  );
}
