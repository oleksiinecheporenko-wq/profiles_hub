// Display metadata for version fields and collection items (labels from Part B).

import { formatPlainDate, formatPrice } from "@/lib/format";
import type { CollectionField, CollectionItem, DailyChangeField, Uuid } from "./types";

export const FIELD_LABELS: Record<DailyChangeField | "additional_info" | "update_date", string> = {
  update_date: "Дата оновлення",
  title: "Title",
  rate: "Rate",
  description: "Description",
  skills: "Skills",
  portfolio: "Portfolio",
  project_catalog: "Project Catalog",
  certifications: "Certifications",
  employment_history: "Employment history",
  other_experiences: "Other experiences",
  additional_info: "Додаткова інформація",
};

export type ItemFieldKind = "text" | "textarea" | "url" | "money" | "date" | "image";

export type ItemFieldMeta = {
  key: string;
  label: string;
  kind: ItemFieldKind;
  required?: boolean;
};

export type CollectionMeta = {
  label: string;
  /** Singular noun for buttons: `Додати …`. */
  itemNoun: string;
  fields: ItemFieldMeta[];
  newItem: (id: Uuid) => CollectionItem;
  /** One-line name of an item. */
  summary: (item: CollectionItem) => string;
};

const text = (v: unknown) => (typeof v === "string" ? v : "");

export const COLLECTION_META: Record<CollectionField, CollectionMeta> = {
  portfolio: {
    label: "Portfolio",
    itemNoun: "проєкт",
    fields: [
      { key: "title", label: "Назва", kind: "text", required: true },
      { key: "description", label: "Опис", kind: "textarea" },
      { key: "url", label: "Посилання", kind: "url" },
      { key: "image_path", label: "Зображення", kind: "image" },
    ],
    newItem: (id) => ({ id, title: "", description: null, url: null, image_path: null }),
    summary: (i) => text((i as { title?: string }).title) || "Без назви",
  },
  project_catalog: {
    label: "Project Catalog",
    itemNoun: "пропозицію",
    fields: [
      { key: "title", label: "Назва", kind: "text", required: true },
      { key: "description", label: "Опис", kind: "textarea" },
      { key: "price", label: "Ціна", kind: "money" },
      { key: "url", label: "Посилання", kind: "url" },
    ],
    newItem: (id) => ({ id, title: "", description: null, price: null, url: null }),
    summary: (i) => text((i as { title?: string }).title) || "Без назви",
  },
  certifications: {
    label: "Certifications",
    itemNoun: "сертифікат",
    fields: [
      { key: "title", label: "Назва", kind: "text", required: true },
      { key: "issuer", label: "Ким видано", kind: "text" },
      { key: "date_from", label: "Дата початку", kind: "date" },
      { key: "date_to", label: "Дата завершення", kind: "date" },
      { key: "description", label: "Опис", kind: "textarea" },
    ],
    newItem: (id) => ({ id, title: "", issuer: null, date_from: null, date_to: null, description: null }),
    summary: (i) => text((i as { title?: string }).title) || "Без назви",
  },
  employment_history: {
    label: "Employment history",
    itemNoun: "місце роботи",
    fields: [
      { key: "company", label: "Компанія", kind: "text", required: true },
      { key: "position", label: "Посада", kind: "text" },
      { key: "date_from", label: "Дата початку", kind: "date" },
      { key: "date_to", label: "Дата завершення", kind: "date" },
      { key: "description", label: "Опис", kind: "textarea" },
    ],
    newItem: (id) => ({ id, company: "", position: null, date_from: null, date_to: null, description: null }),
    summary: (i) => {
      const e = i as { company?: string; position?: string | null };
      return [text(e.company) || "Без назви", e.position].filter(Boolean).join(" · ");
    },
  },
  other_experiences: {
    label: "Other experiences",
    itemNoun: "досвід",
    fields: [
      { key: "title", label: "Назва", kind: "text", required: true },
      { key: "description", label: "Опис", kind: "textarea" },
    ],
    newItem: (id) => ({ id, title: "", description: null }),
    summary: (i) => text((i as { title?: string }).title) || "Без назви",
  },
};

export function itemFieldLabel(field: CollectionField, key: string): string {
  return COLLECTION_META[field].fields.find((f) => f.key === key)?.label ?? key;
}

/** Secondary line of an item: price, issuer and date, employment period or link. */
export function itemMetaLine(field: CollectionField, item: CollectionItem): string | null {
  const i = item as Record<string, unknown>;
  switch (field) {
    case "project_catalog":
      return typeof i.price === "number" ? formatPrice(i.price) : null;
    case "certifications":
      return [i.issuer, certificationPeriod(i.date_from, i.date_to)].filter(Boolean).join(" · ") || null;
    case "employment_history": {
      const from = typeof i.date_from === "string" ? formatPlainDate(i.date_from) : "—";
      const to = typeof i.date_to === "string" ? formatPlainDate(i.date_to) : "по теперішній час";
      return `${from} — ${to}`;
    }
    default:
      return typeof i.url === "string" ? i.url : null;
  }
}

/** `01.07.2026 — 01.07.2027`, `з 01.07.2026`, `до 01.07.2027` or null. */
export function certificationPeriod(from: unknown, to: unknown): string | null {
  const f = typeof from === "string" && from ? formatPlainDate(from) : null;
  const t = typeof to === "string" && to ? formatPlainDate(to) : null;
  if (f && t) return `${f} — ${t}`;
  if (f) return `з ${f}`;
  if (t) return `до ${t}`;
  return null;
}
