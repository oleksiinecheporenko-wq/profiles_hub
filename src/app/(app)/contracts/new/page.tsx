import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { ContractForm } from "@/components/contracts/ContractForm";
import { PageHeader } from "@/components/PageHeader";
import { getRequestRepository } from "@/lib/data";
import { todayPlainDate } from "@/lib/format";

export const metadata: Metadata = { title: "Новий контракт" };

export default async function NewContractPage(props: PageProps<"/contracts/new">) {
  const { profile: profileParam } = await props.searchParams;
  const repo = await getRequestRepository();
  const profiles = (await repo.listProfiles())
    .map((p) => ({ id: p.id, fullName: p.fullName, profileUrl: p.profileUrl }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "uk"));

  // `?profile=<id>` from the profile tab: preselected and locked.
  const locked = typeof profileParam === "string" && profiles.some((p) => p.id === profileParam) ? profileParam : null;
  const back = locked ? `/profiles/${locked}?tab=contracts` : "/contracts";

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg">
        <ArrowLeft className="size-3.5" aria-hidden />
        {locked ? "Профіль" : "Контракти"}
      </Link>
      <PageHeader icon={FilePlus2} title="Новий контракт" />
      <ContractForm
        mode="create"
        profiles={profiles}
        lockedProfile={!!locked}
        cancelHref={back}
        initial={{ profileId: locked, createdDate: todayPlainDate(), title: "", rate: "", description: "", dialog: "" }}
      />
    </>
  );
}
