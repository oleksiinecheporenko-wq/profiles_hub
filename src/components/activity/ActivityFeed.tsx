"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  ChevronDown,
  CircleDot,
  FileText,
  Layers,
  PenLine,
  SearchX,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { loadMoreActivityAction } from "@/app/(app)/actions/actions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { controlClassName } from "@/components/ui/Input";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { SearchInput } from "@/components/ui/SearchInput";
import { useToast } from "@/components/ui/Toast";
import type { FeedEntry, FeedPage } from "@/lib/data/activityFeed";
import { ACTION_GROUP_KEYS, ACTION_GROUPS, type ActionGroup } from "@/lib/domain/activity";
import { addDays, formatDate, formatTime, kyivPlainDate, todayPlainDate } from "@/lib/format";

const GROUP_ICONS: Record<ActionGroup, LucideIcon> = {
  profile: UserPlus,
  status: CircleDot,
  main: PenLine,
  updates: Layers,
  contracts: FileText,
};

const PERIODS = [
  { value: "today", label: "Сьогодні" },
  { value: "7d", label: "7 днів" },
  { value: "30d", label: "30 днів" },
  { value: "custom", label: "Свій період" },
] as const;

function dayLabel(day: string): string {
  const today = todayPlainDate();
  if (day === today) return "Сьогодні";
  if (day === addDays(today, -1)) return "Вчора";
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

function Entry({ entry, showProfile }: { entry: FeedEntry; showProfile: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = entry.group ? GROUP_ICONS[entry.group] : Activity;
  const detailsId = `entry-${entry.txId}`;
  return (
    <li className="border-b border-line last:border-b-0">
      {/* Layout keeps a slot for a future author avatar; nothing is rendered there yet. */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-fg-2">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <time dateTime={entry.occurredAt} className="mt-1 w-11 shrink-0 font-mono text-xs text-fg-muted" title={formatDate(entry.occurredAt)}>
          {formatTime(entry.occurredAt)}
        </time>
        {showProfile && (
          <div className="mt-0.5 w-52 shrink-0">
            {entry.profile ? (
              <Link href={`/profiles/${entry.profile.id}`} className="flex min-w-0 items-center gap-2 rounded-sm hover:text-accent">
                <ProfileAvatar name={entry.profile.fullName} src={entry.photoUrl} size={24} />
                <span className="truncate text-[13px] font-medium" title={entry.profile.fullName}>
                  {entry.profile.fullName}
                </span>
              </Link>
            ) : (
              <span className="text-[13px] text-fg-muted">Профіль видалено</span>
            )}
          </div>
        )}
        <p className="mt-0.5 min-w-0 flex-1 text-sm break-words text-fg">{entry.summary}</p>
        {entry.expandable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailsId}
            className="-mt-0.5 flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            {open ? "Згорнути" : "Деталі"}
            <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <dl id={detailsId} className="mx-4 mb-3 ml-[92px] flex flex-col gap-2 rounded-md border border-line bg-surface-1 p-3">
          {entry.changes.map((c, i) => (
            <div key={i} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-[13px]">
              <dt className="text-fg-muted">{c.label}</dt>
              <dd className="flex min-w-0 flex-col gap-1">
                <span className="flex gap-2 rounded bg-negative/[.06] px-2 py-0.5 text-fg-2">
                  <span aria-hidden className="font-mono text-negative">−</span>
                  <span className="sr-only">Було:</span>
                  <span className="min-w-0 break-words whitespace-pre-wrap">{c.old ?? <em className="text-fg-muted">порожньо</em>}</span>
                </span>
                <span className="flex gap-2 rounded bg-positive/[.06] px-2 py-0.5 text-fg">
                  <span aria-hidden className="font-mono text-positive">+</span>
                  <span className="sr-only">Стало:</span>
                  <span className="min-w-0 break-words whitespace-pre-wrap">{c.new ?? <em className="text-fg-muted">порожньо</em>}</span>
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

/**
 * Activity feed with filters in the URL (the server renders the first page) and
 * `Показати ще` for the next 50 entries.
 */
export function ActivityFeed({
  initial,
  profileOptions,
  fixedParams = {},
}: {
  initial: FeedPage;
  /** Omit to hide the profile filter and the profile column (profile tab). */
  profileOptions?: SelectOption[];
  /** Filters that are not in the URL, e.g. the profile of the profile tab. */
  fixedParams?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [entries, setEntries] = useState(initial.entries);
  const [cursor, setCursor] = useState(initial.nextCursor);
  // A refreshed first page from the server (e.g. after a change elsewhere) replaces the list.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setEntries(initial.entries);
    setCursor(initial.nextCursor);
  }
  const [loading, startLoading] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const debounce = useRef<number | undefined>(undefined);

  const showProfile = profileOptions !== undefined;
  const period = params.get("period") ?? "";
  const group = (params.get("group") ?? "") as ActionGroup | "";

  const update = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const loadMore = () => {
    if (!cursor) return;
    const plain = { ...Object.fromEntries(params.entries()), ...fixedParams };
    startLoading(async () => {
      const result = await loadMoreActivityAction(plain, cursor);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((list) => [...list, ...result.data.entries]);
      setCursor(result.data.nextCursor);
    });
  };

  const days = useMemo(() => {
    const out: { day: string; items: FeedEntry[] }[] = [];
    for (const e of entries) {
      const day = kyivPlainDate(e.occurredAt);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [entries]);

  const filtersActive = [...params.keys()].some((k) => ["profile", "group", "period", "q", "from", "to"].includes(k));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        {showProfile && (
          <div className="w-64">
            <SearchableSelect
              aria-label="Профіль"
              placeholder="Усі профілі"
              value={params.get("profile")}
              options={profileOptions}
              onChange={(v) => update({ profile: v })}
            />
          </div>
        )}
        <FilterSelect
          label="Дії"
          value={group}
          onChange={(v) => update({ group: v || null })}
          options={ACTION_GROUP_KEYS.map((k) => ({ value: k, label: ACTION_GROUPS[k].label }))}
          className="w-56"
        />
        <FilterSelect
          label="Період"
          allLabel="увесь час"
          value={period as (typeof PERIODS)[number]["value"] | ""}
          onChange={(v) => update({ period: v || null, ...(v !== "custom" ? { from: null, to: null } : {}) })}
          options={[...PERIODS]}
          className="w-48"
        />
        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Від"
              value={params.get("from") ?? ""}
              onChange={(e) => update({ from: e.target.value || null })}
              className={clsx(controlClassName, "h-9 w-40 font-mono [color-scheme:dark]")}
            />
            <span className="text-fg-muted">—</span>
            <input
              type="date"
              aria-label="До"
              value={params.get("to") ?? ""}
              onChange={(e) => update({ to: e.target.value || null })}
              className={clsx(controlClassName, "h-9 w-40 font-mono [color-scheme:dark]")}
            />
          </div>
        )}
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            window.clearTimeout(debounce.current);
            debounce.current = window.setTimeout(() => update({ q: v.trim() || null }), 300);
          }}
          placeholder="Пошук у діях"
          className="ml-auto w-64"
        />
      </div>

      {entries.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={SearchX}
            message="За цими умовами записів не знайдено."
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  update({ profile: null, group: null, period: null, q: null, from: null, to: null });
                }}
                className="cursor-pointer text-[13px] text-accent hover:text-accent-hover"
              >
                Скинути фільтри
              </button>
            }
          />
        ) : (
          <EmptyState icon={Activity} message="Записів у журналі поки немає." />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {days.map(({ day, items }) => (
            <section key={day} aria-label={dayLabel(day)}>
              <h3 className="mb-2 flex items-center gap-3 font-mono text-xs text-fg-muted">
                {dayLabel(day)}
                <span aria-hidden className="h-px flex-1 bg-line" />
              </h3>
              <ul className="rounded-lg border border-line bg-surface-1/40">
                {items.map((e) => (
                  <Entry key={e.txId} entry={e} showProfile={showProfile} />
                ))}
              </ul>
            </section>
          ))}
          {cursor && (
            <div className="flex justify-center">
              <Button onClick={loadMore} loading={loading}>
                Показати ще
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
