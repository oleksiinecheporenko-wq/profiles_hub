// Shared bits of the client PDF: fonts, file name and the plain data model.

import path from "node:path";
import { computeTable, costs, type Estimate, type Hours } from "@/lib/domain/estimate";

export const WORDMARK = "CORALSOFT";
export const FONT_FAMILY = "Roboto";

/** Absolute paths for `Font.register`; static segments so the files get traced. */
export const FONT_FILES = {
  regular: path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Regular.ttf"),
  bold: path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Bold.ttf"),
};

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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "estimate";
}

/** `estimate-<client>-<project>-<yyyy-mm-dd>.pdf` (date = ready date, else creation). */
export function estimateFileName(e: Pick<Estimate, "clientName" | "projectName" | "createdAt" | "readyAt">): string {
  const name = slugify([e.clientName, e.projectName].filter(Boolean).join(" "));
  return `estimate-${name}-${(e.readyAt ?? e.createdAt).slice(0, 10)}.pdf`;
}

const pdfDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );

export const formatHoursEn = (h: number | null) => (h === null ? "—" : String(Math.round(h * 100) / 100));

export function formatUsd(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export type PdfLine =
  | { kind: "phase"; feature: string; subtotal: Hours }
  | { kind: "task"; feature: string; notes: string; optimistic: number | null; pessimistic: number | null; realistic: number | null };

export type PdfModel = {
  client: string;
  project: string | null;
  jobTitle: string | null;
  date: string;
  lines: PdfLine[];
  total: Hours;
  rate: number | null;
  cost: Hours | null;
};

/** Rows with no feature and no hours are blank placeholders and are left out. */
export function pdfModel(e: Estimate): PdfModel {
  const { lines, total } = computeTable(e.rows);
  const out: PdfLine[] = [];
  for (const line of lines) {
    if (line.row.kind === "phase") {
      if ("subtotal" in line && line.row.feature.trim()) out.push({ kind: "phase", feature: line.row.feature, subtotal: line.subtotal });
    } else if ("optimistic" in line && (line.row.feature.trim() || line.row.realistic !== null)) {
      out.push({
        kind: "task",
        feature: line.row.feature,
        notes: line.row.notes,
        optimistic: line.optimistic,
        pessimistic: line.pessimistic,
        realistic: line.row.realistic,
      });
    }
  }
  return {
    client: e.clientName,
    project: e.projectName,
    jobTitle: e.jobTitle,
    date: pdfDate(e.readyAt ?? e.createdAt),
    lines: out,
    total,
    rate: e.rate,
    cost: costs(total, e.rate),
  };
}
