function matchesCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === code) return true;
  if ("cause" in error) return matchesCode(error.cause, code);
  return false;
}

export function isUniqueViolation(error: unknown): boolean {
  return matchesCode(error, "23505");
}

export function isForeignKeyViolation(error: unknown): boolean {
  return matchesCode(error, "23503");
}
