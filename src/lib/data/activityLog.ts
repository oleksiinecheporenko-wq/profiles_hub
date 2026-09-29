// Mirrors `public.log_activity()` (supabase/migrations/…_activity_log_triggers.sql)
// for the mock repository, so both backends produce the same log rows.

import { jsonEqual } from "@/lib/domain/dailyChanges";
import type { ActivityDetails, FieldChange } from "@/lib/domain/types";

export type LogOperation = "INSERT" | "UPDATE" | "DELETE";

/** JSON round trip, so values look exactly like a jsonb snapshot. */
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Details for one log row. Returns null for an UPDATE where nothing but
 * `updated_at` changed; the trigger writes no row in that case.
 */
export function buildLogDetails(
  op: LogOperation,
  oldRow: Record<string, unknown> | null,
  newRow: Record<string, unknown> | null,
  reason?: string | null,
  meta?: ActivityDetails["meta"],
): ActivityDetails | null {
  let details: ActivityDetails;
  if (op === "UPDATE") {
    const before = snapshot(oldRow ?? {});
    const after = snapshot(newRow ?? {});
    const changes: Record<string, FieldChange> = {};
    for (const key of Object.keys(after)) {
      if (key === "updated_at") continue;
      const o = before[key] ?? null;
      const n = after[key] ?? null;
      if (!jsonEqual(o, n)) changes[key] = { old: o, new: n };
    }
    if (Object.keys(changes).length === 0) return null;
    details = { changes };
  } else {
    details = { row: snapshot((op === "INSERT" ? newRow : oldRow) ?? {}) };
  }
  if (reason) details.reason = reason;
  if (meta) details.meta = meta;
  return details;
}
