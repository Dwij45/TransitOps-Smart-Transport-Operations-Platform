import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { driver, driverSafetyEvent, safetyEventType } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { auditMetadata } from "@/lib/audit";
import type { UserRole } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";
import { canManageDrivers } from "@/lib/registry-access";
import { isWithinRollingYear, safetyScore, safetyStanding, tripCompletionRate } from "@/lib/safety-score";
import { withSerializableRetry } from "@/lib/transaction";

const serializable = { isolationLevel: "serializable", accessMode: "read write" } as const;

export interface SafetyEventInput {
  eventTypeId: string;
  severity: "low" | "medium" | "high" | "critical";
  occurredAt: Date;
  summary: string;
  notes: string | null;
}

async function assertStaff(actorUserId: string) {
  const [actor] = await db.select({ role: user.role }).from(user).where(eq(user.id, actorUserId)).limit(1);
  const role = actor?.role as UserRole | undefined;
  if (!role || !canManageDrivers(role)) {
    throw new DomainError("forbidden", "Only safety staff can record safety events");
  }
}

export async function listActiveSafetyTypes(actorUserId: string) {
  await assertStaff(actorUserId);
  return db
    .select({ id: safetyEventType.id, name: safetyEventType.name, defaultPoints: safetyEventType.defaultPoints })
    .from(safetyEventType)
    .where(isNull(safetyEventType.archivedAt))
    .orderBy(safetyEventType.name);
}

export async function getDriverSafety(actorUserId: string, driverId: string) {
  await assertStaff(actorUserId);
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - 12);
  const events = await db
    .select({
      id: driverSafetyEvent.id,
      severity: driverSafetyEvent.severity,
      occurredAt: driverSafetyEvent.occurredAt,
      pointsApplied: driverSafetyEvent.pointsApplied,
      summary: driverSafetyEvent.summary,
      notes: driverSafetyEvent.notes,
      typeName: safetyEventType.name,
    })
    .from(driverSafetyEvent)
    .innerJoin(safetyEventType, eq(driverSafetyEvent.eventTypeId, safetyEventType.id))
    .where(eq(driverSafetyEvent.driverId, driverId))
    .orderBy(desc(driverSafetyEvent.occurredAt));

  const rollingPoints = events
    .filter((event) => isWithinRollingYear(event.occurredAt, now))
    .reduce((sum, event) => sum + Number(event.pointsApplied), 0);
  const score = safetyScore(rollingPoints);

  const [counts] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${trip.status} = 'completed')::int`,
      cancelled: sql<number>`count(*) filter (where ${trip.status} = 'cancelled')::int`,
    })
    .from(trip)
    .where(and(eq(trip.driverId, driverId), inArray(trip.status, ["completed", "cancelled"])));

  const completion = tripCompletionRate(Number(counts?.completed ?? 0), Number(counts?.cancelled ?? 0));
  return {
    score,
    standing: safetyStanding(score),
    completion,
    events,
    windowStart,
  };
}

export async function recordSafetyEvent(actorUserId: string, driverId: string, input: SafetyEventInput) {
  await assertStaff(actorUserId);
  if (input.occurredAt.getTime() > Date.now()) {
    throw new DomainError("validation_failed", "The event date cannot be in the future");
  }

  return withSerializableRetry(() =>
    db.transaction(async (tx) => {
      const [owner] = await tx.select({ id: driver.id }).from(driver).where(eq(driver.id, driverId)).limit(1);
      if (!owner) throw new DomainError("not_found", "Driver not found");
      const [type] = await tx
        .select()
        .from(safetyEventType)
        .where(and(eq(safetyEventType.id, input.eventTypeId), isNull(safetyEventType.archivedAt)))
        .limit(1);
      if (!type) throw new DomainError("validation_failed", "Choose an active safety event type");

      const [created] = await tx
        .insert(driverSafetyEvent)
        .values({
          driverId,
          eventTypeId: type.id,
          severity: input.severity,
          occurredAt: input.occurredAt,
          pointsApplied: type.defaultPoints,
          summary: input.summary,
          notes: input.notes,
        })
        .returning({ id: driverSafetyEvent.id, pointsApplied: driverSafetyEvent.pointsApplied });

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "driver_safety_event.created",
        entityType: "driver_safety_event",
        entityId: created.id,
        after: {
          driverId,
          eventTypeId: type.id,
          pointsApplied: created.pointsApplied,
          severity: input.severity,
        },
      });
      return created;
    }, serializable),
  );
}
