import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LayoutPanelTop } from "lucide-react";
import { MainInfoTab } from "@/components/profiles/MainInfoTab";
import { ProfileHeader } from "@/components/profiles/ProfileHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { getRequestRepository } from "@/lib/data";
import { profilePhotoUrls } from "@/lib/data/images";

const TABS = [
  { key: "main", label: "Основна інформація" },
  { key: "updates", label: "Оновлення" },
  { key: "activity", label: "Журнал дій" },
  { key: "contracts", label: "Контракти" },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const repo = await getRequestRepository();
  const [detail, current] = await Promise.all([repo.getProfile(id), repo.getCurrentVersion(id)]);
  if (!detail) return null;
  const photos = await profilePhotoUrls(repo, [detail.profile]);
  return {
    ...detail,
    current,
    photoUrl: detail.profile.photoPath ? photos[detail.profile.photoPath] : undefined,
  };
}

export async function generateMetadata(props: PageProps<"/profiles/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Профіль" };
  const repo = await getRequestRepository();
  const detail = await repo.getProfile(id);
  return { title: detail?.profile.fullName ?? "Профіль" };
}

// TODO(phase 5–7, 9, 10): `Оновлення`, `Журнал дій`, `Контракти` tabs.
export default async function ProfilePage(props: PageProps<"/profiles/[id]">) {
  const { id } = await props.params;
  const { tab: tabParam } = await props.searchParams;
  const data = await load(id);
  if (!data) notFound();

  const { profile, languages, current, photoUrl } = data;
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "main";

  return (
    <>
      <ProfileHeader profile={profile} photoUrl={photoUrl} />

      <Tabs
        label="Розділи профілю"
        activeKey={tab}
        items={TABS.map((t) => ({ ...t, href: t.key === "main" ? `/profiles/${id}` : `/profiles/${id}?tab=${t.key}` }))}
      />

      <div className="pt-6">
        {tab === "main" ? (
          <MainInfoTab
            profile={profile}
            languages={languages}
            version={
              current && {
                id: current.id,
                updatedAt: current.updatedAt,
                title: current.content.title,
                rate: current.content.rate,
                description: current.content.description,
              }
            }
          />
        ) : (
          <EmptyState icon={LayoutPanelTop} message="Вміст цієї вкладки ще недоступний." />
        )}
      </div>
    </>
  );
}
