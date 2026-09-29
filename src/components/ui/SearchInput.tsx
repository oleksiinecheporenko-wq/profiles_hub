"use client";

import clsx from "clsx";
import { Search, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
};

export function SearchInput({ value, onChange, placeholder = "Пошук", label, className }: Props) {
  return (
    <div className={clsx("relative w-72", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className={clsx(
          "h-9 w-full rounded-md border border-line-strong bg-surface-1 pr-8 pl-8 text-sm text-fg",
          "placeholder:text-fg-muted transition-colors duration-150 hover:border-white/20",
          "focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none focus-visible:outline-none",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Очистити пошук"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-hover hover:text-fg"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
