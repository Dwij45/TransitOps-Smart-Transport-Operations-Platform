"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { recordSafetyEvent } from "@/lib/services/driver-safety";
import { executeProtectedFormOperation, type OperationResult } from "@/lib/server-operation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const eventSchema = z.object({
  driverId: z.string().regex(uuidPattern, "Choose a driver"),
  eventTypeId: z.string().regex(uuidPattern, "Choose an event type"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  occurredOn: z.string().trim().refine((value) => isIsoDate(value), "Enter the event date"),
  summary: z.string().trim().min(1, "Enter a summary").max(160),
  notes: z.string().trim().max(500),
});

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return { ok: false, message: result.error.message, fieldErrors: result.error.fieldErrors };
}

export async function recordSafetyEventAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, eventSchema, (actor, input) => {
    const [year, month, day] = input.occurredOn.split("-").map(Number);
    return recordSafetyEvent(actor.userId, input.driverId, {
      eventTypeId: input.eventTypeId,
      severity: input.severity,
      occurredAt: new Date(Date.UTC(year, month - 1, day, 12)),
      summary: input.summary,
      notes: input.notes || null,
    });
  });
  if (!result.ok) return failure(result);
  revalidatePath(`/drivers/${String(formData.get("driverId") ?? "")}`);
  return { ok: true, message: "Safety event recorded. The points shown are the type default at this moment." };
}
