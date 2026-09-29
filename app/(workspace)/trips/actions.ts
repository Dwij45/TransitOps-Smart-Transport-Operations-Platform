"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { executeProtectedFormOperation, type OperationResult } from "@/lib/server-operation";
import { createDraftTrip, dispatchDraftTrip, updateDraftTrip, type TripDraftInput } from "@/lib/services/trip-planning";
import { cancelTrip, completeTrip, startTrip } from "@/lib/services/trip-lifecycle";
import { draftTripProblem, endOdometerProblem, quotedRevenueProblem } from "@/lib/trip-rules";
import { toMinorUnits } from "@/lib/vehicle-rules";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const optionalId = z
  .string()
  .trim()
  .refine((value) => value === "" || uuidPattern.test(value), "Choose a valid record")
  .transform((value) => value || null);

const tripFields = z.object({
  originLocationId: z.string().regex(uuidPattern, "Choose an origin"),
  destinationLocationId: z.string().regex(uuidPattern, "Choose a destination"),
  cargoWeightKg: z.string().trim(),
  plannedDistanceKm: z.string().trim(),
  scheduledStartAt: z.string().trim().min(1, "Enter a start time"),
  scheduledEndAt: z.string().trim(),
  quotedRevenue: z.string().trim(),
  customerName: z.string().trim().max(120),
  externalReference: z.string().trim().max(80),
  notes: z.string().trim().max(2000),
  vehicleId: optionalId,
  driverId: optionalId,
});

function toDraft(value: z.infer<typeof tripFields>): TripDraftInput {
  const scheduledStartAt = new Date(value.scheduledStartAt);
  const scheduledEndAt = value.scheduledEndAt ? new Date(value.scheduledEndAt) : null;
  const quotedRevenueMinor = value.quotedRevenue ? toMinorUnits(value.quotedRevenue) : null;
  return {
    originLocationId: value.originLocationId,
    destinationLocationId: value.destinationLocationId,
    cargoWeightKg: value.cargoWeightKg,
    plannedDistanceKm: value.plannedDistanceKm,
    scheduledStartAt,
    scheduledEndAt,
    quotedRevenueMinor,
    customerName: value.customerName || null,
    externalReference: value.externalReference || null,
    notes: value.notes || null,
    vehicleId: value.vehicleId,
    driverId: value.driverId,
  };
}

const draftSchema = tripFields.superRefine((value, context) => {
  const revenue = quotedRevenueProblem(value.quotedRevenue);
  if (revenue) context.addIssue({ code: "custom", path: ["quotedRevenue"], message: revenue });
  const problem = draftTripProblem(toDraft({ ...value, quotedRevenue: revenue ? "" : value.quotedRevenue }));
  if (!problem || problem === "Quoted revenue cannot be negative") return;
  const path = problem.includes("cargo")
    ? "cargoWeightKg"
    : problem.includes("distance")
      ? "plannedDistanceKm"
      : problem.includes("end")
        ? "scheduledEndAt"
        : problem.includes("destination")
          ? "destinationLocationId"
          : "scheduledStartAt";
  context.addIssue({ code: "custom", path: [path], message: problem });
});

const updateSchema = tripFields
  .extend({ id: z.string().regex(uuidPattern, "Choose a trip") })
  .superRefine((value, context) => {
    const revenue = quotedRevenueProblem(value.quotedRevenue);
    if (revenue) context.addIssue({ code: "custom", path: ["quotedRevenue"], message: revenue });
    const problem = draftTripProblem(toDraft({ ...value, quotedRevenue: revenue ? "" : value.quotedRevenue }));
    if (!problem || problem === "Quoted revenue cannot be negative") return;
    const path = problem.includes("cargo")
      ? "cargoWeightKg"
      : problem.includes("distance")
        ? "plannedDistanceKm"
        : problem.includes("end")
          ? "scheduledEndAt"
          : problem.includes("destination")
            ? "destinationLocationId"
            : "scheduledStartAt";
    context.addIssue({ code: "custom", path: [path], message: problem });
  })
  .transform((value) => ({ id: value.id, input: toDraft(value) }));

const createSchema = draftSchema.transform(toDraft);

const dispatchSchema = z.object({
  id: z.string().regex(uuidPattern, "Choose a trip"),
});

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return { ok: false, message: result.error.message, fieldErrors: result.error.fieldErrors };
}

export async function createTripAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, createSchema, (actor, input) =>
    createDraftTrip(actor.userId, input),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/trips");
  redirect(`/trips/${result.data.id}`);
}

export async function updateTripAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, updateSchema, (actor, input) =>
    updateDraftTrip(actor.userId, input.id, input.input),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/trips");
  revalidatePath(`/trips/${result.data.id}`);
  return { ok: true, message: "Trip saved." };
}

export async function dispatchTripAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, dispatchSchema, (actor, input) =>
    dispatchDraftTrip(actor.userId, input.id),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/trips");
  revalidatePath(`/trips/${result.data.id}`);
  revalidatePath("/fleet");
  return { ok: true, message: "Trip dispatched." };
}

const tripIdSchema = z.object({
  id: z.string().regex(uuidPattern, "Choose a trip"),
});

const completeSchema = z
  .object({
    id: z.string().regex(uuidPattern, "Choose a trip"),
    endOdometerKm: z.string().trim(),
    startOdometerKm: z.string().trim(),
    vehicleOdometerKm: z.string().trim(),
    finalRevenue: z.string().trim(),
  })
  .superRefine((value, context) => {
    const odometer = endOdometerProblem(value.endOdometerKm, value.startOdometerKm, value.vehicleOdometerKm);
    if (odometer) context.addIssue({ code: "custom", path: ["endOdometerKm"], message: odometer });
    const revenue = quotedRevenueProblem(value.finalRevenue);
    if (revenue || !value.finalRevenue) {
      context.addIssue({ code: "custom", path: ["finalRevenue"], message: revenue ?? "Enter the final revenue" });
    }
  })
  .transform((value) => ({
    id: value.id,
    endOdometerKm: value.endOdometerKm,
    finalRevenueMinor: toMinorUnits(value.finalRevenue) ?? BigInt(0),
  }));

const cancelSchema = z.object({
  id: z.string().regex(uuidPattern, "Choose a trip"),
  reason: z.string().trim().min(1, "Enter a cancellation reason").max(500),
});

export async function startTripAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, tripIdSchema, (actor, input) =>
    startTrip({ tripId: input.id, actorUserId: actor.userId }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/trips");
  revalidatePath(`/trips/${result.data.id}`);
  revalidatePath("/fleet");
  return { ok: true, message: "Trip started." };
}

export async function completeTripAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, completeSchema, (actor, input) =>
    completeTrip({
      tripId: input.id,
      actorUserId: actor.userId,
      endOdometerKm: input.endOdometerKm,
      finalRevenueMinor: input.finalRevenueMinor,
    }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/trips");
  revalidatePath(`/trips/${result.data.id}`);
  revalidatePath("/fleet");
  return { ok: true, message: "Trip completed." };
}

export async function cancelTripAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, cancelSchema, (actor, input) =>
    cancelTrip({ tripId: input.id, actorUserId: actor.userId, reason: input.reason }),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/trips");
  revalidatePath("/fleet");
  return { ok: true, message: "Trip cancelled." };
}
