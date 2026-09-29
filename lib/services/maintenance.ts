import "server-only";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
  expense,
  maintenanceLineItem,
  maintenanceOrder,
  maintenanceServiceType,
} from "@/db/schema/finance";
import { vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { auditMetadata } from "@/lib/audit";
import { DomainError } from "@/lib/domain-error";
import {
  maintenanceActions,
  maintenanceExpenseMinor,
  shouldRestoreVehicle,
  type MaintenanceStatus,
} from "@/lib/maintenance-rules";
import { canManageMaintenance } from "@/lib/registry-access";
import { createMaintenanceOrder } from "@/lib/services/create-operations";
import { liveAssignmentStatuses } from "@/lib/trip-rules";

async function assertManager(actorUserId: string) {
  const [actor] = await db.select({ role: user.role }).from(user).where(eq(user.id, actorUserId)).limit(1);
  if (!actor || !canManageMaintenance(actor.role)) {
    throw new DomainError("forbidden", "The acting user cannot manage maintenance");
  }
}

export async function listServiceTypes(actorUserId: string) {
  await assertManager(actorUserId);
  return db
    .select({ id: maintenanceServiceType.id, name: maintenanceServiceType.name })
    .from(maintenanceServiceType)
    .where(sql`${maintenanceServiceType.archivedAt} is null`)
    .orderBy(maintenanceServiceType.name);
}

export async function listMaintenanceVehicles(actorUserId: string) {
  await assertManager(actorUserId);
  return db
    .select({ id: vehicle.id, registrationNumber: vehicle.registrationNumber, name: vehicle.name, lifecycle: vehicle.lifecycle })
    .from(vehicle)
    .where(ne(vehicle.lifecycle, "retired"))
    .orderBy(vehicle.registrationNumber);
}

export async function listMaintenanceOrders(actorUserId: string) {
  await assertManager(actorUserId);
  const rows = await db
    .select({
      id: maintenanceOrder.id,
      code: maintenanceOrder.code,
      status: maintenanceOrder.status,
      scheduledAt: maintenanceOrder.scheduledAt,
      registrationNumber: vehicle.registrationNumber,
      serviceName: maintenanceServiceType.name,
    })
    .from(maintenanceOrder)
    .innerJoin(vehicle, eq(maintenanceOrder.vehicleId, vehicle.id))
    .innerJoin(maintenanceServiceType, eq(maintenanceOrder.serviceTypeId, maintenanceServiceType.id))
    .orderBy(desc(maintenanceOrder.scheduledAt))
    .limit(40);
  return rows;
}

export async function getMaintenanceOrder(actorUserId: string, id: string) {
  await assertManager(actorUserId);
  const [order] = await db
    .select({
      id: maintenanceOrder.id,
      code: maintenanceOrder.code,
      status: maintenanceOrder.status,
      vehicleId: maintenanceOrder.vehicleId,
      scheduledAt: maintenanceOrder.scheduledAt,
      startedAt: maintenanceOrder.startedAt,
      completedAt: maintenanceOrder.completedAt,
      vendorName: maintenanceOrder.vendorName,
      notes: maintenanceOrder.notes,
      openingOdometerKm: maintenanceOrder.openingOdometerKm,
      closingOdometerKm: maintenanceOrder.closingOdometerKm,
      cancellationReason: maintenanceOrder.cancellationReason,
      registrationNumber: vehicle.registrationNumber,
      vehicleName: vehicle.name,
      serviceName: maintenanceServiceType.name,
    })
    .from(maintenanceOrder)
    .innerJoin(vehicle, eq(maintenanceOrder.vehicleId, vehicle.id))
    .innerJoin(maintenanceServiceType, eq(maintenanceOrder.serviceTypeId, maintenanceServiceType.id))
    .where(eq(maintenanceOrder.id, id))
    .limit(1);
  if (!order) return null;
  const lines = await db
    .select({
      id: maintenanceLineItem.id,
      kind: maintenanceLineItem.kind,
      description: maintenanceLineItem.description,
      quantity: maintenanceLineItem.quantity,
      unitAmountMinor: maintenanceLineItem.unitAmountMinor,
    })
    .from(maintenanceLineItem)
    .where(eq(maintenanceLineItem.maintenanceOrderId, id));
  return { ...order, lines };
}

export async function scheduleMaintenance(
  actorUserId: string,
  input: { vehicleId: string; serviceTypeId: string; scheduledAt: Date; vendorName?: string; notes?: string },
) {
  return createMaintenanceOrder({ actorUserId, ...input });
}

export async function addMaintenanceLine(
  actorUserId: string,
  input: { orderId: string; kind: "part" | "labour" | "other"; description: string; quantity: string; unitAmountMinor: bigint },
) {
  await assertManager(actorUserId);
  if (!/^\d+(\.\d{1,3})?$/.test(input.quantity) || Number(input.quantity) <= 0) {
    throw new DomainError("validation_failed", "Enter a positive quantity");
  }
  return db.transaction(async (tx) => {
    const [order] = await tx.select({ status: maintenanceOrder.status }).from(maintenanceOrder).where(eq(maintenanceOrder.id, input.orderId)).for("update").limit(1);
    if (!order) throw new DomainError("not_found", "Maintenance order not found");
    if (!maintenanceActions(order.status).editLines) {
      throw new DomainError("invalid_state", "Line items can only be added before completion");
    }
    const [created] = await tx
      .insert(maintenanceLineItem)
      .values({
        maintenanceOrderId: input.orderId,
        kind: input.kind,
        description: input.description,
        quantity: input.quantity,
        unitAmountMinor: input.unitAmountMinor,
      })
      .returning({ id: maintenanceLineItem.id });
    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "maintenance.line_added",
      entityType: "maintenance_order",
      entityId: input.orderId,
      after: { lineId: created.id, kind: input.kind, quantity: input.quantity },
    });
    return { id: input.orderId };
  });
}

async function restoreIfClear(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  vehicleId: string,
  orderId: string,
) {
  const [record] = await tx.select({ lifecycle: vehicle.lifecycle }).from(vehicle).where(eq(vehicle.id, vehicleId)).for("update").limit(1);
  if (!record) return;
  const [other] = await tx
    .select({ id: maintenanceOrder.id })
    .from(maintenanceOrder)
    .where(and(eq(maintenanceOrder.vehicleId, vehicleId), eq(maintenanceOrder.status, "in_progress"), ne(maintenanceOrder.id, orderId)))
    .limit(1);
  const [live] = await tx
    .select({ id: trip.id })
    .from(trip)
    .where(and(eq(trip.vehicleId, vehicleId), inArray(trip.status, [...liveAssignmentStatuses])))
    .limit(1);
  if (shouldRestoreVehicle({ lifecycle: record.lifecycle, otherShopWork: Boolean(other), liveTrip: Boolean(live) })) {
    await tx.update(vehicle).set({ lifecycle: "active" }).where(eq(vehicle.id, vehicleId));
  }
}

export async function startMaintenance(actorUserId: string, orderId: string) {
  await assertManager(actorUserId);
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(maintenanceOrder).where(eq(maintenanceOrder.id, orderId)).for("update").limit(1);
    if (!order) throw new DomainError("not_found", "Maintenance order not found");
    if (!maintenanceActions(order.status as MaintenanceStatus).start) {
      throw new DomainError("invalid_state", "Only scheduled work can be started");
    }
    const [record] = await tx.select().from(vehicle).where(eq(vehicle.id, order.vehicleId)).for("update").limit(1);
    if (!record || record.lifecycle === "retired") throw new DomainError("validation_failed", "Retired vehicles cannot enter the shop");
    const [live] = await tx
      .select({ id: trip.id })
      .from(trip)
      .where(and(eq(trip.vehicleId, order.vehicleId), inArray(trip.status, [...liveAssignmentStatuses])))
      .limit(1);
    if (live) throw new DomainError("conflict", "Vehicle is on a live trip");
    const startedAt = new Date();
    await tx.update(vehicle).set({ lifecycle: "in_shop" }).where(eq(vehicle.id, record.id));
    const [updated] = await tx
      .update(maintenanceOrder)
      .set({ status: "in_progress", startedAt, openingOdometerKm: record.currentOdometerKm })
      .where(and(eq(maintenanceOrder.id, orderId), eq(maintenanceOrder.status, "scheduled")))
      .returning({ id: maintenanceOrder.id });
    if (!updated) throw new DomainError("conflict", "Order changed while starting");
    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "maintenance.started",
      entityType: "maintenance_order",
      entityId: orderId,
      before: { status: order.status, lifecycle: record.lifecycle },
      after: { status: "in_progress", openingOdometerKm: record.currentOdometerKm },
    });
    return updated;
  });
}

export async function completeMaintenance(actorUserId: string, orderId: string, closingOdometerKm: string) {
  await assertManager(actorUserId);
  if (!/^\d+(\.\d{1,2})?$/.test(closingOdometerKm)) throw new DomainError("validation_failed", "Enter a closing odometer");
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(maintenanceOrder).where(eq(maintenanceOrder.id, orderId)).for("update").limit(1);
    if (!order || !maintenanceActions(order.status as MaintenanceStatus).complete || !order.openingOdometerKm) {
      throw new DomainError("invalid_state", "Only in-progress work can be completed");
    }
    const [record] = await tx.select().from(vehicle).where(eq(vehicle.id, order.vehicleId)).for("update").limit(1);
    if (!record) throw new DomainError("not_found", "Vehicle not found");
    if (Number(closingOdometerKm) < Number(order.openingOdometerKm) || Number(closingOdometerKm) < Number(record.currentOdometerKm)) {
      throw new DomainError("validation_failed", "Closing odometer cannot precede the opening or vehicle reading");
    }
    const lines = await tx
      .select({ quantity: maintenanceLineItem.quantity, unitAmountMinor: maintenanceLineItem.unitAmountMinor })
      .from(maintenanceLineItem)
      .where(eq(maintenanceLineItem.maintenanceOrderId, orderId));
    const amountMinor = maintenanceExpenseMinor(lines);
    const completedAt = new Date();
    await tx.insert(expense).values({
      kind: "maintenance",
      amountMinor,
      incurredAt: completedAt,
      vehicleId: order.vehicleId,
      maintenanceOrderId: orderId,
      vendorName: order.vendorName,
      description: `Maintenance ${order.code}`,
    });
    const [updated] = await tx
      .update(maintenanceOrder)
      .set({ status: "completed", completedAt, closingOdometerKm })
      .where(and(eq(maintenanceOrder.id, orderId), eq(maintenanceOrder.status, "in_progress")))
      .returning({ id: maintenanceOrder.id });
    if (!updated) throw new DomainError("conflict", "Order changed while completing");
    await tx.update(vehicle).set({ currentOdometerKm: closingOdometerKm }).where(eq(vehicle.id, record.id));
    await restoreIfClear(tx, record.id, orderId);
    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "maintenance.completed",
      entityType: "maintenance_order",
      entityId: orderId,
      after: { status: "completed", amountMinor: amountMinor.toString(), closingOdometerKm },
    });
    return updated;
  });
}

export async function cancelMaintenance(actorUserId: string, orderId: string, reason: string) {
  await assertManager(actorUserId);
  const trimmed = reason.trim();
  if (!trimmed) throw new DomainError("validation_failed", "A cancellation reason is required");
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(maintenanceOrder).where(eq(maintenanceOrder.id, orderId)).for("update").limit(1);
    if (!order) throw new DomainError("not_found", "Maintenance order not found");
    if (!maintenanceActions(order.status as MaintenanceStatus).cancel) {
      throw new DomainError("invalid_state", "This order can no longer be cancelled");
    }
    const wasShop = order.status === "in_progress";
    const [updated] = await tx
      .update(maintenanceOrder)
      .set({ status: "cancelled", cancelledAt: new Date(), cancellationReason: trimmed })
      .where(and(eq(maintenanceOrder.id, orderId), inArray(maintenanceOrder.status, ["scheduled", "in_progress"])))
      .returning({ id: maintenanceOrder.id });
    if (!updated) throw new DomainError("conflict", "Order changed while cancelling");
    if (wasShop) await restoreIfClear(tx, order.vehicleId, orderId);
    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "maintenance.cancelled",
      entityType: "maintenance_order",
      entityId: orderId,
      before: { status: order.status },
      after: { status: "cancelled", cancellationReason: trimmed },
    });
    return updated;
  });
}
