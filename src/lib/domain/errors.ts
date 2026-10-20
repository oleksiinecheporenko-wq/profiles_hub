// Errors raised by the data layer, mapped to Ukrainian messages for the UI.

export type RepositoryErrorCode = "not_found" | "wrong_status" | "invalid" | "unknown";

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

export const REPOSITORY_ERROR_MESSAGES: Record<RepositoryErrorCode, string> = {
  not_found: "Запит не знайдено. Можливо, його видалено.",
  wrong_status: "Запит уже в іншому розділі. Оновіть сторінку.",
  invalid: "Дані не пройшли перевірку. Перевірте поля.",
  unknown: "Не вдалося зберегти зміни. Спробуйте ще раз.",
};

export function errorMessage(error: unknown): string {
  return isRepositoryError(error) ? REPOSITORY_ERROR_MESSAGES[error.code] : REPOSITORY_ERROR_MESSAGES.unknown;
}
