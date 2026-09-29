"use client";

import clsx from "clsx";

type Option<T extends string> = { value: T; label: string; count?: number };

type Props<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
};

export function SegmentedControl<T extends string>({ label, value, onChange, options }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface-1 p-0.5"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={clsx(
              "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-[5px] px-3 text-[13px] transition-colors duration-150",
              selected ? "bg-surface-hover text-fg" : "text-fg-2 hover:text-fg",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={clsx("font-mono text-xs", selected ? "text-accent" : "text-fg-muted")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
