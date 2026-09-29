import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { auditEvent } from "@/db/schema/platform";
import { driver, driverLicense, vehicle } from "@/db/schema/fleet";
import { trip } from "@/db/schema/trips";
import { driverDispatchBlock } from "@/lib/driver-rules";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";
import { withSerializableRetry } from "@/lib/transaction";
import { auditMetadata } from "@/lib/audit";

export interface DispatchTripInput {
  tripId: string;
  vehicleId: string;
  driverId: string;
  actorUserId: string;
}

export interface DispatchTripResult {
  id: string;
  code: string;
  status: "dispatched";
  vehicleId: string;
  driverId: string;
}

export async function dispatchTrip(
  input: DispatchTripInput,
): Promise<DispatchTripResult> {
  return withSerializableRetry(() => db.transaction(
    async (tx) => {
      const [actor] = await tx
        .select({ role: user.role })
        .from(user)
        .where(eq(user.id, input.actorUserId))
        .limit(1);

      if (!actor) {
        throw new DomainError("forbidden", "The acting user does not exist");
      }

      if (!hasPermission(actor.role, "trip:dispatch")) {
        throw new DomainError(
          "forbidden",
          "The acting user cannot dispatch trips",
        );
      }

      const [tripRecord] = await tx
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId))
        .for("update")
        .limit(1);

      if (!tripRecord) {
        throw new DomainError("not_found", "Trip not found");
      }

      if (tripRecord.status !== "draft") {
        throw new DomainError(
          "invalid_state",
          "Only draft trips can be dispatched",
          { currentStatus: tripRecord.status },
        );
      }

      const [vehicleRecord] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, input.vehicleId))
        .for("update")
        .limit(1);

      if (!vehicleRecord) {
        throw new DomainError("not_found", "Vehicle not found");
      }

      if (vehicleRecord.lifecycle !== "active") {
        throw new DomainError(
          "validation_failed",
          "Vehicle must be active to dispatch",
          { lifecycle: vehicleRecord.lifecycle },
        );
      }

      if (Number(tripRecord.cargoWeightKg) > Number(vehicleRecord.capacityKg)) {
        throw new DomainError(
          "validation_failed",
          "Cargo weight exceeds vehicle capacity",
          {
            cargoWeightKg: tripRecord.cargoWeightKg,
            capacityKg: vehicleRecord.capacityKg,
          },
        );
      }

      const [driverRecord] = await tx
        .select()
        .from(driver)
        .where(eq(driver.id, input.driverId))
        .for("update")
        .limit(1);

      if (!driverRecord) {
        throw new DomainError("not_found", "Driver not found");
      }

      const [license] = await tx
        .select()
        .from(driverLicense)
        .where(and(eq(driverLicense.driverId, input.driverId), eq(driverLicense.isPrimary, true)))
        .for("update")
        .limit(1);

      const block = driverDispatchBlock({
        archived: Boolean(driverRecord.archivedAt),
        dutyState: driverRecord.dutyState,
        licence: license ? { verifiedAt: license.verifiedAt, expiresOn: license.expiresOn } : null,
        today: new Date(),
      });
      if (block) {
        throw new DomainError("validation_failed", block, { dutyState: driverRecord.dutyState });
      }

      const [vehicleConflict] = await tx
        .select({ id: trip.id })
        .from(trip)
        .where(
          and(
            ne(trip.id, input.tripId),
            eq(trip.vehicleId, input.vehicleId),
            inArray(trip.status, ["dispatched", "in_progress"]),
          ),
        )
        .for("update")
        .limit(1);

      if (vehicleConflict) {
        throw new DomainError(
          "conflict",
          "Vehicle already has an active assignment",
        );
      }

      const [driverConflict] = await tx
        .select({ id: trip.id })
        .from(trip)
        .where(
          and(
            ne(trip.id, input.tripId),
            eq(trip.driverId, input.driverId),
            inArray(trip.status, ["dispatched", "in_progress"]),
          ),
        )
        .for("update")
        .limit(1);

      if (driverConflict) {
        throw new DomainError(
          "conflict",
          "Driver already has an active assignment",
        );
      }

      const [updated] = await tx
        .update(trip)
        .set({
          status: "dispatched",
          vehicleId: input.vehicleId,
          driverId: input.driverId,
        })
        .where(and(eq(trip.id, input.tripId), eq(trip.status, "draft")))
        .returning({
          id: trip.id,
          code: trip.code,
          status: trip.status,
          vehicleId: trip.vehicleId,
          driverId: trip.driverId,
        });

      if (
        !updated ||
        updated.status !== "dispatched" ||
        !updated.vehicleId ||
        !updated.driverId
      ) {
        throw new DomainError("conflict", "Trip changed during dispatch");
      }

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId: input.actorUserId,
        action: "trip.dispatched",
        entityType: "trip",
        entityId: updated.id,
        before: {
          status: tripRecord.status,
          vehicleId: tripRecord.vehicleId,
          driverId: tripRecord.driverId,
        },
        after: {
          status: updated.status,
          vehicleId: updated.vehicleId,
          driverId: updated.driverId,
        },
      });

      return updated as DispatchTripResult;
    },
    { isolationLevel: "serializable", accessMode: "read write" },
  ));
}
