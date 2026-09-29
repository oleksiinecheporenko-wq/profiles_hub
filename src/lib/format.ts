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
