"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import {
  createVehicle,
  retireVehicle,
  updateVehicle,
} from "@/lib/services/vehicles";
import { executeProtectedFormOperation, type OperationResult } from "@/lib/server-operation";
import { normalizeVehicleCode, toMinorUnits, vehicleCodeProblem } from "@/lib/vehicle-rules";
import { vehicleLifecycles } from "@/lib/vehicle-status";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const vehicleFields = z.object({
  registrationNumber: z.string().trim().min(1, "Enter a registration number").max(32),
  fleetNumber: z.string().trim().max(32),
  name: z.string().trim().min(1, "Enter a name").max(120),
  manufacturer: z.string().trim().max(80),
  model: z.string().trim().max(80),
  typeId: z.string().regex(uuidPattern, "Choose a type"),
  capacityKg: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter capacity with up to two decimal places")
    .refine((value) => Number(value) > 0, "Capacity must be greater than zero"),
  currentOdometerKm: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter mileage with up to two decimal places"),
  acquisitionCost: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{1,12}(\.\d{1,2})?$/.test(value), "Enter a cost with up to two decimal places"),
  acquisitionCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code"),
  acquiredOn: z.string().trim().refine((value) => value === "" || isIsoDate(value), "Enter a valid date"),
});

function refineIdentity(
  value: { registrationNumber: string; fleetNumber: string },
  context: z.RefinementCtx,
) {
  const registration = normalizeVehicleCode(value.registrationNumber);
  const fleet = normalizeVehicleCode(value.fleetNumber);
  const registrationProblem = vehicleCodeProblem(registration, true);
  const fleetProblem = vehicleCodeProblem(fleet, false);
  if (registrationProblem) {
    context.addIssue({
      code: "custom",
      path: ["registrationNumber"],
      message: registrationProblem,
    });
  }
  if (fleetProblem) {
    context.addIssue({
      code: "custom",
      path: ["fleetNumber"],
      message: fleetProblem,
    });
  }
}

function toVehicleInput(value: z.infer<typeof vehicleFields>) {
  return {
    registrationNumber: normalizeVehicleCode(value.registrationNumber),
    fleetNumber: normalizeVehicleCode(value.fleetNumber) || null,
    name: value.name,
    manufacturer: value.manufacturer || null,
    model: value.model || null,
    typeId: value.typeId,
    capacityKg: value.capacityKg,
    currentOdometerKm: value.currentOdometerKm,
    acquisitionCostMinor: toMinorUnits(value.acquisitionCost || null),
    acquisitionCurrency: value.acquisitionCurrency,
    acquiredOn: value.acquiredOn ? parseDate(value.acquiredOn) : null,
  };
}

const createVehicleSchema = vehicleFields.superRefine(refineIdentity).transform(toVehicleInput);

const updateVehicleSchema = vehicleFields
  .extend({
    id: z.string().regex(uuidPattern, "Choose a vehicle"),
    lifecycle: z.enum(vehicleLifecycles),
  })
  .superRefine(refineIdentity)
  .transform((value) => ({
    id: value.id,
    input: { ...toVehicleInput(value), lifecycle: value.lifecycle },
  }));

const idSchema = z.object({
  id: z.string().regex(uuidPattern, "Choose a vehicle"),
});

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return {
    ok: false,
    message: result.error.message,
    fieldErrors: result.error.fieldErrors,
  };
}

export async function createVehicleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, createVehicleSchema, (actor, input) =>
    createVehicle(actor.userId, input),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/fleet");
  redirect(`/fleet/${result.data.id}`);
}

export async function updateVehicleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, updateVehicleSchema, (actor, input) =>
    updateVehicle(actor.userId, input.id, input.input),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${result.data.id}`);
  return { ok: true, message: "Vehicle saved." };
}

export async function retireVehicleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, idSchema, (actor, input) =>
    retireVehicle(actor.userId, input.id),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${result.data.id}`);
  return { ok: true, message: "Vehicle retired. It is no longer eligible for dispatch." };
}
