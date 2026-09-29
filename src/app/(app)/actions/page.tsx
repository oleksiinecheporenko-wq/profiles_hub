import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { PageHeader } from "@/components/PageHeader";
import { getRequestRepository } from "@/lib/data";
import { loadFeed, parseFeedFilters } from "@/lib/data/activityFeed";

export const metadata: Metadata = { title: "Дії" };

export default async function ActionsPage(props: PageProps<"/actions">) {
  const sp = await props.searchParams;
  const filters = parseFeedFilters(sp);
  const repo = await getRequestRepository();
  const [page, profiles] = await Promise.all([loadFeed(repo, filters), repo.listProfiles()]);
  const options = profiles
    .map((p) => ({ value: p.id, label: p.fullName }))
    .sort((a, b) => a.label.localeCompare(b.label, "uk"));

  return (
    <>
      <PageHeader icon={Activity} title="03 · Дії" />
      {/* Remount on filter change so appended pages reset. */}
      <ActivityFeed key={JSON.stringify(filters)} initial={page} profileOptions={options} />
    </>
  );
}
