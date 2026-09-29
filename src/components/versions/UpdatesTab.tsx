import { GitCompareArrows, History, Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import type { Repository } from "@/lib/data/repository";
import type { ProfileVersion } from "@/lib/domain/types";
import { draftFromVersion } from "@/lib/domain/versions";
import { todayPlainDate } from "@/lib/format";
import { VersionForm } from "./VersionForm";
import { VersionRail } from "./VersionRail";
import { VersionView } from "./VersionView";

export const UPDATE_SUBTABS = [
  { key: "global", label: "Глобальне оновлення" },
  { key: "daily", label: "Щоденні оновлення" },
  { key: "compare", label: "Порівняння" },
] as const;
export type UpdatesSubtab = (typeof UPDATE_SUBTABS)[number]["key"];

async function portfolioImageUrls(repo: Repository, versions: (ProfileVersion | null)[]) {
  const paths = versions.flatMap((v) => v?.content.portfolio.map((p) => p.image_path).filter((p): p is string => !!p) ?? []);
  if (paths.length === 0) return {};
  try {
    return await repo.signedImageUrls("portfolio-images", paths);
  } catch (error) {
    console.error("[images]", error);
    return {};
  }
}

export async function UpdatesTab({
  repo,
  profileId,
  sub,
  versionParam,
  mode,
}: {
  repo: Repository;
  profileId: string;
  sub: UpdatesSubtab;
  versionParam: string | undefined;
  mode: "view" | "new" | "edit";
}) {
  const base = `/profiles/${profileId}?tab=updates`;
  const subHref = (key: UpdatesSubtab) => (key === "global" ? base : `${base}&sub=${key}`);

  const nav = (
    <Tabs
      label="Оновлення"
      variant="secondary"
      activeKey={sub}
      items={UPDATE_SUBTABS.map((t) => ({ ...t, href: subHref(t.key) }))}
      className="mb-5"
    />
  );

  if (sub === "daily") {
    // TODO(phase 6): daily updates editor and history.
    return (
      <>
        {nav}
        <EmptyState icon={History} message="Щоденні оновлення ще недоступні." />
      </>
    );
  }
  if (sub === "compare") {
    // TODO(phase 7): side-by-side comparison.
    return (
      <>
        {nav}
        <EmptyState icon={GitCompareArrows} message="Порівняння ще недоступне." />
      </>
    );
  }

  const versions = await repo.listVersions(profileId);
  const currentSummary = versions.find((v) => v.isCurrent) ?? null;
  const selectedId = versions.some((v) => v.id === versionParam) ? versionParam! : currentSummary?.id ?? null;

  if (!selectedId) {
    return (
      <>
        {nav}
        <EmptyState icon={Layers} message="У профілю ще немає версій." />
      </>
    );
  }

  const [selected, current] = await Promise.all([
    repo.getVersion(selectedId),
    currentSummary ? repo.getVersion(currentSummary.id) : Promise.resolve(null),
  ]);
  if (!selected) {
    return (
      <>
        {nav}
        <EmptyState icon={Layers} message="Версію не знайдено." />
      </>
    );
  }

  const hrefFor = (id: string) => (id === currentSummary?.id ? base : `${base}&version=${id}`);
  const rail = (
    <VersionRail
      versions={versions}
      selectedId={selected.id}
      hrefFor={hrefFor}
      newHref={`${base}&mode=new`}
      creating={mode === "new"}
    />
  );

  let main;
  if (mode === "new" && current) {
    main = (
      <VersionForm
        key="new"
        mode="create"
        profileId={profileId}
        baseHref={base}
        initial={draftFromVersion(current, todayPlainDate())}
        imageUrls={await portfolioImageUrls(repo, [current])}
      />
    );
  } else if (mode === "edit") {
    main = (
      <VersionForm
        key={`edit-${selected.id}-${selected.updatedAt}`}
        mode="edit"
        profileId={profileId}
        baseHref={base}
        versionId={selected.id}
        expectedUpdatedAt={selected.updatedAt}
        archived={!selected.isCurrent}
        initial={{ updateDate: selected.updateDate, content: selected.content }}
        imageUrls={await portfolioImageUrls(repo, [selected])}
      />
    );
  } else {
    const [changes, imageUrls] = await Promise.all([
      repo.listDailyChanges(selected.id),
      portfolioImageUrls(repo, [selected]),
    ]);
    main = (
      <VersionView
        version={selected}
        changes={changes}
        imageUrls={imageUrls}
        editHref={`${base}&version=${selected.id}&mode=edit`}
        currentHref={selected.isCurrent ? null : base}
      />
    );
  }

  return (
    <>
      {nav}
      <div className="grid grid-cols-[minmax(0,68fr)_minmax(248px,32fr)] items-start gap-8">
        {main}
        {rail}
      </div>
    </>
  );
}
