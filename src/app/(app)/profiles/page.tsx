import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AddProfileButton } from "@/components/profiles/AddProfileDialog";
import { ProfilesTable } from "@/components/profiles/ProfilesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRequestRepository } from "@/lib/data";
import { profilePhotoUrls } from "@/lib/data/images";

export const metadata: Metadata = { title: "Профілі" };

export default async function ProfilesPage() {
  const repo = await getRequestRepository();
  const profiles = await repo.listProfiles();
  const photoUrls = await profilePhotoUrls(repo, profiles);

  return (
    <>
      <PageHeader icon={Users} title="01 · Профілі" count={profiles.length} actions={<AddProfileButton />} />
      {profiles.length === 0 ? (
        <EmptyState icon={Users} message="Профілів поки немає. Додайте перший." />
      ) : (
        <ProfilesTable profiles={profiles} photoUrls={photoUrls} />
      )}
    </>
  );
}
