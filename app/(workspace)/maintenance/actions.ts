"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { executeProtectedFormOperation, type OperationResult } from "@/lib/server-operation";
import { uploadMaintenanceDocument } from "@/lib/services/documents";
import {
  addMaintenanceLine,
  cancelMaintenance,
  completeMaintenance,
  scheduleMaintenance,
  startMaintenance,
} from "@/lib/services/maintenance";
import { toMinorUnits } from "@/lib/vehicle-rules";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return { ok: false, message: result.error.message, fieldErrors: result.error.fieldErrors };
}

const scheduleSchema = z.object({
  vehicleId: z.string().regex(uuidPattern, "Choose a vehicle"),
  serviceTypeId: z.string().regex(uuidPattern, "Choose a service type"),
  scheduledAt: z.string().trim().min(1, "Enter a date"),
  vendorName: z.string().trim().max(120),
  notes: z.string().trim().max(2000),
});

const lineSchema = z.object({
  orderId: z.string().regex(uuidPattern),
  kind: z.enum(["part", "labour", "other"]),
  description: z.string().trim().min(1, "Enter a description").max(160),
  quantity: z.string().trim(),
  unitAmount: z.string().trim().min(1, "Enter an amount"),
});

const idSchema = z.object({ id: z.string().regex(uuidPattern, "Choose an order") });

const completeSchema = z.object({
  id: z.string().regex(uuidPattern),
  closingOdometerKm: z.string().trim().min(1, "Enter a closing odometer"),
});

const cancelSchema = z.object({
  id: z.string().regex(uuidPattern),
  reason: z.string().trim().min(1, "Enter a cancellation reason").max(500),
});

export async function scheduleMaintenanceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, scheduleSchema, (actor, input) =>
    scheduleMaintenance(actor.userId, {
      vehicleId: input.vehicleId,
      serviceTypeId: input.serviceTypeId,
      scheduledAt: new Date(input.scheduledAt),
      vendorName: input.vendorName || undefined,
      notes: input.notes || undefined,
    }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/maintenance");
  redirect(`/maintenance/${result.data.id}`);
}

export async function addLineAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, lineSchema, (actor, input) =>
    addMaintenanceLine(actor.userId, {
      orderId: input.orderId,
      kind: input.kind,
      description: input.description,
      quantity: input.quantity,
      unitAmountMinor: toMinorUnits(input.unitAmount) ?? BigInt(0),
    }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${result.data.id}`);
  return { ok: true, message: "Line added." };
}

export async function startMaintenanceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, idSchema, (actor, input) =>
    startMaintenance(actor.userId, input.id),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  return { ok: true, message: "Work started. The vehicle is in the shop." };
}

export async function completeMaintenanceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, completeSchema, (actor, input) =>
    completeMaintenance(actor.userId, input.id, input.closingOdometerKm),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath("/expenses");
  return { ok: true, message: "Work completed and one expense was posted." };
}

export async function cancelMaintenanceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, cancelSchema, (actor, input) =>
    cancelMaintenance(actor.userId, input.id, input.reason),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  return { ok: true, message: "Order cancelled." };
}

export async function uploadMaintenanceDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = String(formData.get("orderId") ?? "");
  const file = formData.get("file");
  if (!uuidPattern.test(orderId) || !(file instanceof File)) {
    return { ok: false, message: "Choose a file." };
  }
  const result = await executeProtectedFormOperation(
    formData,
    z.object({ orderId: z.string().regex(uuidPattern) }),
    (actor) => uploadMaintenanceDocument(actor.userId, { orderId, file }),
  );
  if (!result.ok) return failure(result);
  revalidatePath(`/maintenance/${orderId}`);
  return { ok: true, message: "Document stored." };
}
