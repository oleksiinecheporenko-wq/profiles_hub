import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { ContractsTable } from "@/components/contracts/ContractsTable";
import { PageHeader } from "@/components/PageHeader";
import { buttonClassName } from "@/components/ui/Button";
import { getRequestRepository } from "@/lib/data";
import { profilePhotoUrls } from "@/lib/data/images";

export const metadata: Metadata = { title: "Контракти" };

export default async function ContractsPage() {
  const repo = await getRequestRepository();
  const [contracts, profiles] = await Promise.all([repo.listContracts(), repo.listProfiles()]);
  const photoUrls = await profilePhotoUrls(repo, contracts.map((c) => c.profile));
  const options = profiles
    .map((p) => ({ value: p.id, label: p.fullName }))
    .sort((a, b) => a.label.localeCompare(b.label, "uk"));

  const add = (
    <Link href="/contracts/new" className={buttonClassName("primary", "md")}>
      <Plus className="size-4" aria-hidden />
      Додати контракт
    </Link>
  );

  return (
    <>
      <PageHeader icon={FileText} title="04 · Контракти" count={contracts.length} actions={add} />
      <ContractsTable contracts={contracts} photoUrls={photoUrls} profileOptions={options} />
    </>
  );
}
