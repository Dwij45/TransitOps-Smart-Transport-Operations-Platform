import "server-only";

import { DomainError } from "@/lib/domain-error";

const MAX_SERIALIZATION_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 25;

type SqlStateError = {
  code?: unknown;
};

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as SqlStateError).code === "40001"
  );
}

function waitForRetry(attempt: number): Promise<void> {
  const cappedDelay = Math.min(
    INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1),
    250,
  );
  const jitter = Math.floor(Math.random() * INITIAL_RETRY_DELAY_MS);

  return new Promise((resolve) => {
    setTimeout(resolve, cappedDelay + jitter);
  });
}

/**
 * Re-runs a complete serializable transaction after PostgreSQL SQLSTATE 40001.
 * The callback must contain only transactional work: it can run more than once.
 */
export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializationFailure(error)) {
        throw error;
      }

      if (attempt === MAX_SERIALIZATION_ATTEMPTS) {
        throw new DomainError(
          "conflict",
          "The record changed while this operation was being completed",
        );
      }

      await waitForRetry(attempt);
    }
  }

  throw new Error("Serializable transaction retry limit was not reached");
}
