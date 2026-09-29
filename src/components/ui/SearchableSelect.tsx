"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, X } from "lucide-react";
import { controlClassName } from "./Input";

export type SelectOption = { value: string; label: string };

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Shows a clear button when a value is selected. */
  clearable?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
};

const MAX_VISIBLE = 200;

/** Combobox: type to filter, arrows to move, Enter to pick, Escape to close. */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Оберіть…",
  clearable = true,
  id,
  autoFocus,
  onKeyDown,
  disabled,
  className,
  ...aria
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("uk");
    const matches = q ? options.filter((o) => o.label.toLocaleLowerCase("uk").includes(q)) : options;
    return matches.slice(0, MAX_VISIBLE);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    const index = selected ? Math.max(0, filtered.findIndex((o) => o.value === selected.value)) : 0;
    setActive(index);
    setOpen(true);
  };

  const pick = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    input.current?.focus();
  };

  return (
    <div ref={root} className={clsx("relative", className)}>
      <input
        ref={input}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        // Closed: the selection is shown as the placeholder, so typing starts a fresh search.
        value={open ? query : ""}
        onClick={() => (open ? undefined : openList())}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) openList();
            else setActive((i) => Math.min(i + 1, filtered.length - 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            e.stopPropagation();
            if (filtered[active]) pick(filtered[active]);
            return;
          }
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setQuery("");
            return;
          }
          onKeyDown?.(e);
        }}
        className={clsx(
          controlClassName,
          "h-10 pr-14",
          !open && selected ? "placeholder:text-fg" : "",
        )}
        {...aria}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
        {clearable && selected && !disabled && (
          <button
            type="button"
            aria-label="Очистити"
            onClick={() => {
              onChange(null);
              input.current?.focus();
            }}
            className="flex size-6 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
        <ChevronDown className="pointer-events-none size-4 text-fg-muted" aria-hidden />
      </div>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="absolute top-full right-0 z-40 mt-1 max-h-64 w-full min-w-72 overflow-y-auto rounded-lg border border-line-strong bg-surface-2 p-1 shadow-[0_12px_32px_rgba(0,0,0,.45)]"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-[13px] text-fg-muted">Нічого не знайдено</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={clsx(
                  "flex h-8 cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 text-[13px]",
                  i === active ? "bg-surface-hover text-fg" : "text-fg-2",
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="size-3.5 shrink-0 text-accent" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
