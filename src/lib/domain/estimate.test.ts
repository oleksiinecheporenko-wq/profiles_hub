import { describe, expect, it } from "vitest";
import {
  computeTable,
  costs,
  defaultRows,
  durationHours,
  hasEstimatedTasks,
  optimisticOf,
  pessimisticOf,
  rowHours,
  type EstimateRow,
} from "./estimate";

let n = 0;
const id = () => `id-${++n}`;
const task = (feature: string, realistic: number | null): EstimateRow => ({ id: id(), kind: "task", feature, notes: "", realistic });
const phase = (feature: string): EstimateRow => ({ id: id(), kind: "phase", feature, notes: "", realistic: null });

describe("estimate arithmetic", () => {
  it("derives optimistic (÷ 1.5) and pessimistic (× 2), to the half hour", () => {
    expect(optimisticOf(30)).toBe(20);
    expect(pessimisticOf(30)).toBe(60);
    expect(optimisticOf(10)).toBe(6.5); // 6.67
    expect(optimisticOf(8)).toBe(5.5); // 5.33
    expect(pessimisticOf(2.5)).toBe(5);
    expect(optimisticOf(0)).toBe(0);
    expect(optimisticOf(null)).toBeNull();
  });

  it("uses manual optimistic and pessimistic when set", () => {
    const row = { ...task("API", 10), optimistic: 8, pessimistic: null };
    expect(rowHours(row)).toEqual({ optimistic: 8, pessimistic: 20, realistic: 10 });
    // Rows saved before overrides existed have no such keys.
    expect(rowHours(task("Old", 30))).toEqual({ optimistic: 20, pessimistic: 60, realistic: 30 });
    const { total } = computeTable([phase("P"), row, task("UI", 3), { ...task("Risk", null), pessimistic: 4 }]);
    expect(total).toEqual({ optimistic: 10, realistic: 13, pessimistic: 30 });
  });

  it("starts with one phase and ten task rows", () => {
    const rows = defaultRows(id);
    expect(rows).toHaveLength(11);
    expect(rows[0].kind).toBe("phase");
    expect(rows.slice(1).every((r) => r.kind === "task")).toBe(true);
  });

  it("sums phases and the total, skipping empty rows", () => {
    const rows = [phase("Design"), task("Wireframes", 10), task("UI", 4), task("", null), phase("Dev"), task("API", 20)];
    const { lines, total } = computeTable(rows);
    const design = lines[0];
    const dev = lines[4];
    // Wireframes 10 → 6.5 / 20, UI 4 → 2.5 / 8, API 20 → 13.5 / 40.
    expect("subtotal" in design && design.subtotal).toEqual({ optimistic: 9, realistic: 14, pessimistic: 28 });
    expect("subtotal" in dev && dev.subtotal).toEqual({ optimistic: 13.5, realistic: 20, pessimistic: 40 });
    expect(total).toEqual({ optimistic: 22.5, realistic: 34, pessimistic: 68 });
  });

  it("counts tasks before the first phase in the total", () => {
    expect(computeTable([task("Setup", 3), phase("P"), task("X", 1)]).total.realistic).toBe(4);
  });

  it("multiplies hours by the rate", () => {
    expect(costs({ optimistic: 18, realistic: 34, pessimistic: 52 }, 40)).toEqual({ optimistic: 720, realistic: 1360, pessimistic: 2080 });
    expect(costs({ optimistic: 1, realistic: 1, pessimistic: 1 }, null)).toBeNull();
  });

  it("measures the time spent in hours", () => {
    expect(durationHours("2026-10-20T08:00:00Z", "2026-10-20T11:30:00Z")).toBe(3.5);
    expect(durationHours("2026-10-20T08:00:00Z", null)).toBeNull();
  });

  it("requires at least one named task with hours before Готово", () => {
    expect(hasEstimatedTasks(defaultRows(id))).toBe(false);
    expect(hasEstimatedTasks([phase("P"), task("Login", 5)])).toBe(true);
  });
});
