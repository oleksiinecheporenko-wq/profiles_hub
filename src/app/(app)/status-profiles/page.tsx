import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AddProfileButton } from "@/components/profiles/AddProfileDialog";
import { StatusBoard } from "@/components/profiles/StatusBoard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRequestRepository } from "@/lib/data";
import { profilePhotoUrls } from "@/lib/data/images";

export const metadata: Metadata = { title: "Статус профілів" };

export default async function StatusProfilesPage() {
  const repo = await getRequestRepository();
  const profiles = await repo.listProfiles();
  const photoUrls = await profilePhotoUrls(repo, profiles);

  return (
    <>
      <PageHeader meta="overview" title="02 · Статус профілів" count={profiles.length} actions={<AddProfileButton />} />
      {profiles.length === 0 ? (
        <EmptyState icon={LayoutGrid} message="Профілів поки немає. Додайте перший." />
      ) : (
        <StatusBoard profiles={profiles} photoUrls={photoUrls} />
      )}
    </>
  );
}
