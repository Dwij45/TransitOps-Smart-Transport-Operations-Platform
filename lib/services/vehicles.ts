import "server-only";

import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { vehicle, vehicleType } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { auditMetadata } from "@/lib/audit";
import type { UserRole } from "@/lib/authorization";
import { isUniqueViolation } from "@/lib/db-error";
import { DomainError } from "@/lib/domain-error";
import { canManageVehicles, canReadDispatchPool } from "@/lib/registry-access";
import { withSerializableRetry } from "@/lib/transaction";
import { odometerDecreased, toMinorUnits } from "@/lib/vehicle-rules";
import {
  isDispatchEligible,
  vehicleDisplayStatus,
  type VehicleDisplayStatus,
  type VehicleLifecycle,
} from "@/lib/vehicle-status";

const pageSize = 8;
const serializable = { isolationLevel: "serializable", accessMode: "read write" } as const;
const liveTrip = and(eq(trip.vehicleId, vehicle.id), inArray(trip.status, ["dispatched", "in_progress"]));

export interface VehicleTypeChoice {
  id: string;
  name: string;
  archived: boolean;
}

export interface VehicleInput {
  registrationNumber: string;
  fleetNumber: string | null;
  name: string;
  model: string | null;
  manufacturer: string | null;
  typeId: string;
  capacityKg: string;
  currentOdometerKm: string;
  acquisitionCostMinor: bigint | null;
  acquisitionCurrency: string;
  acquiredOn: Date | null;
  lifecycle: VehicleLifecycle;
}

export interface VehicleListItem {
  id: string;
  name: string;
  registrationNumber: string;
  fleetNumber: string | null;
  typeName: string;
  displayStatus: VehicleDisplayStatus;
  dispatchEligible: boolean;
}

export interface VehicleDetail {
  id: string;
  registrationNumber: string;
  fleetNumber: string | null;
  name: string;
  model: string | null;
  manufacturer: string | null;
  typeId: string;
  typeName: string;
  typeArchived: boolean;
  capacityKg: string;
  currentOdometerKm: string;
  acquisitionCostMinor: bigint | null;
  acquisitionCurrency: string;
  acquiredOn: Date | null;
  lifecycle: VehicleLifecycle;
  displayStatus: VehicleDisplayStatus;
  dispatchEligible: boolean;
}

export interface DispatchableVehicle {
  id: string;
  name: string;
  registrationNumber: string;
  fleetNumber: string | null;
}

async function actorRole(actorUserId: string): Promise<UserRole | null> {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);
  return actor?.role ?? null;
}

async function assertManage(actorUserId: string) {
  const role = await actorRole(actorUserId);
  if (!role || !canManageVehicles(role)) {
    throw new DomainError("forbidden", "Only an administrator or fleet manager can change vehicles");
  }
}

function statusCondition(status: VehicleDisplayStatus) {
  if (status === "retired") return eq(vehicle.lifecycle, "retired");
  if (status === "in_shop") return eq(vehicle.lifecycle, "in_shop");
  if (status === "on_trip") return and(eq(vehicle.lifecycle, "active"), eq(trip.status, "in_progress"));
  if (status === "reserved") return and(eq(vehicle.lifecycle, "active"), eq(trip.status, "dispatched"));
  return and(eq(vehicle.lifecycle, "active"), isNull(trip.status));
}

export async function listVehicleTypes(actorUserId: string): Promise<VehicleTypeChoice[]> {
  await assertManage(actorUserId);
  const rows = await db
    .select({ id: vehicleType.id, name: vehicleType.name, archivedAt: vehicleType.archivedAt })
    .from(vehicleType)
    .orderBy(asc(vehicleType.name));
  return rows.map((row) => ({ id: row.id, name: row.name, archived: Boolean(row.archivedAt) }));
}

export async function searchVehicles(
  actorUserId: string,
  query: { q: string; typeId: string; status: VehicleDisplayStatus | "all"; page: number },
): Promise<{ rows: VehicleListItem[]; total: number; page: number; pageCount: number }> {
  await assertManage(actorUserId);

  const conditions = [];
  const term = query.q.trim();
  if (term) {
    const pattern = `%${term.replace(/[%_\\]/g, "")}%`;
    conditions.push(
      or(
        ilike(vehicle.name, pattern),
        ilike(vehicle.registrationNumber, pattern),
        ilike(vehicle.fleetNumber, pattern),
      ),
    );
  }
  if (query.typeId) conditions.push(eq(vehicle.typeId, query.typeId));
  if (query.status !== "all") conditions.push(statusCondition(query.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(vehicle)
    .leftJoin(trip, liveTrip)
    .where(where);

  const pageCount = Math.max(1, Math.ceil(Number(total) / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const rows = await db
    .select({
      id: vehicle.id,
      name: vehicle.name,
      registrationNumber: vehicle.registrationNumber,
      fleetNumber: vehicle.fleetNumber,
      typeName: vehicleType.name,
      lifecycle: vehicle.lifecycle,
      tripStatus: trip.status,
    })
    .from(vehicle)
    .innerJoin(vehicleType, eq(vehicle.typeId, vehicleType.id))
    .leftJoin(trip, liveTrip)
    .where(where)
    .orderBy(asc(vehicle.registrationNumber))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((row) => {
      const displayStatus = vehicleDisplayStatus(
        row.lifecycle,
        row.tripStatus === "dispatched" || row.tripStatus === "in_progress" ? row.tripStatus : null,
      );
      return {
        id: row.id,
        name: row.name,
        registrationNumber: row.registrationNumber,
        fleetNumber: row.fleetNumber,
        typeName: row.typeName,
        displayStatus,
        dispatchEligible: isDispatchEligible(displayStatus),
      };
    }),
    total: Number(total),
    page,
    pageCount,
  };
}

export async function listDispatchableVehicles(actorUserId: string): Promise<DispatchableVehicle[]> {
  const role = await actorRole(actorUserId);
  if (!role || !canReadDispatchPool(role)) {
    throw new DomainError("forbidden", "You cannot view dispatchable vehicles");
  }

  return db
    .select({
      id: vehicle.id,
      name: vehicle.name,
      registrationNumber: vehicle.registrationNumber,
      fleetNumber: vehicle.fleetNumber,
    })
    .from(vehicle)
    .leftJoin(trip, liveTrip)
    .where(and(eq(vehicle.lifecycle, "active"), isNull(trip.status)))
    .orderBy(asc(vehicle.registrationNumber));
}

export async function getVehicle(actorUserId: string, id: string): Promise<VehicleDetail | null> {
  await assertManage(actorUserId);
  const [row] = await db
    .select({
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      fleetNumber: vehicle.fleetNumber,
      name: vehicle.name,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      typeId: vehicle.typeId,
      typeName: vehicleType.name,
      typeArchivedAt: vehicleType.archivedAt,
      capacityKg: vehicle.capacityKg,
      currentOdometerKm: vehicle.currentOdometerKm,
      acquisitionCostMinor: vehicle.acquisitionCostMinor,
      acquisitionCurrency: vehicle.acquisitionCurrency,
      acquiredOn: vehicle.acquiredOn,
      lifecycle: vehicle.lifecycle,
      tripStatus: trip.status,
    })
    .from(vehicle)
    .innerJoin(vehicleType, eq(vehicle.typeId, vehicleType.id))
    .leftJoin(trip, liveTrip)
    .where(eq(vehicle.id, id))
    .limit(1);

  if (!row) return null;
  const displayStatus = vehicleDisplayStatus(
    row.lifecycle,
    row.tripStatus === "dispatched" || row.tripStatus === "in_progress" ? row.tripStatus : null,
  );

  return {
    id: row.id,
    registrationNumber: row.registrationNumber,
    fleetNumber: row.fleetNumber,
    name: row.name,
    model: row.model,
    manufacturer: row.manufacturer,
    typeId: row.typeId,
    typeName: row.typeName,
    typeArchived: Boolean(row.typeArchivedAt),
    capacityKg: row.capacityKg,
    currentOdometerKm: row.currentOdometerKm,
    acquisitionCostMinor: row.acquisitionCostMinor,
    acquisitionCurrency: row.acquisitionCurrency,
    acquiredOn: row.acquiredOn,
    lifecycle: row.lifecycle,
    displayStatus,
    dispatchEligible: isDispatchEligible(displayStatus),
  };
}

async function assertTypeSelectable(typeId: string, currentTypeId: string | null) {
  const [type] = await db
    .select({ id: vehicleType.id, archivedAt: vehicleType.archivedAt })
    .from(vehicleType)
    .where(eq(vehicleType.id, typeId))
    .limit(1);

  if (!type) throw new DomainError("validation_failed", "Choose a vehicle type");
  if (type.archivedAt && type.id !== currentTypeId) {
    throw new DomainError("validation_failed", "Archived vehicle types cannot be selected");
  }
}

function vehicleValues(input: VehicleInput, retiredAt: Date | null) {
  return {
    registrationNumber: input.registrationNumber,
    fleetNumber: input.fleetNumber,
    name: input.name,
    model: input.model,
    manufacturer: input.manufacturer,
    typeId: input.typeId,
    capacityKg: input.capacityKg,
    currentOdometerKm: input.currentOdometerKm,
    acquisitionCostMinor: input.acquisitionCostMinor,
    acquisitionCurrency: input.acquisitionCurrency,
    acquiredOn: input.acquiredOn,
    lifecycle: input.lifecycle,
    retiredAt,
  };
}

export async function createVehicle(
  actorUserId: string,
  input: Omit<VehicleInput, "lifecycle">,
) {
  await assertManage(actorUserId);
  await assertTypeSelectable(input.typeId, null);

  try {
    return await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(vehicle)
          .values(vehicleValues({ ...input, lifecycle: "active" }, null))
          .returning({ id: vehicle.id });

        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: "vehicle.created",
          entityType: "vehicle",
          entityId: created.id,
          after: {
            registrationNumber: input.registrationNumber,
            fleetNumber: input.fleetNumber,
            lifecycle: "active",
          },
        });

        return created;
      }, serializable),
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("conflict", "Registration or fleet number is already in use");
    }
    throw error;
  }
}

export async function updateVehicle(actorUserId: string, id: string, input: VehicleInput) {
  await assertManage(actorUserId);

  try {
    return await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        const [current] = await tx.select().from(vehicle).where(eq(vehicle.id, id)).for("update").limit(1);
        if (!current) throw new DomainError("not_found", "Vehicle not found");
        if (odometerDecreased(input.currentOdometerKm, current.currentOdometerKm)) {
          throw new DomainError("invalid_state", "Odometer cannot decrease");
        }

        await assertTypeSelectable(input.typeId, current.typeId);

        if (input.lifecycle !== "active") {
          const [live] = await tx
            .select({ id: trip.id })
            .from(trip)
            .where(and(eq(trip.vehicleId, id), inArray(trip.status, ["dispatched", "in_progress"])))
            .limit(1);
          if (live) {
            throw new DomainError("invalid_state", "A vehicle on a live trip cannot leave active service");
          }
        }

        const retiredAt =
          input.lifecycle === "retired" ? (current.retiredAt ?? new Date()) : null;

        await tx.update(vehicle).set(vehicleValues(input, retiredAt)).where(eq(vehicle.id, id));
        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: input.lifecycle === "retired" && current.lifecycle !== "retired" ? "vehicle.retired" : "vehicle.updated",
          entityType: "vehicle",
          entityId: id,
          before: {
            registrationNumber: current.registrationNumber,
            lifecycle: current.lifecycle,
            currentOdometerKm: current.currentOdometerKm,
          },
          after: {
            registrationNumber: input.registrationNumber,
            lifecycle: input.lifecycle,
            currentOdometerKm: input.currentOdometerKm,
          },
        });

        return { id };
      }, serializable),
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("conflict", "Registration or fleet number is already in use");
    }
    throw error;
  }
}

export async function retireVehicle(actorUserId: string, id: string) {
  const current = await getVehicle(actorUserId, id);
  if (!current) throw new DomainError("not_found", "Vehicle not found");
  if (current.lifecycle === "retired") throw new DomainError("invalid_state", "Vehicle is already retired");

  return updateVehicle(actorUserId, id, {
    registrationNumber: current.registrationNumber,
    fleetNumber: current.fleetNumber,
    name: current.name,
    model: current.model,
    manufacturer: current.manufacturer,
    typeId: current.typeId,
    capacityKg: current.capacityKg,
    currentOdometerKm: current.currentOdometerKm,
    acquisitionCostMinor: current.acquisitionCostMinor,
    acquisitionCurrency: current.acquisitionCurrency,
    acquiredOn: current.acquiredOn,
    lifecycle: "retired",
  });
}
