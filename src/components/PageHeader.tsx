import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  /** Thematic icon shown before the title. */
  icon: LucideIcon;
  title: string;
  /** Muted figure next to the title, e.g. a count. */
  count?: number;
  actions?: ReactNode;
};

export function PageHeader({ icon: Icon, title, count, actions }: Props) {
  return (
    <header className="flex items-center justify-between gap-6 pb-6">
      <h1 className="flex min-w-0 items-center gap-3 text-[28px] leading-tight font-semibold tracking-tight">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-1">
          <Icon className="size-5 text-accent" aria-hidden />
        </span>
        <span className="truncate">{title}</span>
        {count !== undefined && <span className="font-mono text-base font-normal text-fg-muted">{count}</span>}
      </h1>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
