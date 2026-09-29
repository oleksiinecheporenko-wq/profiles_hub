"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

export type MenuItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  /** Content of the trigger button. */
  triggerContent: ReactNode;
  triggerClassName?: string;
  /** Accessible name of the trigger when its content is not descriptive. */
  triggerLabel?: string;
  items: MenuItem[];
  align?: "left" | "right";
  /** Accessible name of the menu. */
  label: string;
  className?: string;
};

/** Small dropdown menu: click or Enter/ArrowDown opens, arrows move, Escape closes. */
export function Menu({ triggerContent, triggerClassName, triggerLabel, items, align = "right", label, className }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const triggerEl = useRef<HTMLButtonElement>(null);
  const itemEls = useRef<(HTMLButtonElement | null)[]>([]);

  const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) itemEls.current[active]?.focus();
  }, [open, active]);

  const openAt = (index: number) => {
    setActive(index);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerEl.current?.focus();
  };

  const move = (delta: number) => {
    if (enabled.length === 0) return;
    const pos = enabled.indexOf(active);
    setActive(enabled[(pos + delta + enabled.length) % enabled.length]);
  };

  return (
    <div ref={root} className={clsx("relative inline-flex", className)}>
      <button
        ref={triggerEl}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => (open ? close() : openAt(enabled[0] ?? 0))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openAt(e.key === "ArrowDown" ? (enabled[0] ?? 0) : (enabled[enabled.length - 1] ?? 0));
          }
        }}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Tab") {
              close(false);
            }
          }}
          className={clsx(
            "absolute top-full z-40 mt-1 min-w-48 rounded-lg border border-line-strong bg-surface-2 p-1",
            "shadow-[0_12px_32px_rgba(0,0,0,.45)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              ref={(el) => {
                itemEls.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className={clsx(
                "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[13px] whitespace-nowrap",
                "transition-colors duration-150 focus:outline-none focus-visible:outline-none",
                "hover:bg-surface-hover focus:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50",
                item.danger ? "text-negative" : "text-fg",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
