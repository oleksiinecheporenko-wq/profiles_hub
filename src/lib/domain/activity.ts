// Activity feed rendering (Part A, section 7 `03 · Дії`): action groups, one-line
// summaries and the `було → стало` list. Pure, so the server renders it and tests run.

import { formatPlainDate, formatPrice, formatRate } from "@/lib/format";
import { COLLECTION_META, FIELD_LABELS } from "./collections";
import { compareCollection, compareSkills } from "./diff";
import {
  BILLING_METHOD_LABELS,
  CONTRACT_STATUS_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  PROFILE_STATUS_LABELS,
  PROFILE_VISIBILITY_LABELS,
  type BillingMethod,
  type ContractStatus,
  type ExperienceLevel,
  type ProfileStatus,
  type ProfileVisibility,
} from "./enums";
import {
  COLLECTION_FIELDS,
  type ActivityEntry,
  type ActivityRow,
  type CollectionField,
  type CollectionItem,
  type FieldChange,
} from "./types";

export const ACTION_GROUPS = {
  profile: { label: "Профіль", actions: ["profile.created", "profile.deleted"] },
  status: { label: "Статус", actions: ["profile.status_changed"] },
  main: { label: "Основна інформація", actions: ["profile.updated", "profile.languages_updated"] },
  updates: { label: "Оновлення", actions: ["version.created", "version.edited", "version.daily_change", "version.deleted"] },
  contracts: {
    label: "Контракти",
    actions: [
      "contract.created",
      "contract.edited",
      "contract.closed",
      "contract.reopened",
      "contract.deleted",
      "contract.comment_added",
    ],
  },
} as const;
export type ActionGroup = keyof typeof ACTION_GROUPS;
export const ACTION_GROUP_KEYS = Object.keys(ACTION_GROUPS) as ActionGroup[];

export function actionGroup(action: string): ActionGroup | null {
  for (const key of ACTION_GROUP_KEYS) {
    if ((ACTION_GROUPS[key].actions as readonly string[]).includes(action)) return key;
  }
  return null;
}

// ---- field labels & value text ---------------------------------------------

const PROFILE_COLUMN_LABELS: Record<string, string> = {
  full_name: "ПІБ",
  photo_path: "Фото",
  profile_url: "Посилання на профіль",
  status: "Статус",
  visibility: "Visibility",
  experience_level: "Experience level",
  billing_method: "Billing method",
  education: "Education",
  categories: "Categories",
  email: "Email",
  time_zone: "Time Zone",
  address: "Address",
  phone: "Phone",
};

const CONTRACT_COLUMN_LABELS: Record<string, string> = {
  profile_id: "Профіль",
  created_date: "Дата створення",
  title: "Тайтл",
  rate: "Рейт",
  description: "Опис",
  dialog: "Діалог",
  status: "Статус",
};

/** Columns that are bookkeeping, never shown as a user change. */
const HIDDEN_COLUMNS = new Set(["updated_at", "status_changed_at", "closed_at", "deleted_at", "is_current", "id", "created_at"]);

const VERSION_COLUMN_LABELS: Record<string, string> = { ...FIELD_LABELS };

function columnLabel(entity: ActivityRow["entityType"], column: string): string {
  if (entity === "profile") return PROFILE_COLUMN_LABELS[column] ?? column;
  if (entity === "contract") return CONTRACT_COLUMN_LABELS[column] ?? column;
  if (entity === "version") return VERSION_COLUMN_LABELS[column] ?? column;
  return column;
}

const MAX_TEXT = 400;
const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s);

function valueText(entity: ActivityRow["entityType"], column: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (column === "rate") return entity === "contract" ? `$${Number(value)}` : formatRate(Number(value));
  if (column === "status") {
    return entity === "contract"
      ? (CONTRACT_STATUS_LABELS[value as ContractStatus] ?? String(value))
      : (PROFILE_STATUS_LABELS[value as ProfileStatus] ?? String(value));
  }
  if (column === "visibility") return PROFILE_VISIBILITY_LABELS[value as ProfileVisibility] ?? String(value);
  if (column === "experience_level") return EXPERIENCE_LEVEL_LABELS[value as ExperienceLevel] ?? String(value);
  if (column === "billing_method") return BILLING_METHOD_LABELS[value as BillingMethod] ?? String(value);
  if (column === "update_date" || column === "created_date") return formatPlainDate(String(value));
  if (column === "photo_path") return "зображення";
  if (Array.isArray(value)) {
    if ((COLLECTION_FIELDS as readonly string[]).includes(column)) {
      const meta = COLLECTION_META[column as CollectionField];
      return value.length === 0 ? null : (value as CollectionItem[]).map((i) => meta.summary(i)).join("; ");
    }
    return value.length === 0 ? null : value.join(", ");
  }
  if (typeof value === "object") return null;
  return clip(String(value));
}

export type ChangeLine = { label: string; old: string | null; new: string | null };

function changesOf(row: ActivityRow): Record<string, FieldChange> {
  return row.details.changes ?? {};
}

/** `було → стало` lines of an entry (only rows with UPDATE changes). */
export function entryChanges(entry: ActivityEntry): ChangeLine[] {
  const lines: ChangeLine[] = [];
  for (const row of entry.rows) {
    for (const [column, change] of Object.entries(changesOf(row))) {
      if (HIDDEN_COLUMNS.has(column)) continue;
      if (row.entityType === "version" && (COLLECTION_FIELDS as readonly string[]).includes(column)) {
        lines.push(...collectionLines(column as CollectionField, change));
        continue;
      }
      if (row.entityType === "version" && column === "skills") {
        const s = compareSkills((change.old as string[]) ?? [], (change.new as string[]) ?? []);
        lines.push({
          label: "Skills",
          old: s.removed.length ? `прибрано: ${s.removed.join(", ")}` : null,
          new: s.added.length ? `додано: ${s.added.join(", ")}` : s.reordered ? "змінено порядок" : null,
        });
        continue;
      }
      lines.push({
        label: columnLabel(row.entityType, column),
        old: valueText(row.entityType, column, change.old),
        new: valueText(row.entityType, column, change.new),
      });
    }
  }
  return lines;
}

function collectionLines(field: CollectionField, change: FieldChange): ChangeLine[] {
  const meta = COLLECTION_META[field];
  const diff = compareCollection(field, (change.old as CollectionItem[]) ?? [], (change.new as CollectionItem[]) ?? []);
  const lines: ChangeLine[] = [];
  for (const p of diff.pairs) {
    if (p.status === "added") lines.push({ label: meta.label, old: null, new: `додано «${meta.summary(p.right!)}»` });
    if (p.status === "removed") lines.push({ label: meta.label, old: `«${meta.summary(p.left!)}»`, new: null });
    if (p.status === "changed") {
      lines.push({
        label: `${meta.label} · ${meta.summary(p.right!)}`,
        old: p.changedKeys.map((k) => itemValue(field, k, (p.left as Record<string, unknown>)[k])).join("; ") || null,
        new: p.changedKeys.map((k) => itemValue(field, k, (p.right as Record<string, unknown>)[k])).join("; ") || null,
      });
    }
  }
  if (diff.reordered) lines.push({ label: meta.label, old: null, new: "змінено порядок" });
  return lines;
}

function itemValue(field: CollectionField, key: string, value: unknown): string {
  const f = COLLECTION_META[field].fields.find((x) => x.key === key);
  const label = f?.label ?? key;
  if (value === null || value === undefined || value === "") return `${label}: —`;
  if (f?.kind === "money") return `${label}: ${formatPrice(Number(value))}`;
  if (f?.kind === "date") return `${label}: ${formatPlainDate(String(value))}`;
  if (f?.kind === "image") return `${label}: зображення`;
  return `${label}: ${clip(String(value))}`;
}

// ---- summaries -------------------------------------------------------------

const quoteName = (s: string | null | undefined) => `«${s ?? "—"}»`;

function rowOf(entry: ActivityEntry, entity: ActivityRow["entityType"], op?: "insert" | "update") {
  return entry.rows.find(
    (r) => r.entityType === entity && (!op || (op === "insert" ? !!r.details.row : !!r.details.changes)),
  );
}

function versionDate(entry: ActivityEntry): string | null {
  const inserted = entry.rows.find((r) => r.entityType === "version" && r.details.row);
  const date =
    (inserted?.details.row?.update_date as string | undefined) ??
    entry.rows.find((r) => r.entityType === "version" && r.details.changes?.update_date)?.details.changes?.update_date?.new ??
    entry.rows.find((r) => r.entityType === "version")?.details.meta?.update_date;
  return typeof date === "string" ? formatPlainDate(date) : null;
}

function contractTitle(entry: ActivityEntry): string | null {
  const row = entry.rows.find((r) => r.entityType === "contract" || r.entityType === "contract_comment");
  if (!row) return null;
  return (
    (row.details.meta?.title as string | undefined) ??
    (row.details.meta?.contract_title as string | undefined) ??
    (row.details.row?.title as string | undefined) ??
    (row.details.changes?.title?.new as string | undefined) ??
    null
  );
}

function dailyChangeSummary(entry: ActivityEntry): string {
  const row = rowOf(entry, "version", "update");
  const changes = row ? Object.entries(changesOf(row)).filter(([k]) => !HIDDEN_COLUMNS.has(k)) : [];
  if (changes.length === 0) return "Щоденне оновлення";
  const [column, change] = changes[0];
  if (column === "title" || column === "rate") {
    const o = valueText("version", column, change.old) ?? "—";
    const n = valueText("version", column, change.new) ?? "—";
    return `${FIELD_LABELS[column]} змінено з ${o} на ${n}`;
  }
  if (column === "description") return "Змінено Description";
  if (column === "skills") {
    const s = compareSkills((change.old as string[]) ?? [], (change.new as string[]) ?? []);
    const parts = [s.added.length ? `додано ${s.added.join(", ")}` : null, s.removed.length ? `прибрано ${s.removed.join(", ")}` : null].filter(Boolean);
    return parts.length ? `Skills: ${parts.join("; ")}` : "Skills: змінено порядок";
  }
  if ((COLLECTION_FIELDS as readonly string[]).includes(column)) {
    const field = column as CollectionField;
    const meta = COLLECTION_META[field];
    const diff = compareCollection(field, (change.old as CollectionItem[]) ?? [], (change.new as CollectionItem[]) ?? []);
    const pair = diff.pairs.find((p) => p.status !== "same");
    if (pair?.status === "added") return `${meta.label}: додано ${quoteName(meta.summary(pair.right!))}`;
    if (pair?.status === "removed") return `${meta.label}: видалено ${quoteName(meta.summary(pair.left!))}`;
    if (pair?.status === "changed") return `${meta.label}: змінено ${quoteName(meta.summary(pair.right!))}`;
    if (diff.reordered) return `${meta.label}: змінено порядок`;
  }
  return `Змінено ${FIELD_LABELS[column as keyof typeof FIELD_LABELS] ?? column}`;
}

/** One-line summary following the templates of Part A. */
export function summarizeEntry(entry: ActivityEntry): string {
  switch (entry.action) {
    case "profile.created": {
      const row = rowOf(entry, "profile", "insert");
      return `Створено профіль ${quoteName((row?.details.row?.full_name as string) ?? entry.profile?.fullName)}`;
    }
    case "profile.status_changed": {
      const change = rowOf(entry, "profile", "update")?.details.changes?.status;
      const from = PROFILE_STATUS_LABELS[change?.old as ProfileStatus] ?? "—";
      const to = PROFILE_STATUS_LABELS[change?.new as ProfileStatus] ?? "—";
      const reason = entry.rows.find((r) => r.details.reason)?.details.reason;
      return `Статус змінено з ${from} на ${to}.${reason ? ` Причина: ${reason}` : ""}`;
    }
    case "profile.updated": {
      const labels = entry.rows
        .flatMap((r) => Object.keys(changesOf(r)))
        .filter((c) => !HIDDEN_COLUMNS.has(c))
        .map((c) => PROFILE_COLUMN_LABELS[c] ?? c);
      if (labels.length === 0) return "Оновлено профіль";
      return labels.length === 1 ? `Змінено поле ${labels[0]}` : `Змінено поля ${labels.join(", ")}`;
    }
    case "profile.languages_updated":
      return "Оновлено мови профілю";
    case "profile.deleted": {
      // The transaction also removes versions, contracts, …; the name comes from the profile row.
      const row = entry.rows.find((r) => r.entityType === "profile");
      return `Видалено профіль ${quoteName(row?.details.meta?.full_name ?? (row?.details.row?.full_name as string) ?? entry.profile?.fullName)}`;
    }
    case "version.created":
      return `Створено глобальне оновлення від ${versionDate(entry) ?? "—"}`;
    case "version.edited": {
      const fields = [
        ...new Set(
          entry.rows
            .filter((r) => r.entityType === "version")
            .flatMap((r) => Object.keys(changesOf(r)))
            .filter((c) => !HIDDEN_COLUMNS.has(c))
            .map((c) => VERSION_COLUMN_LABELS[c] ?? c),
        ),
      ];
      return `Відредаговано версію від ${versionDate(entry) ?? "—"}${fields.length ? ` (${fields.join(", ")})` : ""}`;
    }
    case "version.daily_change":
      return dailyChangeSummary(entry);
    case "contract.created":
      return `Створено контракт ${quoteName(contractTitle(entry))}`;
    case "contract.edited":
      return `Відредаговано контракт ${quoteName(contractTitle(entry))}`;
    case "contract.closed":
      return `Контракт ${quoteName(contractTitle(entry))} закрито`;
    case "contract.reopened":
      return `Контракт ${quoteName(contractTitle(entry))} відкрито знову`;
    case "contract.deleted":
      return `Видалено контракт ${quoteName(contractTitle(entry))}`;
    case "contract.comment_added":
      return `Додано коментар до контракту ${quoteName(contractTitle(entry))}`;
    default:
      return `Зміна: ${entry.action}`;
  }
}

/** Entries whose details are worth expanding. */
export function hasExpandableChanges(entry: ActivityEntry): boolean {
  return entry.action !== "profile.status_changed" && entryChanges(entry).length > 0;
}
