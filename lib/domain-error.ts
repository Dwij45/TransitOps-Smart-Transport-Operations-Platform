export type DomainErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid_state"
  | "conflict"
  | "validation_failed";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
