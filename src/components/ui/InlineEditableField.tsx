"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { FieldLabel, type FieldIconKey } from "./FieldLabel";
import { controlClassName } from "./Input";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";
import { TagInput } from "./TagInput";

/** Returns an error message to keep the field in edit mode, or null on success. */
export type SaveHandler<T> = (value: T) => Promise<string | null>;

type Base = {
  label: string;
  /** Small marker next to the label, e.g. `з Актуальної версії`. */
  badge?: ReactNode;
  emptyText?: string;
  disabled?: boolean;
  /** Thematic icon: renders the label bold, as in version field groups. */
  icon?: FieldIconKey;
  /** Client-side check before saving; return an error message to block. */
  validate?: (value: never) => string | null;
};

type TextField = Base & {
  kind: "text" | "textarea";
  value: string | null;
  onSave: SaveHandler<string | null>;
  inputType?: "text" | "email" | "tel" | "url";
  maxLength?: number;
  /** Shows `X / max` under the control. */
  counter?: number;
  validate?: (value: string | null) => string | null;
};

type NumberField = Base & {
  kind: "number";
  value: number | null;
  onSave: SaveHandler<number | null>;
  format?: (value: number) => string;
  prefix?: string;
  suffix?: string;
  step?: number;
  validate?: (value: number | null) => string | null;
};

type SelectField = Base & {
  kind: "select" | "searchable";
  value: string | null;
  options: SelectOption[];
  onSave: SaveHandler<string | null>;
  validate?: (value: string | null) => string | null;
};

type TagsField = Base & {
  kind: "tags";
  value: string[];
  onSave: SaveHandler<string[]>;
  max?: number;
  /** Previously saved values offered while typing. */
  suggestions?: string[];
  validate?: (value: string[]) => string | null;
};

export type InlineEditableFieldProps = TextField | NumberField | SelectField | TagsField;

type Draft = string | string[];

function toDraft(p: InlineEditableFieldProps): Draft {
  switch (p.kind) {
    case "tags":
      return [...p.value];
    case "number":
      return p.value === null ? "" : String(p.value);
    default:
      return p.value ?? "";
  }
}

function fromDraft(p: InlineEditableFieldProps, draft: Draft): { value: unknown; error: string | null } {
  if (p.kind === "tags") return { value: draft as string[], error: null };
  const text = draft as string;
  if (p.kind === "number") {
    if (text.trim() === "") return { value: null, error: null };
    const n = Number(text.replace(",", "."));
    return Number.isFinite(n) ? { value: n, error: null } : { value: null, error: "Вкажіть число." };
  }
  if (p.kind === "textarea") return { value: text.trim() === "" ? null : text, error: null };
  return { value: text.trim() === "" ? null : text.trim(), error: null };
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * View state: label, value and a subtle pencil. Edit state: matching control with
 * save/cancel. Enter saves single-line edits, Escape cancels; in a textarea Enter is
 * a newline and Ctrl/Cmd+Enter saves. The previous value stays on cancel or failure.
 */
export function InlineEditableField(props: InlineEditableFieldProps) {
  const { label, badge, emptyText = "—", disabled, icon } = props;
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(props));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pencil = useRef<HTMLButtonElement>(null);

  const start = () => {
    if (disabled) return;
    setDraft(toDraft(props));
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    if (saving) return;
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => pencil.current?.focus());
  };

  const save = async () => {
    if (saving) return;
    const parsed = fromDraft(props, draft);
    if (parsed.error) return setError(parsed.error);
    if (sameValue(parsed.value, props.value)) return cancel();
    const clientError = props.validate?.(parsed.value as never) ?? null;
    if (clientError) return setError(clientError);
    setSaving(true);
    const serverError = await (props.onSave as SaveHandler<unknown>)(parsed.value);
    setSaving(false);
    if (serverError) {
      setError(serverError);
      return;
    }
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => pencil.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === "Enter") {
      const multiline = props.kind === "textarea";
      if (!multiline || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        void save();
      }
    }
  };

  const errorId = `${id}-error`;
  const aria = {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? errorId : undefined,
  };

  return (
    <div className="group grid grid-cols-[var(--label-w,152px)_minmax(0,1fr)] gap-x-4 border-b border-line py-3 last:border-b-0">
      <div className="pt-[3px]">
        {icon ? (
          <FieldLabel as="label" htmlFor={editing ? id : undefined} icon={icon}>
            {label}
          </FieldLabel>
        ) : (
          <label htmlFor={editing ? id : undefined} className="text-[13px] text-fg-muted">
            {label}
          </label>
        )}
        {badge && <div className="mt-0.5">{badge}</div>}
      </div>

      {!editing ? (
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 pt-[2px] text-sm">{renderValue(props, emptyText)}</div>
          {!disabled && (
            <button
              ref={pencil}
              type="button"
              onClick={start}
              aria-label={`Редагувати: ${label}`}
              title="Редагувати"
              className={clsx(
                "-mt-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted",
                "opacity-40 transition duration-150 group-hover:opacity-100 hover:bg-surface-hover hover:text-fg focus-visible:opacity-100",
              )}
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <div className="min-w-0">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1"><FieldControl p={props} draft={draft} setDraft={setDraft} aria={aria} onKeyDown={onKeyDown} /></div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              aria-label="Зберегти"
              title="Зберегти (Enter)"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md bg-accent text-[#1a0d08] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              aria-label="Скасувати"
              title="Скасувати (Esc)"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line-strong text-fg-2 transition-colors hover:bg-surface-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-1 flex justify-between gap-3 text-xs">
            <span id={errorId} className="text-negative" role={error ? "alert" : undefined}>
              {error}
            </span>
            {props.kind === "textarea" && props.counter !== undefined && (
              <span
                className={clsx(
                  "font-mono",
                  (draft as string).length > props.counter ? "text-negative" : "text-fg-muted",
                )}
              >
                {(draft as string).length} / {props.counter}
              </span>
            )}
            {props.kind === "textarea" && props.counter === undefined && (
              <span className="text-fg-muted">Ctrl+Enter — зберегти</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderValue(p: InlineEditableFieldProps, emptyText: string): ReactNode {
  const empty = <span className="text-fg-muted">{emptyText}</span>;
  switch (p.kind) {
    case "tags":
      return p.value.length === 0 ? (
        empty
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {p.value.map((t) => (
            <span key={t} className="inline-flex h-6 items-center rounded-[5px] border border-line-strong bg-surface-2 px-2 text-[13px]">
              {t}
            </span>
          ))}
        </div>
      );
    case "number":
      return p.value === null ? empty : <span className="font-mono">{p.format ? p.format(p.value) : p.value}</span>;
    case "select":
    case "searchable":
      return p.value === null ? empty : (p.options.find((o) => o.value === p.value)?.label ?? p.value);
    case "textarea":
      return p.value === null ? (
        empty
      ) : (
        <p className="break-words whitespace-pre-wrap text-fg">{p.value}</p>
      );
    default:
      return p.value === null ? empty : <span className="break-words">{p.value}</span>;
  }
}

function FieldControl({
  p,
  draft,
  setDraft,
  aria,
  onKeyDown,
}: {
  p: InlineEditableFieldProps;
  draft: Draft;
  setDraft: (d: Draft) => void;
  aria: { id: string; "aria-invalid"?: true; "aria-describedby"?: string };
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  switch (p.kind) {
    case "textarea":
      return (
        <textarea
          {...aria}
          autoFocus
          value={draft as string}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={Math.min(14, Math.max(4, (draft as string).split("\n").length + 1))}
          className={clsx(controlClassName, "resize-y py-2 leading-relaxed")}
        />
      );
    case "number":
      return (
        <div className="relative">
          {p.prefix && (
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-fg-muted">
              {p.prefix}
            </span>
          )}
          <input
            {...aria}
            autoFocus
            inputMode="decimal"
            value={draft as string}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            className={clsx(controlClassName, "h-10 font-mono", p.prefix && "pl-7", p.suffix && "pr-14")}
          />
          {p.suffix && (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-fg-muted">
              {p.suffix}
            </span>
          )}
        </div>
      );
    case "select":
      return (
        <select
          {...aria}
          autoFocus
          value={draft as string}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={clsx(controlClassName, "h-10 cursor-pointer")}
        >
          <option value="">— не вказано —</option>
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "searchable":
      return (
        <SearchableSelect
          {...aria}
          autoFocus
          value={(draft as string) || null}
          onChange={(v) => setDraft(v ?? "")}
          options={p.options}
          onKeyDown={onKeyDown}
        />
      );
    case "tags":
      return (
        <TagInput
          {...aria}
          autoFocus
          value={draft as string[]}
          onChange={setDraft}
          max={p.max}
          suggestions={p.suggestions}
          onKeyDown={onKeyDown}
        />
      );
    default:
      return (
        <input
          {...aria}
          autoFocus
          type={p.inputType ?? "text"}
          maxLength={p.maxLength}
          value={draft as string}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={clsx(controlClassName, "h-10")}
        />
      );
  }
}
