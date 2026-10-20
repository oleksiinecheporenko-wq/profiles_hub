import { describe, expect, it } from "vitest";
import {
  computeTable,
  costs,
  defaultRows,
  durationHours,
  hasEstimatedTasks,
  optimisticOf,
  pessimisticOf,
  type EstimateRow,
} from "./estimate";

let n = 0;
const id = () => `id-${++n}`;
const task = (feature: string, realistic: number | null): EstimateRow => ({ id: id(), kind: "task", feature, notes: "", realistic });
const phase = (feature: string): EstimateRow => ({ id: id(), kind: "phase", feature, notes: "", realistic: null });

describe("estimate arithmetic", () => {
  it("derives optimistic and pessimistic per row, never below zero", () => {
    expect(optimisticOf(20)).toBe(14);
    expect(pessimisticOf(20)).toBe(26);
    expect(optimisticOf(2)).toBe(0);
    expect(pessimisticOf(2)).toBe(8);
    expect(optimisticOf(null)).toBeNull();
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
    expect("subtotal" in design && design.subtotal).toEqual({ optimistic: 4, realistic: 14, pessimistic: 26 });
    expect("subtotal" in dev && dev.subtotal).toEqual({ optimistic: 14, realistic: 20, pessimistic: 26 });
    expect(total).toEqual({ optimistic: 18, realistic: 34, pessimistic: 52 });
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
