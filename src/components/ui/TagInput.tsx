"use client";

import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { normalizeTag } from "@/lib/validation/common";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Maximum number of tags; shows a `12 / 20` counter. */
  max?: number;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  autoFocus?: boolean;
  /** Called for Enter on an empty input (e.g. to save an inline edit) and Escape. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

/** Enter or comma creates a tag; duplicates (after trimming and case folding) are refused. */
export function TagInput({ value, onChange, max, placeholder = "Додайте й натисніть Enter", id, autoFocus, onKeyDown, ...aria }: Props) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const full = max !== undefined && value.length >= max;

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

  return (
    <div>
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
          placeholder={full ? `Максимум ${max}` : placeholder}
          onChange={(e) => {
            const next = e.target.value;
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
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              e.stopPropagation();
              if (add(draft)) setDraft("");
              return;
            }
            if (e.key === "Backspace" && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
              return;
            }
            onKeyDown?.(e);
          }}
          onBlur={() => {
            if (draft.trim() && add(draft)) setDraft("");
          }}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed"
          {...aria}
        />
      </div>
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
