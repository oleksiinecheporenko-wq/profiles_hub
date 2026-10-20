// Estimation Hub domain: model, defaults and the hour/cost arithmetic.

export type Uuid = string;
/** ISO timestamp as returned by the database. */
export type Timestamp = string;

export const ESTIMATE_STATUSES = ["in_progress", "ready", "archived"] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const STATUS_LABELS: Record<EstimateStatus, string> = {
  in_progress: "В роботі",
  ready: "Готовий",
  archived: "В архіві",
};

/** Section of the app each status lives in. */
export const STATUS_SECTIONS: Record<EstimateStatus, { href: string; label: string }> = {
  in_progress: { href: "/requests", label: "Запити" },
  ready: { href: "/ready", label: "Готові запити" },
  archived: { href: "/archive", label: "Архів" },
};

/** A `Phase` row is a heading across all columns; a task row carries hours. */
export type EstimateRow = {
  id: Uuid;
  kind: "phase" | "task";
  feature: string;
  notes: string;
  /** Realistic hours; only task rows have them. */
  realistic: number | null;
};

export type EstimateLink = { id: Uuid; url: string; label: string | null };

/** A `Next steps` item of the client PDF. */
export type NextStep = { id: Uuid; title: string; text: string };

export type EstimateFile = {
  id: Uuid;
  estimateId: Uuid;
  path: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  createdAt: Timestamp;
};

export type Estimate = {
  id: Uuid;
  clientName: string;
  projectName: string | null;
  status: EstimateStatus;
  developer: string | null;
  rate: number | null;
  jobTitle: string | null;
  jobDescription: string | null;
  additionalInfo: string | null;
  links: EstimateLink[];
  rows: EstimateRow[];
  /** Custom `Next steps`; null means the standard ones. */
  nextSteps: NextStep[] | null;
  createdAt: Timestamp;
  readyAt: Timestamp | null;
  archivedAt: Timestamp | null;
  updatedAt: Timestamp;
};

export type EstimateWithFiles = Estimate & { files: EstimateFile[] };

// ---- next steps -------------------------------------------------------------

/** Used whenever an estimate has no custom steps (or an empty list). */
export const DEFAULT_NEXT_STEPS: NextStep[] = [
  { id: "default-1", title: "Discovery call", text: "We align on scope, priorities and open questions." },
  { id: "default-2", title: "Proposal", text: "Milestones, team and timeline, fixed in writing." },
  { id: "default-3", title: "Kick-off", text: "Onboarding, environments and the first sprint." },
];

/** Steps that go into the PDF: the custom ones with a title, else the defaults. */
export function effectiveNextSteps(steps: NextStep[] | null): NextStep[] {
  const filled = (steps ?? []).filter((s) => s.title.trim() !== "");
  return filled.length > 0 ? filled : DEFAULT_NEXT_STEPS;
}

// ---- rows -----------------------------------------------------------------

/** Optimistic is always 6 h below Realistic, Pessimistic 6 h above. */
export const SPREAD_HOURS = 6;

export function optimisticOf(realistic: number | null): number | null {
  return realistic === null ? null : Math.max(0, realistic - SPREAD_HOURS);
}

export function pessimisticOf(realistic: number | null): number | null {
  return realistic === null ? null : realistic + SPREAD_HOURS;
}

export const DEFAULT_ROW_COUNT = 11;

export function newRow(kind: EstimateRow["kind"], id: Uuid): EstimateRow {
  return { id, kind, feature: "", notes: "", realistic: null };
}

/** A new estimate starts with 11 rows: one `Phase` heading and ten task rows. */
export function defaultRows(newId: () => Uuid): EstimateRow[] {
  return [newRow("phase", newId()), ...Array.from({ length: DEFAULT_ROW_COUNT - 1 }, () => newRow("task", newId()))];
}

export type Hours = { optimistic: number; realistic: number; pessimistic: number };

export type TableLine =
  | { row: EstimateRow & { kind: "phase" }; subtotal: Hours }
  | { row: EstimateRow & { kind: "task" }; optimistic: number | null; pessimistic: number | null };

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Lines for rendering: task rows with their derived hours, phase rows with the
 * subtotal of the tasks below them (until the next phase), and the grand total.
 */
export function computeTable(rows: EstimateRow[]): { lines: TableLine[]; total: Hours } {
  const lines: TableLine[] = [];
  const total: Hours = { optimistic: 0, realistic: 0, pessimistic: 0 };
  let phase: Hours | null = null;

  for (const row of rows) {
    if (row.kind === "phase") {
      phase = { optimistic: 0, realistic: 0, pessimistic: 0 };
      lines.push({ row: row as EstimateRow & { kind: "phase" }, subtotal: phase });
      continue;
    }
    const o = optimisticOf(row.realistic);
    const p = pessimisticOf(row.realistic);
    lines.push({ row: row as EstimateRow & { kind: "task" }, optimistic: o, pessimistic: p });
    if (row.realistic === null) continue;
    for (const target of phase ? [phase, total] : [total]) {
      target.optimistic += o!;
      target.realistic += row.realistic;
      target.pessimistic += p!;
    }
  }

  for (const line of lines) {
    if ("subtotal" in line) {
      line.subtotal.optimistic = round(line.subtotal.optimistic);
      line.subtotal.realistic = round(line.subtotal.realistic);
      line.subtotal.pessimistic = round(line.subtotal.pessimistic);
    }
  }
  return {
    lines,
    total: { optimistic: round(total.optimistic), realistic: round(total.realistic), pessimistic: round(total.pessimistic) },
  };
}

/** Cost of each scenario: rate × hours. */
export function costs(total: Hours, rate: number | null): Hours | null {
  if (rate === null) return null;
  return {
    optimistic: round(total.optimistic * rate),
    realistic: round(total.realistic * rate),
    pessimistic: round(total.pessimistic * rate),
  };
}

/** Hours spent on the estimate: ready − created, one decimal. */
export function durationHours(createdAt: Timestamp, readyAt: Timestamp | null): number | null {
  if (!readyAt) return null;
  const ms = new Date(readyAt).getTime() - new Date(createdAt).getTime();
  return Math.max(0, Math.round((ms / 3_600_000) * 10) / 10);
}

/** Rows that block `Готово`: none with a feature name and hours. */
export function hasEstimatedTasks(rows: EstimateRow[]): boolean {
  return rows.some((r) => r.kind === "task" && r.realistic !== null && r.feature.trim() !== "");
}
