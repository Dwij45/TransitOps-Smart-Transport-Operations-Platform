"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import {
  archiveLookup,
  createLookup,
  lookupKinds,
  updateOperatorSettings,
} from "@/lib/services/operator-settings";
import {
  executeProtectedFormOperation,
  type OperationResult,
} from "@/lib/server-operation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const settingsSchema = z.object({
  operatorName: z.string().trim().min(1, "Enter the operator name").max(120),
  defaultDepotId: z.union([z.literal(""), z.string().regex(uuidPattern, "Choose a depot")]),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code"),
  timezone: z
    .string()
    .trim()
    .min(1, "Enter a timezone")
    .max(64)
    .regex(/^[A-Za-z0-9_+\-/]+$/, "Enter a timezone such as Asia/Kolkata"),
  distanceUnit: z.enum(["kilometre", "mile"]),
  weightUnit: z.enum(["kilogram", "pound"]),
});

const lookupSchema = z
  .object({
    kind: z.enum(lookupKinds),
    name: z.string().trim().min(1, "Enter a name").max(80),
    description: z.string().trim().max(240).optional(),
    defaultPoints: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.kind !== "safety_event_type") return;
    if (!value.defaultPoints || !/^-?\d+(\.\d{1,2})?$/.test(value.defaultPoints)) {
      context.addIssue({
        code: "custom",
        path: ["defaultPoints"],
        message: "Enter points with up to two decimal places",
      });
      return;
    }
    const points = Number(value.defaultPoints);
    if (points < -999.99 || points > 999.99) {
      context.addIssue({
        code: "custom",
        path: ["defaultPoints"],
        message: "Points must be between -999.99 and 999.99",
      });
    }
  });

const archiveSchema = z.object({
  kind: z.enum(lookupKinds),
  id: z.string().regex(uuidPattern, "Choose a classification"),
});

function toActionState(result: OperationResult<unknown>, success: string): ActionState {
  if (result.ok) {
    revalidatePath("/settings");
    return { ok: true, message: success };
  }

  return {
    ok: false,
    message: result.error.message,
    fieldErrors: result.error.fieldErrors,
  };
}

export async function updateSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await executeProtectedFormOperation(
    formData,
    settingsSchema,
    (actor, input) =>
      updateOperatorSettings(actor.userId, {
        operatorName: input.operatorName,
        defaultDepotId: input.defaultDepotId || null,
        currency: input.currency,
        timezone: input.timezone,
        distanceUnit: input.distanceUnit,
        weightUnit: input.weightUnit,
      }),
  );

  return toActionState(result, "Settings saved.");
}

export async function createLookupAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await executeProtectedFormOperation(
    formData,
    lookupSchema,
    (actor, input) =>
      createLookup(actor.userId, {
        kind: input.kind,
        name: input.name,
        description: input.description || null,
        defaultPoints: input.defaultPoints || null,
      }),
  );

  return toActionState(result, "Classification added.");
}

export async function archiveLookupAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await executeProtectedFormOperation(
    formData,
    archiveSchema,
    (actor, input) => archiveLookup(actor.userId, input.kind, input.id),
  );

  return toActionState(result, "Classification archived. It cannot be selected for new records.");
}
