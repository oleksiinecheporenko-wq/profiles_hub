"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeftRight, ChevronDown, Loader2 } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import type { VersionSummary } from "@/lib/domain/types";
import { formatPlainDate } from "@/lib/format";

function optionLabel(v: VersionSummary) {
  return `${formatPlainDate(v.updateDate)}${v.isCurrent ? " · актуальна" : ""} — ${v.title ?? "без Title"}`;
}

function VersionSelector({
  label,
  value,
  versions,
  onChange,
}: {
  label: string;
  value: string;
  versions: VersionSummary[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="relative flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-mono text-[11px] tracking-wide text-fg-muted uppercase">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            "h-9 w-full cursor-pointer appearance-none truncate rounded-md border border-line-strong bg-surface-1 pr-8 pl-3 text-sm text-fg",
            "transition-colors hover:border-white/20 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none focus-visible:outline-none",
          )}
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {optionLabel(v)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
      </span>
    </label>
  );
}

/** Left/right version selectors, swap and `Тільки відмінності`, all kept in the URL. */
export function ComparisonToolbar({
  versions,
  left,
  right,
  onlyDiff,
}: {
  versions: VersionSummary[];
  left: string;
  right: string;
  onlyDiff: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (next: { left?: string; right?: string; diff?: boolean }) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("left", next.left ?? left);
    sp.set("right", next.right ?? right);
    const diff = next.diff ?? onlyDiff;
    if (diff) sp.set("diff", "1");
    else sp.delete("diff");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className="sticky top-0 z-20 -mx-8 mb-4 flex items-end gap-3 border-b border-line bg-bg/95 px-8 py-3 backdrop-blur-sm">
      <VersionSelector label="Ліва версія" value={left} versions={versions} onChange={(id) => update({ left: id })} />
      <IconButton label="Поміняти місцями" onClick={() => update({ left: right, right: left })} className="mb-0 border border-line-strong">
        <ArrowLeftRight className="size-4" aria-hidden />
      </IconButton>
      <VersionSelector label="Права версія" value={right} versions={versions} onChange={(id) => update({ right: id })} />
      <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface-1 px-3 text-[13px] text-fg-2 select-none hover:text-fg">
        <input
          type="checkbox"
          role="switch"
          checked={onlyDiff}
          onChange={(e) => update({ diff: e.target.checked })}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={clsx(
            "relative h-4 w-7 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
            onlyDiff ? "bg-accent" : "bg-surface-hover",
          )}
        >
          <span className={clsx("absolute top-0.5 size-3 rounded-full bg-fg transition-transform", onlyDiff ? "translate-x-3.5" : "translate-x-0.5")} />
        </span>
        Тільки відмінності
      </label>
      <span className="flex h-9 w-4 items-center" aria-live="polite">
        {pending && <Loader2 className="size-4 animate-spin text-fg-muted" aria-label="Оновлення" />}
      </span>
    </div>
  );
}
