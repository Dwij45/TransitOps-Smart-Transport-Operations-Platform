import "server-only";

import { getOperationContext } from "@/lib/operation-context";

/**
 * Returns the `requestId` and `ipAddress` from the current operation context.
 * Designed to be spread into `auditEvent` insert values so that every audit
 * record created inside a protected operation carries the request metadata
 * without requiring it to be threaded through service function signatures.
 *
 * When called outside a protected operation (e.g. Better Auth hooks), both
 * fields are `null`, which matches the column defaults.
 */
export function auditMetadata(): {
  requestId: string | null;
  ipAddress: string | null;
} {
  const ctx = getOperationContext();
  return {
    requestId: ctx?.requestId ?? null,
    ipAddress: ctx?.ipAddress ?? null,
  };
}
