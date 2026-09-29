import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatPlainDate, formatPrice, formatRate, initials } from "./format";

describe("format", () => {
  it("shows UTC timestamps in Europe/Kyiv", () => {
    // 21:30 UTC on 29 Sep is 00:30 on 30 Sep in Kyiv (UTC+3, summer time).
    expect(formatDateTime("2026-09-29T21:30:00Z")).toBe("30.09.2026 00:30");
    // Winter time: UTC+2.
    expect(formatDateTime("2026-01-15T10:05:00Z")).toBe("15.01.2026 12:05");
    expect(formatDate(new Date("2026-09-29T08:00:00Z"))).toBe("29.09.2026");
  });

  it("formats plain DB dates without shifting the day", () => {
    expect(formatPlainDate("2026-08-12")).toBe("12.08.2026");
  });

  it("formats rate and price", () => {
    expect(formatRate(40)).toBe("$40/год");
    expect(formatRate(37.5)).toBe("$37.50/год");
    expect(formatRate(null)).toBe("—");
    expect(formatPrice(250)).toBe("$250");
  });

  it("builds initials", () => {
    expect(initials("Іван Петренко")).toBe("ІП");
    expect(initials("  олена  ")).toBe("О");
    expect(initials("")).toBe("?");
  });
});
