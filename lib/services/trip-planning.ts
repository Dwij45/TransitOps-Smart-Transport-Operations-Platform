import "server-only";

import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { driver, driverLicense, location, vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { auditMetadata } from "@/lib/audit";
import { isUniqueViolation } from "@/lib/db-error";
import { DomainError } from "@/lib/domain-error";
import { canPlanTrips } from "@/lib/registry-access";
import { dispatchTrip } from "@/lib/services/dispatch-trip";
import { listSelectableLocations, type SelectableLocation } from "@/lib/services/locations";
import {
  assignmentConflictMessage,
  draftTripProblem,
  driverAssignmentBlock,
  tripStatusLabels,
  vehicleAssignmentBlock,
  type TripStatus,
} from "@/lib/trip-rules";
import { driverDispatchBlock, type DriverDutyState } from "@/lib/driver-rules";
import type { VehicleLifecycle } from "@/lib/vehicle-status";

const pageSize = 8;
const origin = alias(location, "trip_origin");
const destination = alias(location, "trip_destination");

export interface TripDraftInput {
  originLocationId: string;
  destinationLocationId: string;
  cargoWeightKg: string;
  plannedDistanceKm: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date | null;
  quotedRevenueMinor: bigint | null;
  customerName: string | null;
  externalReference: string | null;
  notes: string | null;
  vehicleId: string | null;
  driverId: string | null;
}

export interface TripChoice {
  id: string;
  label: string;
  eligible: boolean;
}

export interface TripListRow {
  id: string;
  code: string;
  status: TripStatus;
  statusLabel: string;
  originName: string;
  destinationName: string;
  customerName: string | null;
  scheduledStartAt: Date;
}

export interface TripDetail extends TripDraftInput {
  id: string;
  code: string;
  status: TripStatus;
  statusLabel: string;
  currency: string;
  originName: string;
  destinationName: string;
  vehicleLabel: string | null;
  driverLabel: string | null;
}

async function assertPlanner(actorUserId: string) {
  const [actor] = await db.select({ role: user.role }).from(user).where(eq(user.id, actorUserId)).limit(1);
  if (!actor || !canPlanTrips(actor.role)) {
    throw new DomainError("forbidden", "The acting user cannot plan trips");
  }
}

function liveTrip(column: typeof trip.vehicleId | typeof trip.driverId, id: string, tripId?: string) {
  return and(
    eq(column, id),
    inArray(trip.status, ["dispatched", "in_progress"]),
    tripId ? ne(trip.id, tripId) : undefined,
  );
}

async function assertActiveLocations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  originLocationId: string,
  destinationLocationId: string,
) {
  const rows = await tx
    .select({ id: location.id, archivedAt: location.archivedAt })
    .from(location)
    .where(inArray(location.id, [originLocationId, destinationLocationId]));
  const active = new Set(rows.filter((row) => !row.archivedAt).map((row) => row.id));
  if (!active.has(originLocationId) || !active.has(destinationLocationId)) {
    throw new DomainError("validation_failed", "Trip requires two active locations");
  }
}

async function assertAssignment(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: TripDraftInput,
  tripId?: string,
) {
  if (input.vehicleId) {
    const [record] = await tx
      .select({ lifecycle: vehicle.lifecycle, capacityKg: vehicle.capacityKg })
      .from(vehicle)
      .where(eq(vehicle.id, input.vehicleId))
      .for("update")
      .limit(1);
    const [conflict] = record
      ? await tx.select({ id: trip.id }).from(trip).where(liveTrip(trip.vehicleId, input.vehicleId, tripId)).limit(1)
      : [];
    const block = vehicleAssignmentBlock({
      found: Boolean(record),
      lifecycle: record?.lifecycle ?? null,
      cargoWeightKg: input.cargoWeightKg,
      capacityKg: record?.capacityKg ?? null,
      liveTrip: Boolean(conflict),
    });
    if (block) throw new DomainError("validation_failed", block);
  }

  if (input.driverId) {
    const [record] = await tx
      .select({ archivedAt: driver.archivedAt, dutyState: driver.dutyState })
      .from(driver)
      .where(eq(driver.id, input.driverId))
      .for("update")
      .limit(1);
    const [licence] = record
      ? await tx
          .select({ verifiedAt: driverLicense.verifiedAt, expiresOn: driverLicense.expiresOn })
          .from(driverLicense)
          .where(and(eq(driverLicense.driverId, input.driverId), eq(driverLicense.isPrimary, true)))
          .limit(1)
      : [];
    const [conflict] = record
      ? await tx.select({ id: trip.id }).from(trip).where(liveTrip(trip.driverId, input.driverId, tripId)).limit(1)
      : [];
    const block = driverAssignmentBlock({
      found: Boolean(record),
      liveTrip: Boolean(conflict),
      dispatchBlock: record
        ? driverDispatchBlock({
            archived: Boolean(record.archivedAt),
            dutyState: record.dutyState as DriverDutyState,
            licence: licence
              ? {
                  verifiedAt: licence.verifiedAt,
                  expiresOn: licence.expiresOn instanceof Date ? licence.expiresOn : new Date(licence.expiresOn),
                }
              : null,
            today: new Date(),
          })
        : null,
    });
    if (block) throw new DomainError("validation_failed", block);
  }
}

function tripValues(input: TripDraftInput) {
  return {
    originLocationId: input.originLocationId,
    destinationLocationId: input.destinationLocationId,
    cargoWeightKg: input.cargoWeightKg,
    plannedDistanceKm: input.plannedDistanceKm,
    scheduledStartAt: input.scheduledStartAt,
    scheduledEndAt: input.scheduledEndAt,
    quotedRevenueMinor: input.quotedRevenueMinor,
    customerName: input.customerName,
    externalReference: input.externalReference,
    notes: input.notes,
    vehicleId: input.vehicleId,
    driverId: input.driverId,
  };
}

export async function searchTrips(
  actorUserId: string,
  query: { q: string; status: TripStatus | "all"; page: number },
): Promise<{ rows: TripListRow[]; page: number; pageCount: number }> {
  await assertPlanner(actorUserId);
  const conditions = [];
  const term = query.q.trim();
  if (term) {
    const pattern = `%${term.replace(/[%_\\]/g, "")}%`;
    conditions.push(or(ilike(trip.code, pattern), ilike(trip.customerName, pattern)));
  }
  if (query.status !== "all") conditions.push(eq(trip.status, query.status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(trip).where(where);
  const pageCount = Math.max(1, Math.ceil(Number(total) / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const rows = await db
    .select({
      id: trip.id,
      code: trip.code,
      status: trip.status,
      customerName: trip.customerName,
      scheduledStartAt: trip.scheduledStartAt,
      originName: origin.name,
      destinationName: destination.name,
    })
    .from(trip)
    .innerJoin(origin, eq(trip.originLocationId, origin.id))
    .innerJoin(destination, eq(trip.destinationLocationId, destination.id))
    .where(where)
    .orderBy(desc(trip.scheduledStartAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    page,
    pageCount,
    rows: rows.map((row) => ({
      ...row,
      statusLabel: tripStatusLabels[row.status],
    })),
  };
}

export async function getTrip(actorUserId: string, id: string): Promise<TripDetail | null> {
  await assertPlanner(actorUserId);
  const [row] = await db
    .select({
      id: trip.id,
      code: trip.code,
      status: trip.status,
      originLocationId: trip.originLocationId,
      destinationLocationId: trip.destinationLocationId,
      cargoWeightKg: trip.cargoWeightKg,
      plannedDistanceKm: trip.plannedDistanceKm,
      scheduledStartAt: trip.scheduledStartAt,
      scheduledEndAt: trip.scheduledEndAt,
      quotedRevenueMinor: trip.quotedRevenueMinor,
      currency: trip.currency,
      customerName: trip.customerName,
      externalReference: trip.externalReference,
      notes: trip.notes,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
      originName: origin.name,
      destinationName: destination.name,
      vehicleRegistration: vehicle.registrationNumber,
      vehicleName: vehicle.name,
      driverName: driver.name,
      driverCode: driver.employeeCode,
    })
    .from(trip)
    .innerJoin(origin, eq(trip.originLocationId, origin.id))
    .innerJoin(destination, eq(trip.destinationLocationId, destination.id))
    .leftJoin(vehicle, eq(trip.vehicleId, vehicle.id))
    .leftJoin(driver, eq(trip.driverId, driver.id))
    .where(eq(trip.id, id))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    statusLabel: tripStatusLabels[row.status],
    originLocationId: row.originLocationId,
    destinationLocationId: row.destinationLocationId,
    originName: row.originName,
    destinationName: row.destinationName,
    cargoWeightKg: row.cargoWeightKg,
    plannedDistanceKm: row.plannedDistanceKm,
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: row.scheduledEndAt,
    quotedRevenueMinor: row.quotedRevenueMinor,
    currency: row.currency,
    customerName: row.customerName,
    externalReference: row.externalReference,
    notes: row.notes,
    vehicleId: row.vehicleId,
    driverId: row.driverId,
    vehicleLabel: row.vehicleRegistration ? `${row.vehicleRegistration} · ${row.vehicleName}` : null,
    driverLabel: row.driverName ? `${row.driverName} · ${row.driverCode}` : null,
  };
}

export async function listTripLocations(
  originLocationId?: string | null,
  destinationLocationId?: string | null,
): Promise<SelectableLocation[]> {
  const [origins, destinations] = await Promise.all([
    listSelectableLocations(originLocationId),
    listSelectableLocations(destinationLocationId),
  ]);
  const byId = new Map<string, SelectableLocation>();
  for (const item of [...origins, ...destinations]) byId.set(item.id, item);
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function listAssignableVehicles(cargoWeightKg: string, includeId?: string | null): Promise<TripChoice[]> {
  const live = await db
    .select({ vehicleId: trip.vehicleId })
    .from(trip)
    .where(and(inArray(trip.status, ["dispatched", "in_progress"]), isNotNull(trip.vehicleId)));
  const liveIds = new Set(live.map((row) => row.vehicleId).filter((id): id is string => Boolean(id)));
  const rows = await db
    .select({
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      name: vehicle.name,
      capacityKg: vehicle.capacityKg,
      lifecycle: vehicle.lifecycle,
    })
    .from(vehicle)
    .where(includeId ? or(eq(vehicle.lifecycle, "active"), eq(vehicle.id, includeId)) : eq(vehicle.lifecycle, "active"))
    .orderBy(asc(vehicle.registrationNumber));

  return rows.map((row) => {
    const block = vehicleAssignmentBlock({
      found: true,
      lifecycle: row.lifecycle as VehicleLifecycle,
      cargoWeightKg: cargoWeightKg || "0",
      capacityKg: row.capacityKg,
      liveTrip: liveIds.has(row.id),
    });
    return {
      id: row.id,
      label: `${row.registrationNumber} · ${row.name} (${row.capacityKg} kg)`,
      eligible: !block,
    };
  }).filter((row) => row.eligible || row.id === includeId);
}

export async function listAssignableDrivers(includeId?: string | null): Promise<TripChoice[]> {
  const today = new Date();
  const live = await db
    .select({ driverId: trip.driverId })
    .from(trip)
    .where(and(inArray(trip.status, ["dispatched", "in_progress"]), isNotNull(trip.driverId)));
  const liveIds = new Set(live.map((row) => row.driverId).filter((id): id is string => Boolean(id)));
  const rows = await db
    .select({
      id: driver.id,
      name: driver.name,
      employeeCode: driver.employeeCode,
      dutyState: driver.dutyState,
      archivedAt: driver.archivedAt,
      verifiedAt: driverLicense.verifiedAt,
      expiresOn: driverLicense.expiresOn,
    })
    .from(driver)
    .leftJoin(driverLicense, and(eq(driverLicense.driverId, driver.id), eq(driverLicense.isPrimary, true)))
    .where(includeId ? or(isNull(driver.archivedAt), eq(driver.id, includeId)) : isNull(driver.archivedAt))
    .orderBy(asc(driver.name));

  return rows
    .map((row) => {
      const block = driverAssignmentBlock({
        found: true,
        liveTrip: liveIds.has(row.id),
        dispatchBlock: driverDispatchBlock({
          archived: Boolean(row.archivedAt),
          dutyState: row.dutyState,
          licence: row.expiresOn
            ? {
                verifiedAt: row.verifiedAt,
                expiresOn: row.expiresOn instanceof Date ? row.expiresOn : new Date(row.expiresOn),
              }
            : null,
          today,
        }),
      });
      return {
        id: row.id,
        label: `${row.name} · ${row.employeeCode}`,
        eligible: !block,
      };
    })
    .filter((row) => row.eligible || row.id === includeId);
}

export async function createDraftTrip(actorUserId: string, input: TripDraftInput) {
  await assertPlanner(actorUserId);
  const problem = draftTripProblem(input);
  if (problem) throw new DomainError("validation_failed", problem);

  return db.transaction(async (tx) => {
    await assertActiveLocations(tx, input.originLocationId, input.destinationLocationId);
    await assertAssignment(tx, input);
    const sequenceRows = await tx.execute<{ value: string }>(sql`select nextval('trip_code_sequence')::text as value`);
    const sequence = sequenceRows[0]?.value;
    if (!sequence) throw new DomainError("conflict", "Could not allocate a trip code");
    const [created] = await tx
      .insert(trip)
      .values({
        code: `TR${sequence.padStart(6, "0")}`,
        currency: "INR",
        ...tripValues(input),
      })
      .returning({ id: trip.id, code: trip.code, status: trip.status });

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "trip.created",
      entityType: "trip",
      entityId: created.id,
      after: { code: created.code, status: created.status, vehicleId: input.vehicleId, driverId: input.driverId },
    });
    return created;
  });
}

export async function updateDraftTrip(actorUserId: string, id: string, input: TripDraftInput) {
  await assertPlanner(actorUserId);
  const problem = draftTripProblem(input);
  if (problem) throw new DomainError("validation_failed", problem);

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(trip).where(eq(trip.id, id)).for("update").limit(1);
    if (!current) throw new DomainError("not_found", "Trip not found");
    if (current.status !== "draft") {
      throw new DomainError("invalid_state", "Only draft trips can be edited", { currentStatus: current.status });
    }
    await assertActiveLocations(tx, input.originLocationId, input.destinationLocationId);
    await assertAssignment(tx, input, id);
    const [updated] = await tx
      .update(trip)
      .set(tripValues(input))
      .where(and(eq(trip.id, id), eq(trip.status, "draft")))
      .returning({ id: trip.id, code: trip.code, status: trip.status });
    if (!updated) throw new DomainError("conflict", "Trip changed while saving");

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "trip.updated",
      entityType: "trip",
      entityId: updated.id,
      before: {
        originLocationId: current.originLocationId,
        destinationLocationId: current.destinationLocationId,
        vehicleId: current.vehicleId,
        driverId: current.driverId,
      },
      after: {
        originLocationId: input.originLocationId,
        destinationLocationId: input.destinationLocationId,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
      },
    });
    return updated;
  });
}

export async function dispatchDraftTrip(actorUserId: string, tripId: string) {
  const [current] = await db
    .select({ vehicleId: trip.vehicleId, driverId: trip.driverId, status: trip.status })
    .from(trip)
    .where(eq(trip.id, tripId))
    .limit(1);
  if (!current) throw new DomainError("not_found", "Trip not found");
  if (current.status !== "draft" || !current.vehicleId || !current.driverId) {
    throw new DomainError("validation_failed", "Save an eligible vehicle and driver before dispatch");
  }

  try {
    return await dispatchTrip({
      tripId,
      vehicleId: current.vehicleId,
      driverId: current.driverId,
      actorUserId,
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isUniqueViolation(error)) {
      throw new DomainError(
        "conflict",
        assignmentConflictMessage(error) ?? "That assignment conflicts with a live trip",
      );
    }
    throw error;
  }
}
