// Time zones from Intl, labelled `(UTC+03:00) Europe/Kyiv`.

export type TimeZoneOption = { value: string; label: string; offsetMinutes: number };

function offsetMinutes(timeZone: string, at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

export function timeZoneLabel(timeZone: string, at = new Date()): string {
  return `(${formatOffset(offsetMinutes(timeZone, at))}) ${timeZone}`;
}

// Some ICU builds still list legacy names; show the current IANA spelling.
const RENAMED: Record<string, string> = {
  "Europe/Kiev": "Europe/Kyiv",
  "Europe/Uzhgorod": "Europe/Kyiv",
  "Europe/Zaporozhye": "Europe/Kyiv",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Atlantic/Faeroe": "Atlantic/Faroe",
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Sorted by current offset, then name. Offsets reflect today's DST state. */
export function timeZoneOptions(at = new Date()): TimeZoneOption[] {
  const names = new Set(Intl.supportedValuesOf("timeZone").map((tz) => RENAMED[tz] ?? tz));
  return [...names]
    .filter(isValidTimeZone)
    .map((value) => {
      const offset = offsetMinutes(value, at);
      return { value, offsetMinutes: offset, label: `(${formatOffset(offset)}) ${value}` };
    })
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.value.localeCompare(b.value));
}
