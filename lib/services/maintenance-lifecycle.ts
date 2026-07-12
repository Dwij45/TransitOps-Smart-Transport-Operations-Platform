import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
  expense,
  maintenanceLineItem,
  maintenanceOrder,
} from "@/db/schema/finance";
import { vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";
import { withSerializableRetry } from "@/lib/transaction";
import { auditMetadata } from "@/lib/audit";

interface MaintenanceActionInput {
  maintenanceOrderId: string;
  actorUserId: string;
}

export interface CompleteMaintenanceInput extends MaintenanceActionInput {
  closingOdometerKm: string;
}

export interface CancelMaintenanceInput extends MaintenanceActionInput {
  reason: string;
}

async function assertMaintenanceManager(actorUserId: string): Promise<void> {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "maintenance:manage")) {
    throw new DomainError(
      "forbidden",
      "The acting user cannot manage maintenance",
    );
  }
}

export async function startMaintenance(input: MaintenanceActionInput) {
  await assertMaintenanceManager(input.actorUserId);

  return withSerializableRetry(() => db.transaction(
    async (tx) => {
      const [order] = await tx
        .select()
        .from(maintenanceOrder)
        .where(eq(maintenanceOrder.id, input.maintenanceOrderId))
        .for("update")
        .limit(1);

      if (!order) {
        throw new DomainError("not_found", "Maintenance order not found");
      }

      if (order.status !== "scheduled") {
        throw new DomainError(
          "invalid_state",
          "Only scheduled maintenance can be started",
          { currentStatus: order.status },
        );
      }

      const [vehicleRecord] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, order.vehicleId))
        .for("update")
        .limit(1);

      if (!vehicleRecord || vehicleRecord.lifecycle !== "active") {
        throw new DomainError(
          "validation_failed",
          "Vehicle must be active to start maintenance",
        );
      }

      const [activeTrip] = await tx
        .select({ id: trip.id })
        .from(trip)
        .where(
          and(
            eq(trip.vehicleId, order.vehicleId),
            inArray(trip.status, ["dispatched", "in_progress"]),
          ),
        )
        .for("update")
        .limit(1);

      if (activeTrip) {
        throw new DomainError(
          "conflict",
          "Vehicle has an active trip assignment",
        );
      }

      const startedAt = new Date();
      const [updated] = await tx
        .update(maintenanceOrder)
        .set({
          status: "in_progress",
          startedAt,
          openingOdometerKm: vehicleRecord.currentOdometerKm,
        })
        .where(
          and(
            eq(maintenanceOrder.id, order.id),
            eq(maintenanceOrder.status, "scheduled"),
          ),
        )
        .returning();

      if (!updated) {
        throw new DomainError(
          "conflict",
          "Maintenance order changed while starting",
        );
      }

      await tx
        .update(vehicle)
        .set({ lifecycle: "in_shop" })
        .where(eq(vehicle.id, vehicleRecord.id));

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId: input.actorUserId,
        action: "maintenance.started",
        entityType: "maintenance_order",
        entityId: updated.id,
        before: { status: order.status, vehicleLifecycle: vehicleRecord.lifecycle },
        after: {
          status: updated.status,
          vehicleLifecycle: "in_shop",
          openingOdometerKm: updated.openingOdometerKm,
        },
      });

      return updated;
    },
    { isolationLevel: "serializable", accessMode: "read write" },
  ));
}

export async function completeMaintenance(input: CompleteMaintenanceInput) {
  await assertMaintenanceManager(input.actorUserId);

  return withSerializableRetry(() => db.transaction(
    async (tx) => {
      const [order] = await tx
        .select()
        .from(maintenanceOrder)
        .where(eq(maintenanceOrder.id, input.maintenanceOrderId))
        .for("update")
        .limit(1);

      if (!order) {
        throw new DomainError("not_found", "Maintenance order not found");
      }

      if (order.status !== "in_progress" || !order.openingOdometerKm) {
        throw new DomainError(
          "invalid_state",
          "Only in-progress maintenance can be completed",
          { currentStatus: order.status },
        );
      }

      const [vehicleRecord] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, order.vehicleId))
        .for("update")
        .limit(1);

      if (!vehicleRecord || vehicleRecord.lifecycle !== "in_shop") {
        throw new DomainError(
          "validation_failed",
          "Vehicle is not currently in the shop",
        );
      }

      const closingOdometerKm = Number(input.closingOdometerKm);
      if (
        !Number.isFinite(closingOdometerKm) ||
        closingOdometerKm < Number(order.openingOdometerKm) ||
        closingOdometerKm < Number(vehicleRecord.currentOdometerKm)
      ) {
        throw new DomainError(
          "validation_failed",
          "Closing odometer cannot precede existing readings",
        );
      }

      const [total] = await tx
        .select({
          amountMinor: sql<string>`round(coalesce(sum(${maintenanceLineItem.quantity} * ${maintenanceLineItem.unitAmountMinor}), 0))::text`,
          lineItemCount: sql<number>`count(*)::int`,
          currencyCount: sql<number>`count(distinct ${maintenanceLineItem.currency})::int`,
          currency: sql<string>`min(${maintenanceLineItem.currency})`,
        })
        .from(maintenanceLineItem)
        .where(eq(maintenanceLineItem.maintenanceOrderId, order.id));

      if (!total || total.lineItemCount === 0) {
        throw new DomainError(
          "validation_failed",
          "Maintenance requires at least one line item",
        );
      }

      if (total.currencyCount !== 1) {
        throw new DomainError(
          "validation_failed",
          "Maintenance line items must use one currency",
        );
      }

      const completedAt = new Date();
      const [updated] = await tx
        .update(maintenanceOrder)
        .set({
          status: "completed",
          completedAt,
          closingOdometerKm: input.closingOdometerKm,
        })
        .where(
          and(
            eq(maintenanceOrder.id, order.id),
            eq(maintenanceOrder.status, "in_progress"),
          ),
        )
        .returning();

      if (!updated) {
        throw new DomainError(
          "conflict",
          "Maintenance order changed while completing",
        );
      }

      const [postedExpense] = await tx
        .insert(expense)
        .values({
          kind: "maintenance",
          amountMinor: BigInt(total.amountMinor),
          currency: total.currency,
          incurredAt: completedAt,
          vehicleId: order.vehicleId,
          maintenanceOrderId: order.id,
          vendorName: order.vendorName,
          description: `Maintenance ${order.code}`,
        })
        .returning();

      const [otherActiveOrder] = await tx
        .select({ id: maintenanceOrder.id })
        .from(maintenanceOrder)
        .where(
          and(
            ne(maintenanceOrder.id, order.id),
            eq(maintenanceOrder.vehicleId, order.vehicleId),
            eq(maintenanceOrder.status, "in_progress"),
          ),
        )
        .for("update")
        .limit(1);

      const restoredLifecycle = otherActiveOrder ? "in_shop" : "active";

      await tx
        .update(vehicle)
        .set({
          lifecycle: restoredLifecycle,
          currentOdometerKm: input.closingOdometerKm,
        })
        .where(eq(vehicle.id, vehicleRecord.id));

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId: input.actorUserId,
        action: "maintenance.completed",
        entityType: "maintenance_order",
        entityId: updated.id,
        before: { status: order.status, vehicleLifecycle: vehicleRecord.lifecycle },
        after: {
          status: updated.status,
          vehicleLifecycle: restoredLifecycle,
          closingOdometerKm: updated.closingOdometerKm,
          expenseId: postedExpense.id,
          amountMinor: postedExpense.amountMinor.toString(),
        },
      });

      return { order: updated, expense: postedExpense };
    },
    { isolationLevel: "serializable", accessMode: "read write" },
  ));
}

export async function cancelMaintenance(input: CancelMaintenanceInput) {
  await assertMaintenanceManager(input.actorUserId);

  const reason = input.reason.trim();
  if (!reason) {
    throw new DomainError(
      "validation_failed",
      "A cancellation reason is required",
    );
  }

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(maintenanceOrder)
      .where(eq(maintenanceOrder.id, input.maintenanceOrderId))
      .for("update")
      .limit(1);

    if (!order) {
      throw new DomainError("not_found", "Maintenance order not found");
    }

    if (order.status !== "scheduled" && order.status !== "in_progress") {
      throw new DomainError(
        "invalid_state",
        "Only scheduled or in-progress maintenance can be cancelled",
        { currentStatus: order.status },
      );
    }

    const [vehicleRecord] = await tx
      .select()
      .from(vehicle)
      .where(eq(vehicle.id, order.vehicleId))
      .for("update")
      .limit(1);

    if (!vehicleRecord) {
      throw new DomainError("not_found", "Vehicle not found");
    }

    const cancelledAt = new Date();
    const [updated] = await tx
      .update(maintenanceOrder)
      .set({ status: "cancelled", cancelledAt, cancellationReason: reason })
      .where(
        and(
          eq(maintenanceOrder.id, order.id),
          inArray(maintenanceOrder.status, ["scheduled", "in_progress"]),
        ),
      )
      .returning();

    if (!updated) {
      throw new DomainError(
        "conflict",
        "Maintenance order changed while cancelling",
      );
    }

    let restoredLifecycle = vehicleRecord.lifecycle;

    if (order.status === "in_progress") {
      const [otherActiveOrder] = await tx
        .select({ id: maintenanceOrder.id })
        .from(maintenanceOrder)
        .where(
          and(
            ne(maintenanceOrder.id, order.id),
            eq(maintenanceOrder.vehicleId, order.vehicleId),
            eq(maintenanceOrder.status, "in_progress"),
          ),
        )
        .for("update")
        .limit(1);

      if (!otherActiveOrder) {
        restoredLifecycle = "active";
        await tx
          .update(vehicle)
          .set({ lifecycle: "active" })
          .where(eq(vehicle.id, vehicleRecord.id));
      }
    }

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId: input.actorUserId,
      action: "maintenance.cancelled",
      entityType: "maintenance_order",
      entityId: updated.id,
      before: { status: order.status, vehicleLifecycle: vehicleRecord.lifecycle },
      after: {
        status: updated.status,
        cancellationReason: reason,
        vehicleLifecycle: restoredLifecycle,
      },
    });

    return updated;
  });
}
