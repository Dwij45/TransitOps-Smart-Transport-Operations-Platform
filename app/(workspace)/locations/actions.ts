"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { coordinateProblems } from "@/lib/location-rules";
import {
  archiveLocation,
  createLocation,
  updateLocation,
  type LocationInput,
} from "@/lib/services/locations";
import { executeProtectedFormOperation, type OperationResult } from "@/lib/server-operation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const locationFields = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  typeId: z.string().regex(uuidPattern, "Choose a type"),
  addressLine1: z.string().trim().min(1, "Enter an address").max(160),
  addressLine2: z.string().trim().max(160),
  city: z.string().trim().min(1, "Enter a city").max(80),
  state: z.string().trim().min(1, "Enter a state").max(80),
  postalCode: z.string().trim().max(16),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code"),
  latitude: z.string().trim(),
  longitude: z.string().trim(),
});

function refineCoordinates(
  value: { latitude: string; longitude: string },
  context: z.RefinementCtx,
) {
  for (const problem of coordinateProblems(value.latitude, value.longitude)) {
    context.addIssue({
      code: "custom",
      path: [problem.path],
      message: problem.message,
    });
  }
}

function toLocationInput(value: z.infer<typeof locationFields>): LocationInput {
  return {
    name: value.name,
    typeId: value.typeId,
    addressLine1: value.addressLine1,
    addressLine2: value.addressLine2 || null,
    city: value.city,
    state: value.state,
    postalCode: value.postalCode || null,
    countryCode: value.countryCode,
    latitude: value.latitude || null,
    longitude: value.longitude || null,
  };
}

const createLocationSchema = locationFields.superRefine(refineCoordinates).transform(toLocationInput);

const updateLocationSchema = locationFields
  .extend({ id: z.string().regex(uuidPattern, "Choose a location") })
  .superRefine(refineCoordinates)
  .transform((value) => ({ id: value.id, input: toLocationInput(value) }));

const archiveSchema = z.object({
  id: z.string().regex(uuidPattern, "Choose a location"),
});

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return {
    ok: false,
    message: result.error.message,
    fieldErrors: result.error.fieldErrors,
  };
}

export async function createLocationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, createLocationSchema, (actor, input) =>
    createLocation(actor.userId, input),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/locations");
  revalidatePath("/settings");
  redirect(`/locations/${result.data.id}`);
}

export async function updateLocationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await executeProtectedFormOperation(
    formData,
    updateLocationSchema,
    (actor, input) => updateLocation(actor.userId, input.id, input.input),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/locations");
  revalidatePath(`/locations/${result.data.id}`);
  revalidatePath("/settings");
  return { ok: true, message: "Location saved." };
}

export async function archiveLocationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, archiveSchema, (actor, input) =>
    archiveLocation(actor.userId, input.id),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/locations");
  revalidatePath("/settings");
  redirect("/locations");
}
