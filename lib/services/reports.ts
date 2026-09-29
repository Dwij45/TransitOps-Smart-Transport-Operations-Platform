import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { expense, fuelEntry } from "@/db/schema/finance";
import { vehicle } from "@/db/schema/fleet";
import { trip } from "@/db/schema/trips";
import { DomainError } from "@/lib/domain-error";
import { canManageExpenses } from "@/lib/registry-access";
import { fuelEfficiencyKmPerLitre, monthlyRevenue, returnOnInvestment } from "@/lib/report-metrics";
import { tripCompletionRate } from "@/lib/safety-score";

async function assertReader(actorUserId: string) {
  const [actor] = await db.select({ role: user.role }).from(user).where(eq(user.id, actorUserId)).limit(1);
  if (!actor || !canManageExpenses(actor.role)) throw new DomainError("forbidden", "The acting user cannot view reports");
}

export async function loadReport(
  actorUserId: string,
  query: { from: Date | null; to: Date | null; vehicleId: string },
) {
  await assertReader(actorUserId);
  const tripFilters = [eq(trip.status, "completed")];
  const expenseFilters = [];
  if (query.from) {
    tripFilters.push(gte(trip.actualEndAt, query.from));
    expenseFilters.push(gte(expense.incurredAt, query.from));
  }
  if (query.to) {
    tripFilters.push(lte(trip.actualEndAt, query.to));
    expenseFilters.push(lte(expense.incurredAt, query.to));
  }
  if (query.vehicleId) {
    tripFilters.push(eq(trip.vehicleId, query.vehicleId));
    expenseFilters.push(eq(expense.vehicleId, query.vehicleId));
  }

  const [distance] = await db
    .select({ km: sql<string>`coalesce(sum(${trip.plannedDistanceKm}), 0)::text` })
    .from(trip)
    .where(and(...tripFilters));
  const [litres] = await db
    .select({ litres: sql<string>`coalesce(sum(${fuelEntry.litres}), 0)::text` })
    .from(fuelEntry)
    .innerJoin(expense, eq(fuelEntry.expenseId, expense.id))
    .where(expenseFilters.length ? and(...expenseFilters) : undefined);
  const [cost] = await db
    .select({ total: sql<string>`coalesce(sum(${expense.amountMinor}), 0)::text` })
    .from(expense)
    .where(expenseFilters.length ? and(...expenseFilters) : undefined);
  const [revenue] = await db
    .select({ total: sql<string>`coalesce(sum(${trip.finalRevenueMinor}), 0)::text` })
    .from(trip)
    .where(and(...tripFilters));
  const byVehicle = await db
    .select({
      registrationNumber: vehicle.registrationNumber,
      amountMinor: sql<string>`coalesce(sum(${expense.amountMinor}), 0)::text`,
    })
    .from(expense)
    .innerJoin(vehicle, eq(expense.vehicleId, vehicle.id))
    .where(expenseFilters.length ? and(...expenseFilters) : undefined)
    .groupBy(vehicle.registrationNumber)
    .orderBy(sql`sum(${expense.amountMinor}) desc`)
    .limit(5);
  const byMonth = await db
    .select({
      month: sql<string>`to_char(${trip.actualEndAt}, 'YYYY-MM')`,
      amountMinor: sql<string>`coalesce(sum(${trip.finalRevenueMinor}), 0)::text`,
    })
    .from(trip)
    .where(and(...tripFilters))
    .groupBy(sql`to_char(${trip.actualEndAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${trip.actualEndAt}, 'YYYY-MM')`);

  const [terminals] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${trip.status} = 'completed')::int`,
      cancelled: sql<number>`count(*) filter (where ${trip.status} = 'cancelled')::int`,
    })
    .from(trip)
    .where(query.vehicleId ? eq(trip.vehicleId, query.vehicleId) : undefined);
  const costMinor = BigInt(cost?.total ?? "0");
  const revenueMinor = BigInt(revenue?.total ?? "0");
  return {
    efficiency: fuelEfficiencyKmPerLitre(Number(distance?.km ?? 0), Number(litres?.litres ?? 0)),
    costMinor,
    revenueMinor,
    roi: returnOnInvestment(revenueMinor, costMinor),
    completion: tripCompletionRate(Number(terminals?.completed ?? 0), Number(terminals?.cancelled ?? 0)),
    costly: byVehicle.map((row) => ({ registrationNumber: row.registrationNumber, amountMinor: BigInt(row.amountMinor) })),
    months: monthlyRevenue(byMonth.map((row) => ({ month: row.month, amountMinor: BigInt(row.amountMinor) }))),
  };
}
