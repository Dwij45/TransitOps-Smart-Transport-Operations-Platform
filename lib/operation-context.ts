import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Metadata captured from the incoming request at the server-operation boundary.
 * Services running inside a protected operation can read these values without
 * requiring them to be threaded through every function signature.
 */
export interface OperationContext {
  /** Value of the `x-request-id` header, or `null` when absent. */
  requestId: string | null;
  /** Best-effort client IP from forwarded headers, or `null` when absent. */
  ipAddress: string | null;
}

const storage = new AsyncLocalStorage<OperationContext>();

/**
 * Executes `fn` with the given context available to any downstream code that
 * calls `getOperationContext`.
 */
export function runWithOperationContext<T>(
  context: OperationContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

/**
 * Returns the current operation context, or `undefined` when called outside a
 * protected operation (for example, from Better Auth hooks).
 */
export function getOperationContext(): OperationContext | undefined {
  return storage.getStore();
}
