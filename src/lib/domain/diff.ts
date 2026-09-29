// Version comparison (Part B, `Порівняння`). Pure: the UI only renders the result.
// Collection items are matched by stable id; items without an id match fall back to
// matching by their normalized summary (title/company), one-to-one.

import { COLLECTION_META } from "./collections";
import { jsonEqual } from "./dailyChanges";
import type { CollectionField, CollectionItem, VersionContent } from "./types";

export const COMPARISON_ORDER = [
  "title",
  "rate",
  "description",
  "portfolio",
  "skills",
  "project_catalog",
  "certifications",
  "employment_history",
  "other_experiences",
  "additional_info",
] as const;
export type ComparisonField = (typeof COMPARISON_ORDER)[number];

export type ScalarRow = {
  kind: "scalar";
  field: "title" | "rate" | "description" | "additional_info";
  left: string | number | null;
  right: string | number | null;
  changed: boolean;
};

export type SkillsRow = {
  kind: "skills";
  field: "skills";
  left: string[];
  right: string[];
  /** In right, not in left. */
  added: string[];
  /** In left, not in right. */
  removed: string[];
  reordered: boolean;
  changed: boolean;
};

export type ItemPair = {
  key: string;
  left: CollectionItem | null;
  right: CollectionItem | null;
  status: "same" | "changed" | "added" | "removed";
  /** Item fields that differ (for `changed`). */
  changedKeys: string[];
  /** Matched by content instead of id. */
  matchedByContent: boolean;
};

export type CollectionRow = {
  kind: "collection";
  field: CollectionField;
  pairs: ItemPair[];
  /** Matched items appear in a different relative order. */
  reordered: boolean;
  changed: boolean;
};

export type ComparisonRowData = ScalarRow | SkillsRow | CollectionRow;

const normText = (v: string | null | undefined) => {
  const t = (v ?? "").replace(/\r\n/g, "\n").trim();
  return t === "" ? null : t;
};

const normValue = (v: unknown): unknown => {
  if (typeof v === "string") return normText(v);
  return v ?? null;
};

function itemChangedKeys(field: CollectionField, a: CollectionItem, b: CollectionItem): string[] {
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  return COLLECTION_META[field].fields
    .map((f) => f.key)
    .filter((k) => !jsonEqual(normValue(ao[k]), normValue(bo[k])));
}

const summaryKey = (field: CollectionField, item: CollectionItem) =>
  COLLECTION_META[field].summary(item).trim().replace(/\s+/g, " ").toLocaleLowerCase("uk");

export function compareCollection(field: CollectionField, left: CollectionItem[], right: CollectionItem[]): CollectionRow {
  const leftById = new Map(left.map((i) => [i.id, i]));
  const matchedLeft = new Map<string, CollectionItem>(); // right id -> left item
  const byContent = new Set<string>();
  const usedLeft = new Set<string>();

  for (const r of right) {
    const l = leftById.get(r.id);
    if (l) {
      matchedLeft.set(r.id, l);
      usedLeft.add(l.id);
    }
  }
  // Fallback: unmatched items with the same normalized summary, first come first served.
  for (const r of right) {
    if (matchedLeft.has(r.id)) continue;
    const key = summaryKey(field, r);
    const l = left.find((x) => !usedLeft.has(x.id) && summaryKey(field, x) === key);
    if (l) {
      matchedLeft.set(r.id, l);
      usedLeft.add(l.id);
      byContent.add(r.id);
    }
  }

  // Right order drives the rows; removed items are placed where they were on the left.
  const pairs: ItemPair[] = [];
  const removedByAnchor = new Map<string | null, CollectionItem[]>();
  let anchor: string | null = null;
  for (const l of left) {
    if (usedLeft.has(l.id)) {
      anchor = l.id;
      continue;
    }
    const list = removedByAnchor.get(anchor) ?? [];
    list.push(l);
    removedByAnchor.set(anchor, list);
  }
  const pushRemoved = (key: string | null) => {
    for (const l of removedByAnchor.get(key) ?? []) {
      pairs.push({ key: `l:${l.id}`, left: l, right: null, status: "removed", changedKeys: [], matchedByContent: false });
    }
  };
  pushRemoved(null);
  for (const r of right) {
    const l = matchedLeft.get(r.id) ?? null;
    if (!l) {
      pairs.push({ key: `r:${r.id}`, left: null, right: r, status: "added", changedKeys: [], matchedByContent: false });
      continue;
    }
    const keys = itemChangedKeys(field, l, r);
    pairs.push({
      key: `m:${r.id}`,
      left: l,
      right: r,
      status: keys.length > 0 ? "changed" : "same",
      changedKeys: keys,
      matchedByContent: byContent.has(r.id),
    });
    pushRemoved(l.id);
  }

  const leftOrder = left.filter((l) => usedLeft.has(l.id)).map((l) => l.id);
  const rightOrder = right.filter((r) => matchedLeft.has(r.id)).map((r) => matchedLeft.get(r.id)!.id);
  const reordered = !jsonEqual(leftOrder, rightOrder);

  return {
    kind: "collection",
    field,
    pairs,
    reordered,
    changed: reordered || pairs.some((p) => p.status !== "same"),
  };
}

export function compareSkills(left: string[], right: string[]): SkillsRow {
  const norm = (s: string) => s.trim().toLocaleLowerCase("uk");
  const l = new Set(left.map(norm));
  const r = new Set(right.map(norm));
  const added = right.filter((s) => !l.has(norm(s)));
  const removed = left.filter((s) => !r.has(norm(s)));
  const commonLeft = left.filter((s) => r.has(norm(s))).map(norm);
  const commonRight = right.filter((s) => l.has(norm(s))).map(norm);
  const reordered = !jsonEqual(commonLeft, commonRight);
  return {
    kind: "skills",
    field: "skills",
    left,
    right,
    added,
    removed,
    reordered,
    changed: added.length > 0 || removed.length > 0 || reordered,
  };
}

function compareScalar(field: ScalarRow["field"], left: VersionContent, right: VersionContent): ScalarRow {
  const l = left[field];
  const r = right[field];
  const changed =
    field === "rate"
      ? (l === null ? null : Number(l)) !== (r === null ? null : Number(r))
      : normText(l as string | null) !== normText(r as string | null);
  return { kind: "scalar", field, left: l, right: r, changed };
}

/** All rows in the comparison order, each with its changed flag. */
export function compareVersions(left: VersionContent, right: VersionContent): ComparisonRowData[] {
  return COMPARISON_ORDER.map((field) => {
    if (field === "skills") return compareSkills(left.skills, right.skills);
    if (field === "title" || field === "rate" || field === "description" || field === "additional_info") {
      return compareScalar(field, left, right);
    }
    return compareCollection(field, left[field], right[field]);
  });
}

/**
 * `Тільки відмінності`: drops equal rows and, inside collections, unchanged items
 * (unless the collection's order changed — then the full list shows the new order).
 */
export function onlyDifferences(rows: ComparisonRowData[]): ComparisonRowData[] {
  return rows
    .filter((row) => row.changed)
    .map((row) =>
      row.kind === "collection" && !row.reordered
        ? { ...row, pairs: row.pairs.filter((p) => p.status !== "same") }
        : row,
    );
}

