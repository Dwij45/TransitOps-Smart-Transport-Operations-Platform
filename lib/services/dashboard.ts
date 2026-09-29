import "server-only";

import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { expense, maintenanceOrder } from "@/db/schema/finance";
import { driver, driverLicense, vehicle } from "@/db/schema/fleet";
import { trip } from "@/db/schema/trips";
import { dashboardSections, utilizationRate, type FleetCounts } from "@/lib/dashboard-metrics";
import type { UserRole } from "@/lib/authorization";
import { liveAssignmentStatuses } from "@/lib/trip-rules";

export async function loadDashboard(role: UserRole) {
  const sections = dashboardSections(role);
  const today = new Date();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);

  const fleet: FleetCounts = { active: 0, available: 0, inShop: 0, retired: 0, onTrip: 0 };
  if (sections.fleet) {
    const lifecycles = await db.select({ lifecycle: vehicle.lifecycle, total: sql<number>`count(*)::int` }).from(vehicle).groupBy(vehicle.lifecycle);
    for (const row of lifecycles) {
      if (row.lifecycle === "active") fleet.active = Number(row.total);
      if (row.lifecycle === "in_shop") fleet.inShop = Number(row.total);
      if (row.lifecycle === "retired") fleet.retired = Number(row.total);
    }
    const [live] = await db
      .select({ total: sql<number>`count(distinct ${trip.vehicleId})::int` })
      .from(trip)
      .where(inArray(trip.status, [...liveAssignmentStatuses]));
    fleet.onTrip = Number(live?.total ?? 0);
    fleet.available = Math.max(0, fleet.active - fleet.onTrip);
  }

  const trips = sections.trips
    ? await db
        .select({ id: trip.id, code: trip.code, status: trip.status, customerName: trip.customerName })
        .from(trip)
        .orderBy(desc(trip.scheduledStartAt))
        .limit(5)
    : [];
  const [tripCounts] = sections.trips
    ? await db
        .select({
          pending: sql<number>`count(*) filter (where ${trip.status} in ('draft', 'dispatched'))::int`,
          active: sql<number>`count(*) filter (where ${trip.status} = 'in_progress')::int`,
        })
        .from(trip)
    : [{ pending: 0, active: 0 }];

  const [duty] = sections.drivers
    ? await db.select({ total: sql<number>`count(*)::int` }).from(driver).where(and(eq(driver.dutyState, "on_duty"), isNull(driver.archivedAt)))
    : [{ total: 0 }];

  const expiring = sections.drivers
    ? await db
        .select({ name: driver.name, expiresOn: driverLicense.expiresOn })
        .from(driverLicense)
        .innerJoin(driver, eq(driverLicense.driverId, driver.id))
        .where(and(eq(driverLicense.isPrimary, true), isNull(driver.archivedAt), gte(driverLicense.expiresOn, today), lt(driverLicense.expiresOn, soon)))
        .limit(5)
    : [];

  const shop = sections.maintenance
    ? await db
        .select({ code: maintenanceOrder.code, status: maintenanceOrder.status })
        .from(maintenanceOrder)
        .where(inArray(maintenanceOrder.status, ["scheduled", "in_progress"]))
        .orderBy(desc(maintenanceOrder.scheduledAt))
        .limit(5)
    : [];

  const [spent] = sections.money
    ? await db.select({ total: sql<string>`coalesce(sum(${expense.amountMinor}), 0)::text` }).from(expense)
    : [{ total: "0" }];

  return {
    sections,
    fleet,
    utilization: sections.fleet ? utilizationRate(fleet) : null,
    trips,
    pendingTrips: Number(tripCounts?.pending ?? 0),
    activeTrips: Number(tripCounts?.active ?? 0),
    onDutyDrivers: Number(duty?.total ?? 0),
    expiring,
    shop,
    expenseMinor: BigInt(spent?.total ?? "0"),
  };
}
