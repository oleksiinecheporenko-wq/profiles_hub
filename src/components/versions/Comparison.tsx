import type { ReactNode } from "react";
import clsx from "clsx";
import { COLLECTION_META, FIELD_LABELS, itemFieldLabel, itemMetaLine } from "@/lib/domain/collections";
import type { CollectionRow, ComparisonRowData, ItemPair, ScalarRow, SkillsRow } from "@/lib/domain/diff";
import type { CollectionField, CollectionItem } from "@/lib/domain/types";
import { formatRate } from "@/lib/format";

const Muted = ({ children = "—" }: { children?: ReactNode }) => <span className="text-fg-muted">{children}</span>;

/**
 * One field as a single row with both cells, so both sides share height, order and
 * the parent's scroll — the layout invariant from Part B.
 */
export function ComparisonRow({ row, children }: { row: ComparisonRowData; children: ReactNode }) {
  return (
    <section
      aria-label={FIELD_LABELS[row.field]}
      className={clsx(
        "grid grid-cols-[132px_minmax(0,1fr)] gap-x-5 border-b border-l-2 border-b-line py-4 pr-4 pl-3",
        row.changed ? "border-l-accent bg-accent/[.035]" : "border-l-transparent",
      )}
    >
      <div className="flex flex-col items-start gap-1.5 pt-0.5">
        <h3 className="font-mono text-[11px] tracking-wide text-fg-muted uppercase">{FIELD_LABELS[row.field]}</h3>
        {row.changed && (
          <span className="rounded-sm bg-accent-soft px-1.5 font-mono text-[10px] tracking-wide text-accent uppercase">Змінено</span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Two aligned columns; each child pair is one grid row. */
function Cells({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-2">{children}</div>;
}

function ScalarCells({ row }: { row: ScalarRow }) {
  const render = (v: string | number | null) => {
    if (v === null || v === "") return <Muted />;
    if (row.field === "rate") return <span className="font-mono">{formatRate(Number(v))}</span>;
    return <p className="break-words whitespace-pre-wrap">{String(v)}</p>;
  };
  return (
    <Cells>
      <div className="min-w-0 text-sm text-fg-2">{render(row.left)}</div>
      <div className={clsx("min-w-0 text-sm", row.changed ? "text-fg" : "text-fg-2")}>{render(row.right)}</div>
    </Cells>
  );
}

function Tag({ tone, children }: { tone?: "added" | "removed"; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center gap-1 rounded-[5px] border px-2 text-[13px]",
        tone === "added" && "border-positive/35 bg-positive/[.07] text-fg",
        tone === "removed" && "border-negative/35 bg-negative/[.07] text-fg-2 line-through decoration-negative/60",
        !tone && "border-line-strong bg-surface-2 text-fg-2",
      )}
    >
      {tone === "added" && (
        <>
          <span aria-hidden className="font-mono text-positive">+</span>
          <span className="sr-only">Додано:</span>
        </>
      )}
      {tone === "removed" && (
        <>
          <span aria-hidden className="font-mono text-negative no-underline">−</span>
          <span className="sr-only">Прибрано:</span>
        </>
      )}
      {children}
    </span>
  );
}

function SkillsCells({ row }: { row: SkillsRow }) {
  const removed = new Set(row.removed);
  const added = new Set(row.added);
  return (
    <Cells>
      <div className="flex min-w-0 flex-wrap content-start gap-1.5">
        {row.left.length === 0 ? <Muted /> : row.left.map((s) => <Tag key={s} tone={removed.has(s) ? "removed" : undefined}>{s}</Tag>)}
      </div>
      <div className="flex min-w-0 flex-wrap content-start gap-1.5">
        {row.right.length === 0 ? <Muted /> : row.right.map((s) => <Tag key={s} tone={added.has(s) ? "added" : undefined}>{s}</Tag>)}
      </div>
      {row.reordered && (
        <p className="col-span-2 text-xs text-fg-muted">Порядок навичок змінено.</p>
      )}
    </Cells>
  );
}

function ItemCell({
  field,
  item,
  side,
  pair,
}: {
  field: CollectionField;
  item: CollectionItem | null;
  side: "left" | "right";
  pair: ItemPair;
}) {
  if (!item) {
    return (
      <div className="flex min-h-12 items-center rounded-md border border-dashed border-line px-3 text-[13px] text-fg-muted">
        {side === "left" ? "Немає в цій версії" : "Прибрано в цій версії"}
      </div>
    );
  }
  const meta = COLLECTION_META[field];
  const line = itemMetaLine(field, item);
  const description = (item as { description?: string | null }).description;
  const changedKeys = new Set(pair.changedKeys);
  const tone =
    pair.status === "added" ? "border-positive/40" : pair.status === "removed" ? "border-negative/40" : pair.status === "changed" ? "border-accent/50" : "border-line";
  const mark = (key: string) => changedKeys.has(key) && "rounded-sm bg-accent/[.10] px-0.5 -mx-0.5";

  return (
    <div className={clsx("min-w-0 rounded-md border bg-surface-1 p-3 text-sm", tone)}>
      <p className={clsx("font-medium text-fg", mark(field === "employment_history" ? "company" : "title"))}>{meta.summary(item)}</p>
      {line && <p className="mt-0.5 font-mono text-xs text-fg-muted">{line}</p>}
      {description && <p className={clsx("mt-1 break-words whitespace-pre-wrap text-fg-2", mark("description"))}>{description}</p>}
      {pair.status === "changed" && side === "right" && (
        <p className="mt-2 font-mono text-[10px] tracking-wide text-accent uppercase">
          змінено: {pair.changedKeys.map((k) => itemFieldLabel(field, k)).join(", ")}
        </p>
      )}
      {pair.status === "added" && side === "right" && (
        <p className="mt-2 font-mono text-[10px] tracking-wide text-positive uppercase">додано</p>
      )}
      {pair.status === "removed" && side === "left" && (
        <p className="mt-2 font-mono text-[10px] tracking-wide text-negative uppercase">прибрано далі</p>
      )}
    </div>
  );
}

function CollectionCells({ row }: { row: CollectionRow }) {
  if (row.pairs.length === 0) {
    return (
      <Cells>
        <Muted />
        <Muted />
      </Cells>
    );
  }
  return (
    <Cells>
      {row.pairs.map((pair) => (
        <div key={pair.key} className="contents">
          <ItemCell field={row.field} item={pair.left} side="left" pair={pair} />
          <ItemCell field={row.field} item={pair.right} side="right" pair={pair} />
        </div>
      ))}
      {row.reordered && <p className="col-span-2 text-xs text-fg-muted">Порядок елементів змінено.</p>}
    </Cells>
  );
}

export function ComparisonRows({ rows }: { rows: ComparisonRowData[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line border-b-0 bg-surface-1/30">
      {rows.map((row) => (
        <ComparisonRow key={row.field} row={row}>
          {row.kind === "scalar" ? (
            <ScalarCells row={row} />
          ) : row.kind === "skills" ? (
            <SkillsCells row={row} />
          ) : (
            <CollectionCells row={row} />
          )}
        </ComparisonRow>
      ))}
    </div>
  );
}
