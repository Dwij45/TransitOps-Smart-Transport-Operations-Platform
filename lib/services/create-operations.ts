import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
  maintenanceOrder,
  maintenanceServiceType,
} from "@/db/schema/finance";
import { location, vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";

export interface CreateTripInput {
  actorUserId: string;
  originLocationId: string;
  destinationLocationId: string;
  cargoWeightKg: string;
  plannedDistanceKm: string;
  scheduledStartAt: Date;
  scheduledEndAt?: Date;
  quotedRevenueMinor?: bigint;
  currency?: string;
  customerName?: string;
  externalReference?: string;
  notes?: string;
}

export interface CreateMaintenanceOrderInput {
  actorUserId: string;
  vehicleId: string;
  serviceTypeId: string;
  scheduledAt: Date;
  vendorName?: string;
  notes?: string;
}

function formatBusinessCode(prefix: string, sequence: string): string {
  return `${prefix}${sequence.padStart(6, "0")}`;
}

export async function createTrip(input: CreateTripInput) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, input.actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "trip:dispatch")) {
    throw new DomainError("forbidden", "The acting user cannot create trips");
  }

  if (input.originLocationId === input.destinationLocationId) {
    throw new DomainError(
      "validation_failed",
      "Trip origin and destination must differ",
    );
  }

  if (
    Number(input.cargoWeightKg) <= 0 ||
    !Number.isFinite(Number(input.cargoWeightKg)) ||
    Number(input.plannedDistanceKm) <= 0 ||
    !Number.isFinite(Number(input.plannedDistanceKm))
  ) {
    throw new DomainError(
      "validation_failed",
      "Cargo weight and planned distance must be positive",
    );
  }

  if (
    input.scheduledEndAt &&
    input.scheduledEndAt <= input.scheduledStartAt
  ) {
    throw new DomainError(
      "validation_failed",
      "Scheduled end must follow scheduled start",
    );
  }

  if (
    input.quotedRevenueMinor !== undefined &&
    input.quotedRevenueMinor < BigInt(0)
  ) {
    throw new DomainError(
      "validation_failed",
      "Quoted revenue cannot be negative",
    );
  }

  const currency = input.currency ?? "INR";
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new DomainError(
      "validation_failed",
      "Currency must be an ISO 4217 code",
    );
  }

  return db.transaction(async (tx) => {
    const endpoints = await tx
      .select({ id: location.id })
      .from(location)
      .where(
        and(
          sql`${location.id} in (${input.originLocationId}, ${input.destinationLocationId})`,
          sql`${location.archivedAt} is null`,
        ),
      );

    if (new Set(endpoints.map((endpoint) => endpoint.id)).size !== 2) {
      throw new DomainError(
        "validation_failed",
        "Trip requires two active locations",
      );
    }

    const sequenceRows = await tx.execute<{ value: string }>(
      sql`select nextval('trip_code_sequence')::text as value`,
    );
    const sequence = sequenceRows[0]?.value;

    if (!sequence) {
      throw new DomainError("conflict", "Could not allocate a trip code");
    }

    const [created] = await tx
      .insert(trip)
      .values({
        code: formatBusinessCode("TR", sequence),
        originLocationId: input.originLocationId,
        destinationLocationId: input.destinationLocationId,
        cargoWeightKg: input.cargoWeightKg,
        plannedDistanceKm: input.plannedDistanceKm,
        scheduledStartAt: input.scheduledStartAt,
        scheduledEndAt: input.scheduledEndAt,
        quotedRevenueMinor: input.quotedRevenueMinor,
        currency,
        customerName: input.customerName,
        externalReference: input.externalReference,
        notes: input.notes,
      })
      .returning();

    await tx.insert(auditEvent).values({
      actorUserId: input.actorUserId,
      action: "trip.created",
      entityType: "trip",
      entityId: created.id,
      after: {
        code: created.code,
        status: created.status,
        originLocationId: created.originLocationId,
        destinationLocationId: created.destinationLocationId,
      },
    });

    return created;
  });
}

export async function createMaintenanceOrder(
  input: CreateMaintenanceOrderInput,
) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, input.actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "maintenance:manage")) {
    throw new DomainError(
      "forbidden",
      "The acting user cannot create maintenance orders",
    );
  }

  return db.transaction(async (tx) => {
    const [vehicleRecord] = await tx
      .select({ id: vehicle.id, lifecycle: vehicle.lifecycle })
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
        "Retired vehicles cannot receive maintenance orders",
      );
    }

    const [serviceType] = await tx
      .select({ id: maintenanceServiceType.id })
      .from(maintenanceServiceType)
      .where(
        and(
          eq(maintenanceServiceType.id, input.serviceTypeId),
          sql`${maintenanceServiceType.archivedAt} is null`,
        ),
      )
      .limit(1);

    if (!serviceType) {
      throw new DomainError(
        "validation_failed",
        "Maintenance service type is unavailable",
      );
    }

    const sequenceRows = await tx.execute<{ value: string }>(
      sql`select nextval('maintenance_order_code_sequence')::text as value`,
    );
    const sequence = sequenceRows[0]?.value;

    if (!sequence) {
      throw new DomainError(
        "conflict",
        "Could not allocate a maintenance order code",
      );
    }

    const [created] = await tx
      .insert(maintenanceOrder)
      .values({
        code: formatBusinessCode("MO", sequence),
        vehicleId: input.vehicleId,
        serviceTypeId: input.serviceTypeId,
        scheduledAt: input.scheduledAt,
        vendorName: input.vendorName,
        notes: input.notes,
      })
      .returning();

    await tx.insert(auditEvent).values({
      actorUserId: input.actorUserId,
      action: "maintenance.created",
      entityType: "maintenance_order",
      entityId: created.id,
      after: {
        code: created.code,
        status: created.status,
        vehicleId: created.vehicleId,
        serviceTypeId: created.serviceTypeId,
      },
    });

    return created;
  });
}
