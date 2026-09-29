"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";

export type FilterOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T | "";
  onChange: (value: T | "") => void;
  options: FilterOption<T>[];
  /** Label of the empty "all" option. */
  allLabel?: string;
  className?: string;
};

/** Compact native select for list filters. The `label` is the accessible name. */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel = "Усі",
  className,
}: Props<T>) {
  return (
    <div className={clsx("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T | "")}
        className={clsx(
          "h-9 w-full cursor-pointer appearance-none rounded-md border border-line-strong bg-surface-1 pr-8 pl-3 text-sm",
          "transition-colors duration-150 hover:border-white/20",
          "focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none focus-visible:outline-none",
          value ? "text-fg" : "text-fg-2",
        )}
      >
        <option value="">
          {label}: {allLabel.toLocaleLowerCase("uk")}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
    </div>
  );
}
