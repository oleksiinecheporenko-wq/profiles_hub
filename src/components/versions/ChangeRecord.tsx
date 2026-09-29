"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { COLLECTION_META, FIELD_LABELS, itemFieldLabel } from "@/lib/domain/collections";
import { jsonEqual } from "@/lib/domain/dailyChanges";
import { COLLECTION_FIELDS, type CollectionField, type CollectionItem, type DailyChange } from "@/lib/domain/types";
import { formatDate, formatPlainDate, formatPrice, formatRate, formatTime } from "@/lib/format";

const CHANGE_LABELS: Record<DailyChange["changeType"], string> = {
  update: "змінено",
  add: "додано",
  remove: "видалено",
  reorder: "змінено порядок",
};

const isCollection = (field: string): field is CollectionField =>
  (COLLECTION_FIELDS as readonly string[]).includes(field);

/** Long text: at most two lines with `Показати повністю`. */
function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 160 || text.split("\n").length > 2;
  return (
    <span className="min-w-0">
      <span className={clsx("block break-words whitespace-pre-wrap", !open && long && "line-clamp-2")}>{text}</span>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 cursor-pointer text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline"
        >
          {open ? "Згорнути" : "Показати повністю"}
        </button>
      )}
    </span>
  );
}

function DiffLine({ sign, children }: { sign: "−" | "+"; children: ReactNode }) {
  const removed = sign === "−";
  return (
    <div
      className={clsx(
        "flex gap-2 rounded-md px-2 py-1 text-[13px]",
        removed ? "bg-negative/[.06] text-fg-2" : "bg-positive/[.06] text-fg",
      )}
    >
      <span aria-hidden className={clsx("font-mono select-none", removed ? "text-negative" : "text-positive")}>
        {sign}
      </span>
      <span className="sr-only">{removed ? "Було:" : "Стало:"}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function scalarText(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (field === "rate") return formatRate(Number(value));
  return String(value);
}

function itemValueText(field: CollectionField, key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const kind = COLLECTION_META[field].fields.find((f) => f.key === key)?.kind;
  if (kind === "money") return formatPrice(Number(value));
  if (kind === "date") return formatPlainDate(String(value));
  if (kind === "image") return "зображення";
  return String(value);
}

const Empty = () => <span className="text-fg-muted italic">порожньо</span>;

function ScalarDiff({ field, oldValue, newValue }: { field: string; oldValue: unknown; newValue: unknown }) {
  const o = scalarText(field, oldValue);
  const n = scalarText(field, newValue);
  return (
    <div className="flex flex-col gap-1">
      <DiffLine sign="−">{o === null ? <Empty /> : <ClampedText text={o} />}</DiffLine>
      <DiffLine sign="+">{n === null ? <Empty /> : <ClampedText text={n} />}</DiffLine>
    </div>
  );
}

function SkillsDiff({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const before = Array.isArray(oldValue) ? (oldValue as string[]) : [];
  const after = Array.isArray(newValue) ? (newValue as string[]) : [];
  const added = after.filter((s) => !before.includes(s));
  const removed = before.filter((s) => !after.includes(s));
  const reordered = added.length === 0 && removed.length === 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      {removed.map((s) => (
        <span key={`-${s}`} className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-negative/30 bg-negative/[.06] px-2 text-[13px] text-fg-2 line-through decoration-negative/60">
          <span aria-hidden className="font-mono text-negative no-underline">−</span>
          <span className="sr-only">Видалено:</span>
          {s}
        </span>
      ))}
      {added.map((s) => (
        <span key={`+${s}`} className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-positive/30 bg-positive/[.06] px-2 text-[13px] text-fg">
          <span aria-hidden className="font-mono text-positive">+</span>
          <span className="sr-only">Додано:</span>
          {s}
        </span>
      ))}
      {reordered && <span className="text-[13px] text-fg-muted">Змінено порядок навичок</span>}
    </div>
  );
}

function ItemDiff({ field, oldItem, newItem }: { field: CollectionField; oldItem: CollectionItem; newItem: CollectionItem }) {
  const o = oldItem as Record<string, unknown>;
  const n = newItem as Record<string, unknown>;
  const keys = COLLECTION_META[field].fields.map((f) => f.key).filter((k) => !jsonEqual(o[k] ?? null, n[k] ?? null));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-fg">{COLLECTION_META[field].summary(newItem)}</p>
      {keys.map((k) => {
        const before = itemValueText(field, k, o[k]);
        const after = itemValueText(field, k, n[k]);
        return (
          <div key={k} className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-fg-muted uppercase">{itemFieldLabel(field, k)}</span>
            <DiffLine sign="−">{before === null ? <Empty /> : <ClampedText text={before} />}</DiffLine>
            <DiffLine sign="+">{after === null ? <Empty /> : <ClampedText text={after} />}</DiffLine>
          </div>
        );
      })}
    </div>
  );
}

function ItemSummary({ field, item }: { field: CollectionField; item: CollectionItem }) {
  const meta = COLLECTION_META[field];
  const description = (item as { description?: string | null }).description;
  return (
    <div>
      <p className="font-medium">{meta.summary(item)}</p>
      {description && (
        <div className="text-fg-2">
          <ClampedText text={description} />
        </div>
      )}
    </div>
  );
}

function ReorderDiff({
  oldValue,
  newValue,
  itemTitles,
}: {
  oldValue: unknown;
  newValue: unknown;
  itemTitles: Record<string, string>;
}) {
  const name = (id: string) => itemTitles[id] ?? "елемент";
  const render = (ids: unknown) => (Array.isArray(ids) ? (ids as string[]).map(name).join(" → ") : "");
  return (
    <div className="flex flex-col gap-1">
      <DiffLine sign="−">{render(oldValue)}</DiffLine>
      <DiffLine sign="+">{render(newValue)}</DiffLine>
    </div>
  );
}

/** One daily change: date, time, field, and a `було → стало` diff. */
export function ChangeRecord({
  change,
  itemTitles = {},
}: {
  change: DailyChange;
  /** Collection item titles by id, to name items in reorder records. */
  itemTitles?: Record<string, string>;
}) {
  const { field, changeType, oldValue, newValue } = change;

  let body: ReactNode;
  if (field === "skills") body = <SkillsDiff oldValue={oldValue} newValue={newValue} />;
  else if (!isCollection(field)) body = <ScalarDiff field={field} oldValue={oldValue} newValue={newValue} />;
  else if (changeType === "add")
    body = (
      <DiffLine sign="+">
        <ItemSummary field={field} item={newValue as CollectionItem} />
      </DiffLine>
    );
  else if (changeType === "remove")
    body = (
      <DiffLine sign="−">
        <ItemSummary field={field} item={oldValue as CollectionItem} />
      </DiffLine>
    );
  else if (changeType === "reorder") body = <ReorderDiff oldValue={oldValue} newValue={newValue} itemTitles={itemTitles} />;
  else body = <ItemDiff field={field} oldItem={oldValue as CollectionItem} newItem={newValue as CollectionItem} />;

  return (
    <article className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
      <header className="flex items-baseline justify-between gap-3">
        <p className="text-[13px]">
          <span className="font-medium text-fg">{FIELD_LABELS[field]}</span>{" "}
          <span className="text-fg-muted">· {CHANGE_LABELS[changeType]}</span>
        </p>
        <time dateTime={change.changedAt} className="shrink-0 font-mono text-xs text-fg-muted">
          {formatDate(change.changedAt)} {formatTime(change.changedAt)}
        </time>
      </header>
      {body}
    </article>
  );
}
