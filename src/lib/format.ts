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

function formatMoney(value: number): string {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `$${fixed}`;
}

/** Rate: `$40/год`. */
export function formatRate(value: number | null | undefined): string {
  return value == null ? "—" : `${formatMoney(value)}/год`;
}

/** Amount in dollars with thousands separators: `$4,200`, `$37.50`. */
export function formatCost(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Hours without trailing zeros: `12`, `12.5`; `—` when empty. */
export function formatHours(value: number | null | undefined): string {
  return value == null ? "—" : String(Math.round(value * 100) / 100);
}

/** File size: `830 КБ`, `12.4 МБ`. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
