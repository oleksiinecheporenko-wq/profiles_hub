"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ArrowUpRight, ExternalLink, SearchX } from "lucide-react";
import { ProfileStatusBadge } from "@/components/ui/Badges";
import { IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { CopyButton } from "@/components/ui/CopyButton";
import { PROFILE_STATUSES, PROFILE_STATUS_LABELS, type ProfileStatus } from "@/lib/domain/enums";
import type { ProfileOverview } from "@/lib/domain/types";
import { formatDate, formatTime } from "@/lib/format";

type Sort = "desc" | "asc";

const STATUS_OPTIONS = PROFILE_STATUSES.map((s) => ({ value: s, label: PROFILE_STATUS_LABELS[s] }));

/** Case-insensitive match over full name and Title. */
export function matchesProfileSearch(p: Pick<ProfileOverview, "fullName" | "title">, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("uk");
  if (!q) return true;
  return `${p.fullName}\n${p.title ?? ""}`.toLocaleLowerCase("uk").includes(q);
}

export function ProfilesTable({
  profiles,
  photoUrls,
}: {
  profiles: ProfileOverview[];
  photoUrls: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Filters live in the URL so back navigation restores them.
  const [query, setQuery] = useState(params.get("q") ?? "");
  const statusParam = params.get("status");
  const status: ProfileStatus | "" = PROFILE_STATUSES.includes(statusParam as ProfileStatus)
    ? (statusParam as ProfileStatus)
    : "";
  const sort: Sort = params.get("sort") === "asc" ? "asc" : "desc";

  const updateUrl = (next: { q?: string; status?: string; sort?: Sort }) => {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === "sort" && value === "desc")) sp.set(key, value);
      else sp.delete(key);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const rows = useMemo(() => {
    const filtered = profiles.filter((p) => (!status || p.status === status) && matchesProfileSearch(p, query));
    return filtered.sort((a, b) => {
      const cmp = a.lastActivityAt < b.lastActivityAt ? -1 : a.lastActivityAt > b.lastActivityAt ? 1 : 0;
      return sort === "asc" ? cmp : -cmp;
    });
  }, [profiles, status, query, sort]);

  const filtersActive = query.trim() !== "" || status !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            updateUrl({ q: v.trim() });
          }}
          placeholder="Пошук за ПІБ або Title"
        />
        <FilterSelect
          label="Статус"
          value={status}
          onChange={(v) => updateUrl({ status: v })}
          options={STATUS_OPTIONS}
          className="w-48"
        />
      </div>

      {rows.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={SearchX}
            message="За цими умовами профілів не знайдено."
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  updateUrl({ q: "", status: "" });
                }}
                className="cursor-pointer text-[13px] text-accent hover:text-accent-hover"
              >
                Скинути фільтри
              </button>
            }
          />
        ) : null
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[27%]" />
              <col />
              <col className="w-[156px]" />
              <col className="w-[132px]" />
              <col className="w-[72px]" />
              <col className="w-[96px]" />
            </colgroup>
            <thead>
              <tr className="h-10 border-b border-line bg-surface-1 text-left font-mono text-[11px] tracking-wide text-fg-muted uppercase">
                <th scope="col" className="px-4 font-normal">Профіль</th>
                <th scope="col" className="px-3 font-normal">Title</th>
                <th scope="col" className="px-3 font-normal">Статус</th>
                <th scope="col" className="px-3 font-normal" aria-sort={sort === "asc" ? "ascending" : "descending"}>
                  <button
                    type="button"
                    onClick={() => updateUrl({ sort: sort === "desc" ? "asc" : "desc" })}
                    className="-mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 uppercase hover:text-fg"
                    title={sort === "desc" ? "Спочатку нові" : "Спочатку старі"}
                  >
                    Оновлено
                    {sort === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />}
                  </button>
                </th>
                <th scope="col" className="px-3 font-normal">Upwork</th>
                <th scope="col" className="px-3 text-right font-normal">
                  <span className="pr-1">Дії</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <ProfileRow key={p.id} profile={p} photoUrl={p.photoPath ? photoUrls[p.photoPath] : undefined} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProfileRow({ profile: p, photoUrl }: { profile: ProfileOverview; photoUrl?: string }) {
  const router = useRouter();
  const href = `/profiles/${p.id}`;

  return (
    <tr
      onClick={(e) => {
        // Links and buttons inside the row keep their own behavior.
        if ((e.target as HTMLElement).closest("a,button")) return;
        router.push(href);
      }}
      className="group h-14 cursor-pointer transition-colors duration-150 hover:bg-surface-hover"
    >
      <td className="px-4">
        <Link href={href} className="flex min-w-0 items-center gap-3 rounded-sm">
          <ProfileAvatar name={p.fullName} src={photoUrl} size={36} />
          <span className="truncate font-medium text-fg" title={p.fullName}>
            {p.fullName}
          </span>
        </Link>
      </td>
      <td className="px-3">
        <span className={clsx("block truncate", p.title ? "text-fg-2" : "text-fg-muted")} title={p.title ?? undefined}>
          {p.title ?? "—"}
        </span>
      </td>
      <td className="px-3">
        <ProfileStatusBadge status={p.status} />
      </td>
      <td className="px-3 font-mono text-[13px] whitespace-nowrap text-fg-2">
        <time dateTime={p.lastActivityAt}>
          {formatDate(p.lastActivityAt)} <span className="text-fg-muted">{formatTime(p.lastActivityAt)}</span>
        </time>
      </td>
      <td className="px-3">
        {p.profileUrl ? (
          <a
            href={p.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Профіль ${p.fullName} на Upwork (нова вкладка)`}
            title="Відкрити на Upwork"
            className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-accent"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        ) : (
          <span className="pl-3 text-fg-muted" aria-label="Посилання немає">—</span>
        )}
      </td>
      <td className="px-3">
        <div className="flex justify-end gap-0.5">
          {p.profileUrl && <CopyButton value={p.profileUrl} label="Копіювати посилання" />}
          <IconButton label="Відкрити профіль" size="sm" onClick={() => router.push(href)}>
            <ArrowUpRight className="size-4" aria-hidden />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}
