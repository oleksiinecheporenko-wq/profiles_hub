"use client";

import { useId, useMemo, useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { suggestTags } from "@/lib/domain/suggest";
import { normalizeTag } from "@/lib/validation/common";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Maximum number of tags; shows a `12 / 20` counter. */
  max?: number;
  /** Previously saved values offered while typing (e.g. the skill catalog). */
  suggestions?: string[];
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  autoFocus?: boolean;
  /** Called for Enter on an empty input (e.g. to save an inline edit) and Escape. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * Enter or comma creates a tag; duplicates (after trimming and case folding) are refused.
 * With `suggestions`, matching saved values drop down while typing: arrows move,
 * Enter or click picks one, Escape closes the list.
 */
export function TagInput({
  value,
  onChange,
  max,
  suggestions = [],
  placeholder = "Додайте й натисніть Enter",
  id,
  autoFocus,
  onKeyDown,
  ...aria
}: Props) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const full = max !== undefined && value.length >= max;

  const matches = useMemo(() => suggestTags(suggestions, value, draft), [suggestions, value, draft]);
  const showList = open && !full && matches.length > 0;

  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) return false;
    if (full) {
      setNotice(`Не більше ${max}.`);
      return false;
    }
    if (value.some((t) => normalizeTag(t) === normalizeTag(tag))) {
      setNotice(`«${tag}» уже додано.`);
      return false;
    }
    if (tag.length > 80) {
      setNotice("Тег до 80 символів.");
      return false;
    }
    onChange([...value, tag]);
    setNotice(null);
    return true;
  };

  const pick = (tag: string) => {
    if (add(tag)) setDraft("");
    setActive(-1);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div
        className={clsx(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface-1 px-2 py-1.5",
          "transition-colors duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25",
          aria["aria-invalid"] && "border-negative",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-line-strong bg-surface-2 pr-1 pl-2 text-[13px] text-fg"
          >
            {tag}
            <button
              type="button"
              aria-label={`Видалити «${tag}»`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="flex size-5 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          autoFocus={autoFocus}
          disabled={full}
          autoComplete="off"
          role={suggestions.length ? "combobox" : undefined}
          aria-expanded={suggestions.length ? showList : undefined}
          aria-controls={suggestions.length ? listId : undefined}
          aria-autocomplete={suggestions.length ? "list" : undefined}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={full ? `Максимум ${max}` : placeholder}
          onChange={(e) => {
            const next = e.target.value;
            setOpen(true);
            setActive(-1);
            if (next.includes(",")) {
              const parts = next.split(",");
              const rest = parts.pop() ?? "";
              parts.forEach(add);
              setDraft(rest);
            } else {
              setDraft(next);
            }
          }}
          onKeyDown={(e) => {
            if (showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              const delta = e.key === "ArrowDown" ? 1 : -1;
              setActive((i) => (i + delta + matches.length) % matches.length);
              return;
            }
            if (showList && e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setActive(-1);
              return;
            }
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              e.stopPropagation();
              pick(showList && active >= 0 ? matches[active] : draft);
              return;
            }
            if (e.key === "Backspace" && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
              return;
            }
            onKeyDown?.(e);
          }}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            if (draft.trim() && add(draft)) setDraft("");
          }}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed"
          {...aria}
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Раніше внесені"
          className="absolute top-full left-0 z-40 mt-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-lg border border-line-strong bg-surface-2 p-1 shadow-[0_12px_32px_rgba(0,0,0,.45)]"
        >
          <li role="presentation" className="px-2.5 pt-1 pb-1.5 text-[11px] text-fg-muted">
            Раніше внесені
          </li>
          {matches.map((s, i) => (
            <li
              key={s}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so blur doesn't add the half-typed draft.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
              className={clsx(
                "flex h-8 cursor-pointer items-center rounded-md px-2.5 text-[13px]",
                i === active ? "bg-surface-hover text-fg" : "text-fg-2",
              )}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 flex justify-between gap-3 text-xs">
        <span className="text-warning" role="status">
          {notice}
        </span>
        {max !== undefined && (
          <span className={clsx("font-mono", full ? "text-warning" : "text-fg-muted")}>
            {value.length} / {max}
          </span>
        )}
      </div>
    </div>
  );
}
