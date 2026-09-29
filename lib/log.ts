import { redactSnapshot } from "@/lib/audit-redaction";

export function logFields(fields: Record<string, unknown>): Record<string, unknown> {
  return redactSnapshot(fields) as Record<string, unknown>;
}

export function logEvent(event: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...logFields(fields) }));
}
