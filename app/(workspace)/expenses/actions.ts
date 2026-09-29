"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { executeProtectedFormOperation, type OperationResult } from "@/lib/server-operation";
import { uploadExpenseDocument } from "@/lib/services/documents";
import { recordExpense, recordFuel, updateExpense } from "@/lib/services/expenses";
import { toMinorUnits } from "@/lib/vehicle-rules";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optionalId = z.string().trim().refine((value) => value === "" || uuidPattern.test(value)).transform((value) => value || null);

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return { ok: false, message: result.error.message, fieldErrors: result.error.fieldErrors };
}

const fuelSchema = z.object({
  vehicleId: z.string().regex(uuidPattern, "Choose a vehicle"),
  tripId: optionalId,
  litres: z.string().trim(),
  amount: z.string().trim().min(1, "Enter an amount"),
  fuelType: z.string().trim().min(1).max(40),
  vendorName: z.string().trim().max(120),
  odometerKm: z.string().trim(),
  incurredAt: z.string().trim().min(1, "Enter a date"),
});

const expenseSchema = z.object({
  kind: z.enum(["toll", "miscellaneous"]),
  amount: z.string().trim().min(1, "Enter an amount"),
  vehicleId: optionalId,
  description: z.string().trim().min(1, "Enter a description").max(200),
  vendorName: z.string().trim().max(120),
  incurredAt: z.string().trim().min(1, "Enter a date"),
});

const editSchema = z.object({
  id: z.string().regex(uuidPattern),
  amount: z.string().trim().min(1, "Enter an amount"),
  vendorName: z.string().trim().max(120),
  description: z.string().trim().min(1).max(200),
});

export async function recordFuelAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, fuelSchema, (actor, input) =>
    recordFuel(actor.userId, {
      vehicleId: input.vehicleId,
      tripId: input.tripId,
      litres: input.litres,
      amountMinor: toMinorUnits(input.amount) ?? BigInt(0),
      fuelType: input.fuelType,
      vendorName: input.vendorName || null,
      odometerKm: input.odometerKm,
      incurredAt: new Date(input.incurredAt),
    }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/expenses");
  revalidatePath("/fleet");
  return { ok: true, message: "Fuel logged." };
}

export async function recordExpenseAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, expenseSchema, (actor, input) =>
    recordExpense(actor.userId, {
      kind: input.kind,
      amountMinor: toMinorUnits(input.amount) ?? BigInt(0),
      vehicleId: input.vehicleId,
      tripId: null,
      vendorName: input.vendorName || null,
      description: input.description,
      incurredAt: new Date(input.incurredAt),
    }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/expenses");
  return { ok: true, message: "Expense recorded." };
}

export async function updateExpenseAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, editSchema, (actor, input) =>
    updateExpense(actor.userId, input.id, {
      amountMinor: toMinorUnits(input.amount) ?? BigInt(0),
      vendorName: input.vendorName || null,
      description: input.description,
    }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/expenses");
  return { ok: true, message: "Expense updated." };
}

export async function uploadReceiptAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const expenseId = String(formData.get("expenseId") ?? "");
  const file = formData.get("file");
  if (!uuidPattern.test(expenseId) || !(file instanceof File)) return { ok: false, message: "Choose a receipt." };
  const result = await executeProtectedFormOperation(formData, z.object({ expenseId: z.string().regex(uuidPattern) }), (actor) =>
    uploadExpenseDocument(actor.userId, { expenseId, file }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/expenses");
  return { ok: true, message: "Receipt stored." };
}
