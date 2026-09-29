// Shared bits of the contract exports (Part A, section 7 `Export`).

import { readFileSync } from "node:fs";
import path from "node:path";
import { CONTRACT_STATUS_LABELS } from "@/lib/domain/enums";
import type { ContractDetail } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatPlainDate, formatRate } from "@/lib/format";

export const WORDMARK = "UPWORK / PROFILE MANAGER";
export const FONT_FAMILY = "Roboto";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
export const FONT_FILES = {
  regular: path.join(FONT_DIR, "Roboto-Regular.ttf"),
  bold: path.join(FONT_DIR, "Roboto-Bold.ttf"),
};

/** Static paths, so the bundler can trace the font files. */
export function readFont(weight: keyof typeof FONT_FILES): Buffer {
  return weight === "bold"
    ? readFileSync(path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Bold.ttf"))
    : readFileSync(path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Regular.ttf"));
}

// Ukrainian national transliteration (simplified: position rules for є/ї/й/ю/я at word start ignored).
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i",
  ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ъ: "", ы: "y", э: "e",
  ё: "io", "'": "", "’": "",
};

export function slugify(text: string, max = 60): string {
  const latin = [...text.toLocaleLowerCase("uk")].map((c) => TRANSLIT[c] ?? c).join("");
  const slug = latin
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "contract";
}

/** `contract-<title-slug>-<yyyy-mm-dd>.<ext>` (date = contract creation date). */
export function contractFileName(contract: Pick<ContractDetail, "title" | "createdDate">, ext: "docx" | "pdf"): string {
  return `contract-${slugify(contract.title)}-${contract.createdDate}.${ext}`;
}

export type ExportModel = {
  title: string;
  meta: { label: string; value: string }[];
  sections: { heading: string; body: string | null }[];
  comments: { when: string; body: string }[];
};

/** Plain data for both renderers, so Word and PDF show the same content. */
export function exportModel(c: ContractDetail): ExportModel {
  const meta = [
    { label: "Статус", value: CONTRACT_STATUS_LABELS[c.status] },
    { label: "Профіль", value: c.profile.fullName },
    ...(c.profile.profileUrl ? [{ label: "Посилання на профіль", value: c.profile.profileUrl }] : []),
    { label: "Дата створення", value: formatPlainDate(c.createdDate) },
    ...(c.closedAt ? [{ label: "Дата закриття", value: formatDate(c.closedAt) }] : []),
    { label: "Рейт", value: c.rate === null ? "—" : formatRate(c.rate) },
  ];
  return {
    title: c.title,
    meta,
    sections: [
      { heading: "Опис", body: c.description },
      { heading: "Діалог", body: c.dialog },
    ],
    comments: c.comments.map((m) => ({ when: formatDateTime(m.createdAt), body: m.body })),
  };
}
