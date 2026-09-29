// Daily change rules (Part A, section 6). Pure logic shared by the mock repository and
// the tests. `apply_daily_change` in supabase/migrations implements the same rules in SQL.

import { RepositoryError } from "./errors";
import type {
  ChangeType,
  CollectionField,
  CollectionItem,
  DailyChangeField,
  Uuid,
  VersionContent,
} from "./types";

export type DailyChangeInput =
  | { field: "title" | "description"; value: string | null }
  | { field: "rate"; value: number | null }
  | { field: "skills"; value: string[] }
  | { field: CollectionField; op: "add"; item: CollectionItem; index?: number }
  | { field: CollectionField; op: "update"; item: CollectionItem }
  | { field: CollectionField; op: "remove"; itemId: Uuid }
  | { field: CollectionField; op: "reorder"; ids: Uuid[] };

export type DailyChangeRecord = {
  field: DailyChangeField;
  changeType: ChangeType;
  itemId: Uuid | null;
  oldValue: unknown;
  newValue: unknown;
};

export type DailyChangeResult = {
  content: VersionContent;
  records: DailyChangeRecord[];
};

/** Structural equality for JSON-like values (key order independent). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => jsonEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    // A missing key and an explicit null are the same in stored JSON documents.
    if (!jsonEqual(ao[k] ?? null, bo[k] ?? null)) return false;
  }
  return true;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Applies one daily change to a version's content.
 * Returns null when the change is a no-op (nothing to record).
 * Throws RepositoryError("invalid") for inconsistent input.
 */
export function applyDailyChange(
  content: VersionContent,
  change: DailyChangeInput,
): DailyChangeResult | null {
  const next = clone(content);

  if (change.field === "title" || change.field === "description" || change.field === "rate") {
    const oldValue = content[change.field];
    const newValue = change.value;
    if (oldValue === newValue) return null;
    (next as Record<string, unknown>)[change.field] = newValue;
    return {
      content: next,
      records: [{ field: change.field, changeType: "update", itemId: null, oldValue, newValue }],
    };
  }

  if (change.field === "skills") {
    if (jsonEqual(content.skills, change.value)) return null;
    next.skills = [...change.value];
    return {
      content: next,
      records: [
        {
          field: "skills",
          changeType: "update",
          itemId: null,
          oldValue: [...content.skills],
          newValue: [...change.value],
        },
      ],
    };
  }

  if (!("op" in change)) throw new RepositoryError("invalid", `Unknown field ${change.field}`);
  const field = change.field;
  const list = content[field] as CollectionItem[];
  const indexOf = (id: Uuid) => list.findIndex((item) => item.id === id);

  switch (change.op) {
    case "add": {
      if (indexOf(change.item.id) !== -1) {
        throw new RepositoryError("invalid", `Item ${change.item.id} already exists in ${field}`);
      }
      const items = [...list];
      const at =
        change.index === undefined ? items.length : Math.max(0, Math.min(change.index, items.length));
      items.splice(at, 0, clone(change.item));
      (next as Record<string, unknown>)[field] = items;
      return {
        content: next,
        // A new item has no former value: never invent one.
        records: [{ field, changeType: "add", itemId: change.item.id, oldValue: null, newValue: clone(change.item) }],
      };
    }
    case "update": {
      const at = indexOf(change.item.id);
      if (at === -1) throw new RepositoryError("not_found", `Item ${change.item.id} not in ${field}`);
      const oldItem = list[at];
      if (jsonEqual(oldItem, change.item)) return null;
      const items = [...list];
      items[at] = clone(change.item);
      (next as Record<string, unknown>)[field] = items;
      return {
        content: next,
        records: [{ field, changeType: "update", itemId: oldItem.id, oldValue: clone(oldItem), newValue: clone(change.item) }],
      };
    }
    case "remove": {
      const at = indexOf(change.itemId);
      if (at === -1) throw new RepositoryError("not_found", `Item ${change.itemId} not in ${field}`);
      const oldItem = list[at];
      (next as Record<string, unknown>)[field] = list.filter((item) => item.id !== change.itemId);
      return {
        content: next,
        records: [{ field, changeType: "remove", itemId: oldItem.id, oldValue: clone(oldItem), newValue: null }],
      };
    }
    case "reorder": {
      const oldIds = list.map((item) => item.id);
      const isPermutation =
        change.ids.length === oldIds.length &&
        new Set(change.ids).size === change.ids.length &&
        change.ids.every((id) => oldIds.includes(id));
      if (!isPermutation) throw new RepositoryError("invalid", `Reorder ids do not match ${field}`);
      if (jsonEqual(oldIds, change.ids)) return null;
      const byId = new Map(list.map((item) => [item.id, item]));
      (next as Record<string, unknown>)[field] = change.ids.map((id) => clone(byId.get(id)!));
      return {
        content: next,
        records: [{ field, changeType: "reorder", itemId: null, oldValue: oldIds, newValue: [...change.ids] }],
      };
    }
  }
}
