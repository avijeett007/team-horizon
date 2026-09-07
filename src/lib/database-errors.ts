type ErrorWithCode = { code?: unknown };

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as ErrorWithCode).code;
  return typeof code === "string" ? code : null;
}

export function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === "23505";
}

function isDatabaseFailure(error: unknown): boolean {
  const code = errorCode(error);
  if (code && (/^[0-9A-Z]{5}$/.test(code) || /^E[A-Z]+$/.test(code))) return true;
  return error instanceof Error && /(?:ECONN|ETIMEDOUT|database|postgres|password=|connection)/i.test(error.message);
}

export function publicDatabaseError(error: unknown, fallback?: string): string {
  if (isDatabaseFailure(error)) return "Database service is unavailable";
  return fallback ?? (error instanceof Error ? error.message : "Invalid request");
}
