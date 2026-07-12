"use server";

import "server-only";

import { z } from "zod";

import { userRoleValues } from "@/db/schema/auth";
import { executeProtectedFormOperation } from "@/lib/server-operation";
import {
  createMaintenanceOrder,
  createTrip,
} from "@/lib/services/create-operations";
import { dispatchTrip } from "@/lib/services/dispatch-trip";
import { logFuel } from "@/lib/services/log-fuel";
import {
  cancelMaintenance,
  completeMaintenance,
  startMaintenance,
} from "@/lib/services/maintenance-lifecycle";
import {
  inviteStaffUser,
  unlockStaffUser,
} from "@/lib/services/staff-management";
import {
  cancelTrip,
  completeTrip,
  startTrip,
} from "@/lib/services/trip-lifecycle";

const uuid = z.string().uuid("Select a valid record.");
const currency = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Use a three-letter ISO currency code.");
const decimal = z
  .string()
  .trim()
  .max(24, "Enter a smaller number.")
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "Enter a valid decimal number.")
  .refine((value) => Number.isFinite(Number(value)), "Enter a finite number.");
const positiveDecimal = decimal.refine(
  (value) => Number(value) > 0,
  "Enter a value greater than zero.",
);
const nonNegativeDecimal = decimal.refine(
  (value) => Number(value) >= 0,
  "Enter a non-negative value.",
);
const amountMinor = z
  .string()
  .trim()
  .regex(/^\d+$/, "Enter an amount in minor units.")
  .transform((value) => BigInt(value))
  .refine(
    (value) => value <= BigInt("9223372036854775807"),
    "Enter a smaller amount.",
  );
const positiveAmountMinor = amountMinor.refine(
  (value) => value > BigInt(0),
  "Enter an amount greater than zero.",
);
const requiredText = (label: string, maximum = 2_000) =>
  z.string().trim().min(1, `${label} is required.`).max(maximum);
const optionalText = (maximum = 2_000) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );
const timestamp = z
  .string()
  .datetime({ offset: true, error: "Use an ISO timestamp with a timezone." })
  .transform((value) => new Date(value));
const optionalTimestamp = z.preprocess(
  (value) => (value === "" ? undefined : value),
  timestamp.optional(),
);
const optionalAmountMinor = z.preprocess(
  (value) => (value === "" ? undefined : value),
  amountMinor.optional(),
);
const optionalCurrency = z.preprocess(
  (value) => (value === "" ? undefined : value),
  currency.optional(),
);

const createTripSchema = z
  .object({
    originLocationId: uuid,
    destinationLocationId: uuid,
    cargoWeightKg: positiveDecimal,
    plannedDistanceKm: positiveDecimal,
    scheduledStartAt: timestamp,
    scheduledEndAt: optionalTimestamp,
    quotedRevenueMinor: optionalAmountMinor,
    currency: optionalCurrency,
    customerName: optionalText(300),
    externalReference: optionalText(300),
    notes: optionalText(4_000),
  })
  .refine((input) => input.originLocationId !== input.destinationLocationId, {
    message: "Origin and destination must differ.",
    path: ["destinationLocationId"],
  })
  .refine(
    (input) =>
      !input.scheduledEndAt || input.scheduledEndAt > input.scheduledStartAt,
    {
      message: "Scheduled end must follow scheduled start.",
      path: ["scheduledEndAt"],
    },
  );

const createMaintenanceOrderSchema = z.object({
  vehicleId: uuid,
  serviceTypeId: uuid,
  scheduledAt: timestamp,
  vendorName: optionalText(300),
  notes: optionalText(4_000),
});

const dispatchTripSchema = z.object({
  tripId: uuid,
  vehicleId: uuid,
  driverId: uuid,
});

const tripIdSchema = z.object({ tripId: uuid });

const completeTripSchema = tripIdSchema.extend({
  endOdometerKm: nonNegativeDecimal,
  finalRevenueMinor: amountMinor,
});

const cancelTripSchema = tripIdSchema.extend({
  reason: requiredText("A cancellation reason", 1_000),
});

const maintenanceOrderIdSchema = z.object({ maintenanceOrderId: uuid });

const completeMaintenanceSchema = maintenanceOrderIdSchema.extend({
  closingOdometerKm: nonNegativeDecimal,
});

const cancelMaintenanceSchema = maintenanceOrderIdSchema.extend({
  reason: requiredText("A cancellation reason", 1_000),
});

const logFuelSchema = z.object({
  vehicleId: uuid,
  tripId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    uuid.optional(),
  ),
  amountMinor: positiveAmountMinor,
  currency,
  incurredAt: timestamp,
  litres: positiveDecimal,
  odometerKm: nonNegativeDecimal,
  fuelType: requiredText("Fuel type", 80),
  vendorName: optionalText(300),
  externalReference: optionalText(300),
});

const inviteStaffSchema = z.object({
  name: requiredText("Staff name", 200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(userRoleValues),
});

const unlockStaffSchema = z.object({
  targetUserId: requiredText("Staff user", 255),
});

export async function createTripAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    createTripSchema,
    async (actor, input) => {
      const trip = await createTrip({ ...input, actorUserId: actor.userId });

      return { id: trip.id, code: trip.code, status: trip.status };
    },
  );
}

export async function createMaintenanceOrderAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    createMaintenanceOrderSchema,
    async (actor, input) => {
      const order = await createMaintenanceOrder({
        ...input,
        actorUserId: actor.userId,
      });

      return { id: order.id, code: order.code, status: order.status };
    },
  );
}

export async function dispatchTripAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    dispatchTripSchema,
    async (actor, input) => {
      const trip = await dispatchTrip({ ...input, actorUserId: actor.userId });

      return { id: trip.id, code: trip.code, status: trip.status };
    },
  );
}

export async function startTripAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    tripIdSchema,
    async (actor, input) => {
      const trip = await startTrip({ ...input, actorUserId: actor.userId });

      return { id: trip.id, code: trip.code, status: trip.status };
    },
  );
}

export async function completeTripAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    completeTripSchema,
    async (actor, input) => {
      const trip = await completeTrip({ ...input, actorUserId: actor.userId });

      return { id: trip.id, code: trip.code, status: trip.status };
    },
  );
}

export async function cancelTripAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    cancelTripSchema,
    async (actor, input) => {
      const trip = await cancelTrip({ ...input, actorUserId: actor.userId });

      return { id: trip.id, code: trip.code, status: trip.status };
    },
  );
}

export async function startMaintenanceAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    maintenanceOrderIdSchema,
    async (actor, input) => {
      const order = await startMaintenance({
        ...input,
        actorUserId: actor.userId,
      });

      return { id: order.id, code: order.code, status: order.status };
    },
  );
}

export async function completeMaintenanceAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    completeMaintenanceSchema,
    async (actor, input) => {
      const result = await completeMaintenance({
        ...input,
        actorUserId: actor.userId,
      });

      return {
        id: result.order.id,
        code: result.order.code,
        status: result.order.status,
        expenseId: result.expense.id,
      };
    },
  );
}

export async function cancelMaintenanceAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    cancelMaintenanceSchema,
    async (actor, input) => {
      const order = await cancelMaintenance({
        ...input,
        actorUserId: actor.userId,
      });

      return { id: order.id, code: order.code, status: order.status };
    },
  );
}

export async function logFuelAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    logFuelSchema,
    async (actor, input) => {
      const result = await logFuel({ ...input, actorUserId: actor.userId });

      return {
        expenseId: result.expense.id,
        fuelEntryId: result.fuelEntry.id,
        vehicleId: result.expense.vehicleId,
      };
    },
  );
}

export async function inviteStaffUserAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    inviteStaffSchema,
    async (actor, input) => {
      const invitation = await inviteStaffUser({
        ...input,
        actorUserId: actor.userId,
      });

      return {
        userId: invitation.user.id,
        expiresAt: invitation.expiresAt.toISOString(),
      };
    },
  );
}

export async function unlockStaffUserAction(formData: FormData) {
  return executeProtectedFormOperation(
    formData,
    unlockStaffSchema,
    async (actor, input) => {
      const user = await unlockStaffUser(actor.userId, input.targetUserId);

      return { userId: user.id };
    },
  );
}
