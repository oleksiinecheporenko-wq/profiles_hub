import { describe, expect, it } from "vitest";
import { formatCost, formatDate, formatDateTime, formatFileSize, formatHours, formatRate } from "./format";

describe("format", () => {
  it("shows UTC timestamps in Europe/Kyiv", () => {
    // 21:30 UTC on 29 Sep is 00:30 on 30 Sep in Kyiv (UTC+3, summer time).
    expect(formatDateTime("2026-09-29T21:30:00Z")).toBe("30.09.2026 00:30");
    // Winter time: UTC+2.
    expect(formatDateTime("2026-01-15T10:05:00Z")).toBe("15.01.2026 12:05");
    expect(formatDate(new Date("2026-09-29T08:00:00Z"))).toBe("29.09.2026");
  });

  it("formats rate, cost, hours and sizes", () => {
    expect(formatRate(40)).toBe("$40/год");
    expect(formatRate(37.5)).toBe("$37.50/год");
    expect(formatRate(null)).toBe("—");
    expect(formatCost(4200)).toBe("$4,200");
    expect(formatCost(37.5)).toBe("$37.50");
    expect(formatHours(12.5)).toBe("12.5");
    expect(formatHours(null)).toBe("—");
    expect(formatFileSize(2048)).toBe("2 КБ");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 МБ");
  });
});
