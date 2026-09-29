// Errors raised by the data layer. Postgres functions raise the same codes as the
// exception message (see supabase/migrations), the Supabase repository maps them here.

export type RepositoryErrorCode =
  | "not_found"
  | "conflict"
  | "not_current"
  | "invalid"
  | "duplicate"
  | "unknown";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RepositoryError";
    this.code = code;
  }
}

export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError;
}

/** Ukrainian messages for the UI. */
export const REPOSITORY_ERROR_MESSAGES: Record<RepositoryErrorCode, string> = {
  not_found: "Запис не знайдено. Можливо, його видалено.",
  conflict: "Дані змінилися. Оновіть сторінку, щоб побачити актуальну версію.",
  not_current: "Щоденні зміни можна вносити лише в Актуальну версію.",
  invalid: "Дані не пройшли перевірку. Перевірте поля форми.",
  duplicate: "Такий запис уже існує.",
  unknown: "Не вдалося зберегти зміни. Спробуйте ще раз.",
};

export function errorMessage(error: unknown): string {
  return isRepositoryError(error)
    ? REPOSITORY_ERROR_MESSAGES[error.code]
    : REPOSITORY_ERROR_MESSAGES.unknown;
}
