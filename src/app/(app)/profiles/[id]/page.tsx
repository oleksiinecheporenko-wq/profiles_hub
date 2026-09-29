import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LayoutPanelTop } from "lucide-react";
import { ProfileStatusBadge } from "@/components/ui/Badges";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { Tabs } from "@/components/ui/Tabs";
import { getRequestRepository } from "@/lib/data";
import { profilePhotoUrls } from "@/lib/data/images";
import { formatDateTime } from "@/lib/format";

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
  const detail = await repo.getProfile(id);
  if (!detail) return null;
  const photos = await profilePhotoUrls(repo, [detail.profile]);
  return { ...detail, photoUrl: detail.profile.photoPath ? photos[detail.profile.photoPath] : undefined };
}

export async function generateMetadata(props: PageProps<"/profiles/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const data = await load(id);
  return { title: data?.profile.fullName ?? "Профіль" };
}

// TODO(phase 4): status change, avatar upload, `Основна інформація` with inline editing.
// TODO(phase 5–7, 9, 10): `Оновлення`, `Журнал дій`, `Контракти` tabs.
export default async function ProfilePage(props: PageProps<"/profiles/[id]">) {
  const { id } = await props.params;
  const { tab: tabParam } = await props.searchParams;
  const data = await load(id);
  if (!data) notFound();

  const { profile, photoUrl } = data;
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "main";

  return (
    <>
      <Link
        href="/profiles"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Профілі
      </Link>

      <header className="flex items-start justify-between gap-6 pb-6">
        <div className="flex min-w-0 items-center gap-4">
          <ProfileAvatar name={profile.fullName} src={photoUrl} size={64} />
          <div className="min-w-0">
            <p className="font-mono text-xs text-fg-muted">{"// profile"}</p>
            <h1 className="mt-1 truncate text-[26px] leading-tight font-semibold tracking-tight" title={profile.fullName}>
              {profile.fullName}
            </h1>
            <p className="mt-1 truncate text-sm text-fg-2" title={profile.title ?? undefined}>
              {profile.title ?? <span className="text-fg-muted">Title не вказано</span>}
            </p>
            {profile.profileUrl && (
              <div className="mt-1 flex items-center gap-1">
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono text-xs text-fg-muted transition-colors hover:text-accent"
                >
                  {profile.profileUrl}
                </a>
                <CopyButton value={profile.profileUrl} label="Копіювати посилання" />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ProfileStatusBadge status={profile.status} />
          <p className="font-mono text-xs text-fg-muted">
            Оновлено <time dateTime={profile.lastActivityAt}>{formatDateTime(profile.lastActivityAt)}</time>
          </p>
        </div>
      </header>

      <Tabs
        label="Розділи профілю"
        activeKey={tab}
        items={TABS.map((t) => ({ ...t, href: t.key === "main" ? `/profiles/${id}` : `/profiles/${id}?tab=${t.key}` }))}
      />

      <div className="pt-6">
        <EmptyState icon={LayoutPanelTop} message="Вміст цієї вкладки ще недоступний." />
      </div>
    </>
  );
}
