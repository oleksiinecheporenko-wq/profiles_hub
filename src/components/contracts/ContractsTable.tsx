"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { FileText, SearchX } from "lucide-react";
import { ContractStatusBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { SearchInput } from "@/components/ui/SearchInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ContractListItem } from "@/lib/domain/types";
import { formatPlainDate, formatRate } from "@/lib/format";

type Segment = "all" | "active" | "closed";

/**
 * Contracts list with status segments, search by title and (on the global page)
 * a profile filter. Filters live in the URL.
 */
export function ContractsTable({
  contracts,
  photoUrls,
  profileOptions,
  emptyAction,
}: {
  contracts: ContractListItem[];
  photoUrls: Record<string, string>;
  /** Present on the global page: shows the profile filter and column. */
  profileOptions?: SelectOption[];
  emptyAction?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const showProfile = profileOptions !== undefined;

  const [query, setQuery] = useState(params.get("q") ?? "");
  const segParam = params.get("status");
  const segment: Segment = segParam === "active" || segParam === "closed" ? segParam : "all";
  const profileFilter = showProfile ? params.get("profile") : null;

  const update = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const base = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("uk");
    return contracts.filter(
      (c) => (!profileFilter || c.profileId === profileFilter) && (!q || c.title.toLocaleLowerCase("uk").includes(q)),
    );
  }, [contracts, profileFilter, query]);

  const counts = {
    all: base.length,
    active: base.filter((c) => c.status === "active").length,
    closed: base.filter((c) => c.status === "closed").length,
  };
  const rows = segment === "all" ? base : base.filter((c) => c.status === segment);
  const filtersActive = query.trim() !== "" || !!profileFilter || segment !== "all";

  if (contracts.length === 0) {
    return <EmptyState icon={FileText} message="Контрактів поки немає." action={emptyAction} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Segment>
          label="Статус контракту"
          value={segment}
          onChange={(v) => update({ status: v === "all" ? null : v })}
          options={[
            { value: "all", label: "Усі", count: counts.all },
            { value: "active", label: "Активні", count: counts.active },
            { value: "closed", label: "Закриті", count: counts.closed },
          ]}
        />
        {showProfile && (
          <div className="w-64">
            <SearchableSelect
              aria-label="Профіль"
              placeholder="Усі профілі"
              value={profileFilter}
              options={profileOptions}
              onChange={(v) => update({ profile: v })}
            />
          </div>
        )}
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            update({ q: v.trim() || null });
          }}
          placeholder="Пошук за тайтлом"
          className="ml-auto w-64"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          message="За цими умовами контрактів не знайдено."
          action={
            filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  update({ q: null, status: null, profile: null });
                }}
                className="cursor-pointer text-[13px] text-accent hover:text-accent-hover"
              >
                Скинути фільтри
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col />
              {showProfile && <col className="w-[26%]" />}
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-[128px]" />
            </colgroup>
            <thead>
              <tr className="h-10 border-b border-line bg-surface-1 text-left font-mono text-[11px] tracking-wide text-fg-muted uppercase">
                <th scope="col" className="px-4 font-normal">Тайтл</th>
                {showProfile && <th scope="col" className="px-3 font-normal">Профіль</th>}
                <th scope="col" className="px-3 font-normal">Рейт</th>
                <th scope="col" className="px-3 font-normal">Дата створення</th>
                <th scope="col" className="px-3 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr
                  key={c.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button")) return;
                    router.push(`/contracts/${c.id}`);
                  }}
                  className="h-13 cursor-pointer transition-colors duration-150 hover:bg-surface-hover"
                >
                  <td className="px-4">
                    <Link href={`/contracts/${c.id}`} className="block truncate font-medium text-fg" title={c.title}>
                      {c.title}
                    </Link>
                  </td>
                  {showProfile && (
                    <td className="px-3">
                      <Link href={`/profiles/${c.profile.id}`} className="flex min-w-0 items-center gap-2 rounded-sm hover:text-accent">
                        <ProfileAvatar name={c.profile.fullName} src={c.profile.photoPath ? photoUrls[c.profile.photoPath] : undefined} size={24} />
                        <span className="truncate text-[13px]" title={c.profile.fullName}>
                          {c.profile.fullName}
                        </span>
                      </Link>
                    </td>
                  )}
                  <td className={clsx("px-3 font-mono text-[13px]", c.rate === null ? "text-fg-muted" : "text-fg-2")}>
                    {formatRate(c.rate)}
                  </td>
                  <td className="px-3 font-mono text-[13px] text-fg-2">{formatPlainDate(c.createdDate)}</td>
                  <td className="px-3">
                    <ContractStatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
