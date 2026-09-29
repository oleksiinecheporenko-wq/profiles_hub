import type { z } from "zod";
import { errorMessage, isRepositoryError } from "@/lib/domain/errors";

/** Result shape of every server action; errors are Ukrainian, ready for the UI. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** First message per top-level field, for inline form errors. */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Дані не пройшли перевірку.",
    code: "invalid",
    fieldErrors: fieldErrorsFromZod(error),
  };
}

/** Maps repository/unknown errors; never leaks raw backend messages to the UI. */
export function failure(error: unknown): ActionResult<never> {
  if (!isRepositoryError(error)) console.error("[action]", error);
  return {
    ok: false,
    error: errorMessage(error),
    code: isRepositoryError(error) ? error.code : "unknown",
  };
}
