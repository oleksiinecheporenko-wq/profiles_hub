"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { FileText, GripVertical, SearchX } from "lucide-react";
import { PROFILE_STATUS_TONE } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PROFILE_STATUSES, PROFILE_STATUS_LABELS, type ProfileStatus } from "@/lib/domain/enums";
import type { ProfileOverview } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { matchesProfileSearch } from "./ProfilesTable";
import { StatusBadgeMenu, StatusChangeDialog } from "./StatusChange";

type View = "kanban" | "grid";

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "активний контракт";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "активні контракти";
  return "активних контрактів";
}

function Metrics({
  counts,
  total,
  active,
  onSelect,
}: {
  counts: Record<ProfileStatus, number>;
  total: number;
  active: ProfileStatus | null;
  onSelect: (s: ProfileStatus | null) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-3" role="group" aria-label="Фільтр за статусом">
      {PROFILE_STATUSES.map((s) => {
        const tone = PROFILE_STATUS_TONE[s];
        const selected = active === s;
        const pct = total === 0 ? 0 : Math.round((counts[s] / total) * 100);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : s)}
            className={clsx(
              "group flex cursor-pointer flex-col gap-2 rounded-lg border bg-surface-1 px-4 pt-3 pb-3 text-left transition-colors duration-150",
              selected ? "border-line-strong bg-surface-2" : "border-line hover:bg-surface-hover",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] text-fg-2">
              <span className={clsx("size-2 rounded-full", tone.dot)} aria-hidden />
              {PROFILE_STATUS_LABELS[s]}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold text-fg">{counts[s]}</span>
              <span className="font-mono text-xs text-fg-muted">{pct}%</span>
            </span>
            <span className="h-px w-full bg-line" aria-hidden>
              <span className={clsx("block h-px", tone.dot)} style={{ width: `${pct}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProfileCard({
  profile,
  photoUrl,
  dragHandle,
  dragging,
}: {
  profile: ProfileOverview;
  photoUrl?: string;
  dragHandle?: React.ReactNode;
  dragging?: boolean;
}) {
  const tone = PROFILE_STATUS_TONE[profile.status];
  return (
    <div
      className={clsx(
        "relative rounded-md border border-l-2 border-line bg-surface-1 transition-shadow",
        tone.edge,
        dragging && "shadow-[0_12px_32px_rgba(0,0,0,.5)]",
      )}
    >
      <div className="flex items-start gap-2 p-3">
        {dragHandle}
        <Link href={`/profiles/${profile.id}`} className="flex min-w-0 flex-1 items-start gap-2.5 rounded-sm">
          <ProfileAvatar name={profile.fullName} src={photoUrl} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg" title={profile.fullName}>
              {profile.fullName}
            </span>
            <span className="block truncate text-[13px] text-fg-muted" title={profile.title ?? undefined}>
              {profile.title ?? "Title не вказано"}
            </span>
          </span>
        </Link>
      </div>
      <p className="-mt-1 px-3 pb-2 font-mono text-[11px] text-fg-muted">у статусі з {formatDate(profile.statusChangedAt)}</p>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <StatusBadgeMenu profile={profile} size="sm" />
        <span className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-fg-muted">
          {profile.activeContractsCount > 0 && (
            <span className="flex items-center gap-1" title={`${profile.activeContractsCount} ${plural(profile.activeContractsCount)}`}>
              <FileText className="size-3" aria-hidden />
              {profile.activeContractsCount}
              <span className="sr-only">{plural(profile.activeContractsCount)}</span>
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ profile, photoUrl }: { profile: ProfileOverview; photoUrl?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: profile.id,
    data: { profile },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={clsx(isDragging && "relative z-30 opacity-90")}
    >
      <ProfileCard
        profile={profile}
        photoUrl={photoUrl}
        dragging={isDragging}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Перетягнути «${profile.fullName}» в іншу колонку`}
            title="Перетягнути в іншу колонку"
            className="-ml-1 flex h-9 w-5 shrink-0 cursor-grab items-center justify-center rounded text-fg-muted hover:text-fg active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
      />
    </li>
  );
}

function Column({
  status,
  profiles,
  photoUrls,
}: {
  status: ProfileStatus;
  profiles: ProfileOverview[];
  photoUrls: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const tone = PROFILE_STATUS_TONE[status];
  return (
    <section
      ref={setNodeRef}
      aria-label={`${PROFILE_STATUS_LABELS[status]}: ${profiles.length}`}
      className={clsx(
        "flex min-h-64 min-w-0 flex-col rounded-lg border bg-surface-1/40 transition-colors duration-150",
        isOver ? "border-line-strong bg-surface-2/70" : "border-line",
      )}
    >
      <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <span className={clsx("size-2 rounded-full", tone.dot)} aria-hidden />
          {PROFILE_STATUS_LABELS[status]}
        </span>
        <span className="font-mono text-xs text-fg-muted">{profiles.length}</span>
      </header>
      <ul className="flex flex-col gap-2 p-2">
        {profiles.map((p) => (
          <DraggableCard key={p.id} profile={p} photoUrl={p.photoPath ? photoUrls[p.photoPath] : undefined} />
        ))}
        {profiles.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-fg-muted">Немає профілів</li>}
      </ul>
    </section>
  );
}

export function StatusBoard({ profiles, photoUrls }: { profiles: ProfileOverview[]; photoUrls: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const view: View = params.get("view") === "grid" ? "grid" : "kanban";
  const statusParam = params.get("status");
  const filter = PROFILE_STATUSES.includes(statusParam as ProfileStatus) ? (statusParam as ProfileStatus) : null;
  const [pending, setPending] = useState<{ profile: ProfileOverview; target: ProfileStatus } | null>(null);

  const updateUrl = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const counts = useMemo(() => {
    const c = { active: 0, hold: 0, ban: 0, back_to_developer: 0 } as Record<ProfileStatus, number>;
    for (const p of profiles) c[p.status]++;
    return c;
  }, [profiles]);

  const visible = useMemo(
    () =>
      profiles
        .filter((p) => (!filter || p.status === filter) && matchesProfileSearch(p, query))
        .sort((a, b) => (a.statusChangedAt < b.statusChangedAt ? 1 : -1)),
    [profiles, filter, query],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const profile = e.active.data.current?.profile as ProfileOverview | undefined;
    const target = e.over?.id as ProfileStatus | undefined;
    // The card stays in its column until the change is confirmed.
    if (profile && target && target !== profile.status) setPending({ profile, target });
  };

  const columns = filter ? [filter] : [...PROFILE_STATUSES];

  return (
    <div className="flex flex-col gap-5">
      <Metrics counts={counts} total={profiles.length} active={filter} onSelect={(s) => updateUrl({ status: s })} />

      <div className="flex items-center gap-2">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            updateUrl({ q: v.trim() || null });
          }}
          placeholder="Пошук за ПІБ або Title"
        />
        {filter && (
          <button
            type="button"
            onClick={() => updateUrl({ status: null })}
            className="h-9 cursor-pointer rounded-md px-3 text-[13px] text-fg-2 hover:bg-surface-hover hover:text-fg"
          >
            Показати всі статуси
          </button>
        )}
        <div className="ml-auto">
          <SegmentedControl<View>
            label="Вигляд"
            value={view}
            onChange={(v) => updateUrl({ view: v === "grid" ? "grid" : null })}
            options={[
              { value: "kanban", label: "Канбан" },
              { value: "grid", label: "Сітка" },
            ]}
          />
        </div>
      </div>

      {visible.length === 0 && (query.trim() || filter) ? (
        <EmptyState
          icon={SearchX}
          message="За цими умовами профілів не знайдено."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery("");
                updateUrl({ q: null, status: null });
              }}
              className="cursor-pointer text-[13px] text-accent hover:text-accent-hover"
            >
              Скинути фільтри
            </button>
          }
        />
      ) : view === "kanban" ? (
        <DndContext
          sensors={sensors}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: {
              draggable: "Натисніть пробіл, щоб узяти картку, стрілками перенесіть у колонку, пробіл — відпустити, Escape — скасувати.",
            },
          }}
        >
          <div className={clsx("grid items-start gap-3", columns.length === 1 ? "grid-cols-[minmax(0,420px)]" : "grid-cols-4")}>
            {columns.map((s) => (
              <Column key={s} status={s} profiles={visible.filter((p) => p.status === s)} photoUrls={photoUrls} />
            ))}
          </div>
        </DndContext>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {visible.map((p) => (
            <li key={p.id}>
              <ProfileCard profile={p} photoUrl={p.photoPath ? photoUrls[p.photoPath] : undefined} />
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <StatusChangeDialog profile={pending.profile} target={pending.target} onClose={() => setPending(null)} />
      )}
    </div>
  );
}
