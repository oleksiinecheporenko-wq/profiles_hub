// Display formatting. Timestamps are stored in UTC and shown in Europe/Kyiv.

export const DISPLAY_TIME_ZONE = "Europe/Kyiv";

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function kyivParts(value: DateInput) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** `dd.MM.yyyy` in Europe/Kyiv. */
export function formatDate(value: DateInput): string {
  const p = kyivParts(value);
  return `${p.day}.${p.month}.${p.year}`;
}

/** `HH:mm` in Europe/Kyiv. */
export function formatTime(value: DateInput): string {
  const p = kyivParts(value);
  return `${p.hour}:${p.minute}`;
}

/** `dd.MM.yyyy HH:mm` in Europe/Kyiv. */
export function formatDateTime(value: DateInput): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** Formats a DB `date` value (`yyyy-MM-dd`, no time zone) as `dd.MM.yyyy`. */
export function formatPlainDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/** Today's date in Europe/Kyiv as `yyyy-MM-dd`. */
export function todayPlainDate(): string {
  const p = kyivParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

function formatMoney(value: number): string {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `$${fixed}`;
}

/** Rate: `$40/год`. */
export function formatRate(value: number | null | undefined): string {
  return value == null ? "—" : `${formatMoney(value)}/год`;
}

/** Project Catalog price: `$250`. */
export function formatPrice(value: number | null | undefined): string {
  return value == null ? "—" : formatMoney(value);
}

/** Initials for an avatar placeholder. */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join("").toLocaleUpperCase("uk");
}

function kyivOffsetMinutes(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: DISPLAY_TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** UTC instant of 00:00 in Europe/Kyiv on the given `yyyy-MM-dd` day. */
export function kyivDayStart(plainDate: string): Date {
  const [y, m, d] = plainDate.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  let start = utcMidnight - kyivOffsetMinutes(new Date(utcMidnight)) * 60_000;
  // Re-check across a DST switch.
  start = utcMidnight - kyivOffsetMinutes(new Date(start)) * 60_000;
  return new Date(start);
}

/** `yyyy-MM-dd` shifted by whole days. */
export function addDays(plainDate: string, days: number): string {
  const [y, m, d] = plainDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Kyiv calendar day (`yyyy-MM-dd`) of a timestamp. */
export function kyivPlainDate(value: DateInput): string {
  const p = kyivParts(value);
  return `${p.year}-${p.month}-${p.day}`;
}
