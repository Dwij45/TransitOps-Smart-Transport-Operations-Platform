import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";
import { withSerializableRetry } from "@/lib/transaction";
import { auditMetadata } from "@/lib/audit";

interface TripActionInput {
  tripId: string;
  actorUserId: string;
}

export interface CompleteTripInput extends TripActionInput {
  endOdometerKm: string;
  finalRevenueMinor: bigint;
}

export interface CancelTripInput extends TripActionInput {
  reason: string;
}

async function assertTripOperator(actorUserId: string): Promise<void> {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "trip:operate")) {
    throw new DomainError(
      "forbidden",
      "The acting user cannot operate trips",
    );
  }
}

export async function startTrip(input: TripActionInput) {
  await assertTripOperator(input.actorUserId);

  return withSerializableRetry(() => db.transaction(
    async (tx) => {
      const [tripRecord] = await tx
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId))
        .for("update")
        .limit(1);

      if (!tripRecord) {
        throw new DomainError("not_found", "Trip not found");
      }

      if (tripRecord.status !== "dispatched") {
        throw new DomainError(
          "invalid_state",
          "Only dispatched trips can be started",
          { currentStatus: tripRecord.status },
        );
      }

      if (!tripRecord.vehicleId || !tripRecord.driverId) {
        throw new DomainError(
          "validation_failed",
          "Trip requires a vehicle and driver before starting",
        );
      }

      const [vehicleRecord] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, tripRecord.vehicleId))
        .for("update")
        .limit(1);

      if (!vehicleRecord || vehicleRecord.lifecycle !== "active") {
        throw new DomainError(
          "validation_failed",
          "Assigned vehicle is not active",
        );
      }

      const startedAt = new Date();
      const [updated] = await tx
        .update(trip)
        .set({
          status: "in_progress",
          actualStartAt: startedAt,
          startOdometerKm: vehicleRecord.currentOdometerKm,
        })
        .where(and(eq(trip.id, input.tripId), eq(trip.status, "dispatched")))
        .returning();

      if (!updated) {
        throw new DomainError("conflict", "Trip changed while starting");
      }

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId: input.actorUserId,
        action: "trip.started",
        entityType: "trip",
        entityId: updated.id,
        before: { status: tripRecord.status },
        after: {
          status: updated.status,
          actualStartAt: startedAt.toISOString(),
          startOdometerKm: updated.startOdometerKm,
        },
      });

      return updated;
    },
    { isolationLevel: "serializable", accessMode: "read write" },
  ));
}

export async function completeTrip(input: CompleteTripInput) {
  await assertTripOperator(input.actorUserId);

  if (input.finalRevenueMinor < BigInt(0)) {
    throw new DomainError(
      "validation_failed",
      "Final revenue cannot be negative",
    );
  }

  return withSerializableRetry(() => db.transaction(
    async (tx) => {
      const [tripRecord] = await tx
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId))
        .for("update")
        .limit(1);

      if (!tripRecord) {
        throw new DomainError("not_found", "Trip not found");
      }

      if (
        tripRecord.status !== "in_progress" ||
        !tripRecord.vehicleId ||
        !tripRecord.startOdometerKm
      ) {
        throw new DomainError(
          "invalid_state",
          "Only in-progress trips can be completed",
          { currentStatus: tripRecord.status },
        );
      }

      const [vehicleRecord] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, tripRecord.vehicleId))
        .for("update")
        .limit(1);

      if (!vehicleRecord) {
        throw new DomainError("not_found", "Assigned vehicle not found");
      }

      const endOdometerKm = Number(input.endOdometerKm);
      if (
        !Number.isFinite(endOdometerKm) ||
        endOdometerKm < Number(tripRecord.startOdometerKm) ||
        endOdometerKm < Number(vehicleRecord.currentOdometerKm)
      ) {
        throw new DomainError(
          "validation_failed",
          "End odometer cannot precede the trip or vehicle odometer",
          {
            startOdometerKm: tripRecord.startOdometerKm,
            vehicleOdometerKm: vehicleRecord.currentOdometerKm,
          },
        );
      }

      const completedAt = new Date();
      const [updated] = await tx
        .update(trip)
        .set({
          status: "completed",
          actualEndAt: completedAt,
          endOdometerKm: input.endOdometerKm,
          finalRevenueMinor: input.finalRevenueMinor,
        })
        .where(and(eq(trip.id, input.tripId), eq(trip.status, "in_progress")))
        .returning();

      if (!updated) {
        throw new DomainError("conflict", "Trip changed while completing");
      }

      await tx
        .update(vehicle)
        .set({ currentOdometerKm: input.endOdometerKm })
        .where(eq(vehicle.id, vehicleRecord.id));

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId: input.actorUserId,
        action: "trip.completed",
        entityType: "trip",
        entityId: updated.id,
        before: {
          status: tripRecord.status,
          vehicleOdometerKm: vehicleRecord.currentOdometerKm,
        },
        after: {
          status: updated.status,
          actualEndAt: completedAt.toISOString(),
          endOdometerKm: updated.endOdometerKm,
          finalRevenueMinor: updated.finalRevenueMinor?.toString(),
        },
      });

      return updated;
    },
    { isolationLevel: "serializable", accessMode: "read write" },
  ));
}

export async function cancelTrip(input: CancelTripInput) {
  await assertTripOperator(input.actorUserId);

  const reason = input.reason.trim();
  if (!reason) {
    throw new DomainError(
      "validation_failed",
      "A cancellation reason is required",
    );
  }

  return db.transaction(async (tx) => {
    const [tripRecord] = await tx
      .select()
      .from(trip)
      .where(eq(trip.id, input.tripId))
      .for("update")
      .limit(1);

    if (!tripRecord) {
      throw new DomainError("not_found", "Trip not found");
    }

    if (
      tripRecord.status !== "draft" &&
      tripRecord.status !== "dispatched"
    ) {
      throw new DomainError(
        "invalid_state",
        "Only draft or dispatched trips can be cancelled",
        { currentStatus: tripRecord.status },
      );
    }

    const [updated] = await tx
      .update(trip)
      .set({ status: "cancelled", cancellationReason: reason })
      .where(
        and(
          eq(trip.id, input.tripId),
          inArray(trip.status, ["draft", "dispatched"]),
        ),
      )
      .returning();

    if (!updated) {
      throw new DomainError("conflict", "Trip changed while cancelling");
    }

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId: input.actorUserId,
      action: "trip.cancelled",
      entityType: "trip",
      entityId: updated.id,
      before: { status: tripRecord.status },
      after: { status: updated.status, cancellationReason: reason },
    });

    return updated;
  });
}
