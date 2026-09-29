import "server-only";

import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { expense, fuelEntry } from "@/db/schema/finance";
import { vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { auditMetadata } from "@/lib/audit";
import { DomainError } from "@/lib/domain-error";
import { canEditExpense, fuelOdometerProblem, ledgerTotal } from "@/lib/expense-rules";
import { canManageExpenses } from "@/lib/registry-access";

async function assertAnalyst(actorUserId: string) {
  const [actor] = await db.select({ role: user.role }).from(user).where(eq(user.id, actorUserId)).limit(1);
  if (!actor || !canManageExpenses(actor.role)) throw new DomainError("forbidden", "The acting user cannot manage expenses");
}

export async function listExpenses(
  actorUserId: string,
  query: { kind: string; q: string },
) {
  await assertAnalyst(actorUserId);
  const conditions = [];
  if (query.kind === "fuel" || query.kind === "maintenance" || query.kind === "toll" || query.kind === "miscellaneous") {
    conditions.push(eq(expense.kind, query.kind));
  }
  if (query.q.trim()) conditions.push(ilike(expense.description, `%${query.q.trim().replace(/[%_\\]/g, "")}%`));
  const rows = await db
    .select({
      id: expense.id,
      kind: expense.kind,
      amountMinor: expense.amountMinor,
      incurredAt: expense.incurredAt,
      description: expense.description,
      vendorName: expense.vendorName,
      registrationNumber: vehicle.registrationNumber,
      litres: fuelEntry.litres,
    })
    .from(expense)
    .leftJoin(vehicle, eq(expense.vehicleId, vehicle.id))
    .leftJoin(fuelEntry, eq(fuelEntry.expenseId, expense.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expense.incurredAt))
    .limit(50);
  return { rows, totalMinor: ledgerTotal(rows) };
}

export async function recordFuel(
  actorUserId: string,
  input: {
    vehicleId: string;
    tripId: string | null;
    litres: string;
    amountMinor: bigint;
    fuelType: string;
    vendorName: string | null;
    odometerKm: string;
    incurredAt: Date;
  },
) {
  await assertAnalyst(actorUserId);
  if (!/^\d+(\.\d{1,3})?$/.test(input.litres) || Number(input.litres) <= 0) {
    throw new DomainError("validation_failed", "Enter a positive volume");
  }
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(vehicle).where(eq(vehicle.id, input.vehicleId)).for("update").limit(1);
    if (!record) throw new DomainError("not_found", "Vehicle not found");
    const problem = fuelOdometerProblem(input.odometerKm, record.currentOdometerKm);
    if (problem) throw new DomainError("validation_failed", problem);
    if (input.tripId) {
      const [tripRow] = await tx.select({ id: trip.id }).from(trip).where(eq(trip.id, input.tripId)).limit(1);
      if (!tripRow) throw new DomainError("validation_failed", "Trip not found");
    }
    const [created] = await tx
      .insert(expense)
      .values({
        kind: "fuel",
        amountMinor: input.amountMinor,
        incurredAt: input.incurredAt,
        vehicleId: input.vehicleId,
        tripId: input.tripId,
        vendorName: input.vendorName,
        description: `${input.fuelType} ${input.litres} L`,
      })
      .returning({ id: expense.id });
    await tx.insert(fuelEntry).values({
      expenseId: created.id,
      litres: input.litres,
      odometerKm: input.odometerKm,
      fuelType: input.fuelType,
    });
    await tx.update(vehicle).set({ currentOdometerKm: input.odometerKm }).where(eq(vehicle.id, record.id));
    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "expense.created",
      entityType: "expense",
      entityId: created.id,
      after: { kind: "fuel", amountMinor: input.amountMinor.toString(), odometerKm: input.odometerKm },
    });
    return created;
  });
}

export async function recordExpense(
  actorUserId: string,
  input: {
    kind: "toll" | "miscellaneous";
    amountMinor: bigint;
    vehicleId: string | null;
    tripId: string | null;
    vendorName: string | null;
    description: string;
    incurredAt: Date;
  },
) {
  await assertAnalyst(actorUserId);
  const [created] = await db
    .insert(expense)
    .values({
      kind: input.kind,
      amountMinor: input.amountMinor,
      incurredAt: input.incurredAt,
      vehicleId: input.vehicleId,
      tripId: input.tripId,
      vendorName: input.vendorName,
      description: input.description,
    })
    .returning({ id: expense.id });
  await db.insert(auditEvent).values({
    ...auditMetadata(),
    actorUserId,
    action: "expense.created",
    entityType: "expense",
    entityId: created.id,
    after: { kind: input.kind, amountMinor: input.amountMinor.toString() },
  });
  return created;
}

export async function updateExpense(
  actorUserId: string,
  id: string,
  input: { amountMinor: bigint; vendorName: string | null; description: string },
) {
  await assertAnalyst(actorUserId);
  const [current] = await db.select().from(expense).where(eq(expense.id, id)).limit(1);
  if (!current) throw new DomainError("not_found", "Expense not found");
  if (!canEditExpense(current.kind)) throw new DomainError("invalid_state", "This expense cannot be edited");
  const [updated] = await db
    .update(expense)
    .set({ amountMinor: input.amountMinor, vendorName: input.vendorName, description: input.description })
    .where(eq(expense.id, id))
    .returning({ id: expense.id });
  await db.insert(auditEvent).values({
    ...auditMetadata(),
    actorUserId,
    action: "expense.updated",
    entityType: "expense",
    entityId: id,
    before: { amountMinor: current.amountMinor.toString() },
    after: { amountMinor: input.amountMinor.toString() },
  });
  return updated;
}

export async function listExpenseVehicles(actorUserId: string) {
  await assertAnalyst(actorUserId);
  return db
    .select({ id: vehicle.id, registrationNumber: vehicle.registrationNumber, name: vehicle.name })
    .from(vehicle)
    .where(sql`${vehicle.lifecycle} <> 'retired'`)
    .orderBy(vehicle.registrationNumber);
}
