import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { expense, fuelEntry } from "@/db/schema/finance";
import { vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";
import { withSerializableRetry } from "@/lib/transaction";
import { auditMetadata } from "@/lib/audit";

export interface LogFuelInput {
  actorUserId: string;
  vehicleId: string;
  tripId?: string;
  amountMinor: bigint;
  currency: string;
  incurredAt: Date;
  litres: string;
  odometerKm: string;
  fuelType: string;
  vendorName?: string;
  externalReference?: string;
}

export async function logFuel(input: LogFuelInput) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, input.actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "expense:manage")) {
    throw new DomainError(
      "forbidden",
      "The acting user cannot manage expenses",
    );
  }

  if (input.amountMinor <= BigInt(0)) {
    throw new DomainError(
      "validation_failed",
      "Fuel amount must be positive",
    );
  }

  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new DomainError(
      "validation_failed",
      "Currency must be an ISO 4217 code",
    );
  }

  if (Number(input.litres) <= 0 || !Number.isFinite(Number(input.litres))) {
    throw new DomainError("validation_failed", "Fuel litres must be positive");
  }

  const odometerKm = Number(input.odometerKm);
  if (!Number.isFinite(odometerKm) || odometerKm < 0) {
    throw new DomainError(
      "validation_failed",
      "Fuel odometer must be nonnegative",
    );
  }

  const fuelType = input.fuelType.trim().toLowerCase();
  if (!fuelType) {
    throw new DomainError("validation_failed", "Fuel type is required");
  }

  return withSerializableRetry(() => db.transaction(
    async (tx) => {
      const [vehicleRecord] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, input.vehicleId))
        .for("update")
        .limit(1);

      if (!vehicleRecord) {
        throw new DomainError("not_found", "Vehicle not found");
      }

      if (vehicleRecord.lifecycle === "retired") {
        throw new DomainError(
          "validation_failed",
          "Fuel cannot be logged for a retired vehicle",
        );
      }

      if (input.tripId) {
        const [tripRecord] = await tx
          .select({ vehicleId: trip.vehicleId })
          .from(trip)
          .where(eq(trip.id, input.tripId))
          .for("update")
          .limit(1);

        if (!tripRecord) {
          throw new DomainError("not_found", "Linked trip not found");
        }

        if (tripRecord.vehicleId !== input.vehicleId) {
          throw new DomainError(
            "validation_failed",
            "Fuel vehicle does not match the linked trip",
          );
        }
      }

      const [latestFuel] = await tx
        .select({ odometerKm: fuelEntry.odometerKm })
        .from(fuelEntry)
        .innerJoin(expense, eq(fuelEntry.expenseId, expense.id))
        .where(
          and(
            eq(expense.vehicleId, input.vehicleId),
            eq(expense.kind, "fuel"),
          ),
        )
        .orderBy(desc(fuelEntry.odometerKm))
        .for("update")
        .limit(1);

      const minimumOdometerKm = Math.max(
        Number(vehicleRecord.currentOdometerKm),
        latestFuel ? Number(latestFuel.odometerKm) : 0,
      );

      if (odometerKm < minimumOdometerKm) {
        throw new DomainError(
          "validation_failed",
          "Fuel odometer cannot precede an existing vehicle reading",
          { minimumOdometerKm },
        );
      }

      const [postedExpense] = await tx
        .insert(expense)
        .values({
          kind: "fuel",
          amountMinor: input.amountMinor,
          currency: input.currency,
          incurredAt: input.incurredAt,
          vehicleId: input.vehicleId,
          tripId: input.tripId,
          vendorName: input.vendorName,
          description: `Fuel - ${fuelType}`,
          externalReference: input.externalReference,
        })
        .returning();

      const [entry] = await tx
        .insert(fuelEntry)
        .values({
          expenseId: postedExpense.id,
          litres: input.litres,
          odometerKm: input.odometerKm,
          fuelType,
        })
        .returning();

      if (odometerKm > Number(vehicleRecord.currentOdometerKm)) {
        await tx
          .update(vehicle)
          .set({ currentOdometerKm: input.odometerKm })
          .where(eq(vehicle.id, input.vehicleId));
      }

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId: input.actorUserId,
        action: "fuel.logged",
        entityType: "expense",
        entityId: postedExpense.id,
        after: {
          kind: postedExpense.kind,
          vehicleId: postedExpense.vehicleId,
          tripId: postedExpense.tripId,
          amountMinor: postedExpense.amountMinor.toString(),
          currency: postedExpense.currency,
          litres: entry.litres,
          odometerKm: entry.odometerKm,
          fuelType: entry.fuelType,
        },
      });

      return { expense: postedExpense, fuelEntry: entry };
    },
    { isolationLevel: "serializable", accessMode: "read write" },
  ));
}
