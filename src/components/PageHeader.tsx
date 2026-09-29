import type { ReactNode } from "react";

type Props = {
  /** Small `//` metadata above the title, e.g. `profiles`. */
  meta: string;
  title: string;
  /** Muted figure next to the title, e.g. a count. */
  count?: number;
  actions?: ReactNode;
};

export function PageHeader({ meta, title, count, actions }: Props) {
  return (
    <header className="flex items-end justify-between gap-6 pb-6">
      <div className="min-w-0">
        <p className="font-mono text-xs text-fg-muted">{`// ${meta}`}</p>
        <h1 className="mt-1.5 flex items-baseline gap-3 text-[28px] leading-tight font-semibold tracking-tight">
          {title}
          {count !== undefined && (
            <span className="font-mono text-base font-normal text-fg-muted">{count}</span>
          )}
        </h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
