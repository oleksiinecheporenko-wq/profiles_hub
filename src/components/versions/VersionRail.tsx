import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import type { VersionSummary } from "@/lib/domain/types";
import { formatPlainDate } from "@/lib/format";

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "зміна";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "зміни";
  return "змін";
}

/** Sticky version timeline: `+ Нове оновлення` and versions newest first. */
export function VersionRail({
  versions,
  selectedId,
  hrefFor,
  newHref,
  creating,
}: {
  versions: VersionSummary[];
  selectedId: string | null;
  hrefFor: (versionId: string) => string;
  newHref: string;
  creating: boolean;
}) {
  return (
    <aside aria-label="Версії профілю" className="sticky top-6 flex flex-col gap-3 self-start">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-fg-muted">{"// profile history"}</p>
        <span className="font-mono text-xs text-fg-muted">{versions.length}</span>
      </div>
      <Link
        href={newHref}
        scroll={false}
        aria-current={creating ? "page" : undefined}
        className={clsx(buttonClassName(creating ? "secondary" : "primary", "md"), "w-full")}
      >
        <Plus className="size-4" aria-hidden />
        Нове оновлення
      </Link>
      <ol className="relative flex flex-col">
        {versions.map((v) => {
          const selected = !creating && v.id === selectedId;
          return (
            <li key={v.id}>
              <Link
                href={hrefFor(v.id)}
                scroll={false}
                aria-current={selected ? "true" : undefined}
                className={clsx(
                  "group relative flex gap-3 rounded-md py-2.5 pr-2 pl-3 transition-colors duration-150",
                  selected ? "bg-surface-2" : "hover:bg-surface-hover",
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "mt-1.5 size-2 shrink-0 rounded-full border",
                    v.isCurrent ? "border-accent bg-accent" : "border-line-strong bg-transparent",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={clsx("font-mono text-[13px]", selected ? "text-fg" : "text-fg-2")}>
                      {formatPlainDate(v.updateDate)}
                    </span>
                    {v.isCurrent && (
                      <span className="rounded-sm bg-accent-soft px-1.5 font-mono text-[10px] tracking-wide text-accent uppercase">
                        актуальна
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-fg-muted" title={v.title ?? undefined}>
                    {v.title ?? "Title не вказано"}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-fg-muted">
                    {v.dailyChangeCount} {plural(v.dailyChangeCount)}
                  </span>
                </span>
                {selected && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-fg-muted" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
