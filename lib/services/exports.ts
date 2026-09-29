import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { expense, maintenanceOrder } from "@/db/schema/finance";
import { driver, vehicle } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { auditMetadata } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { DomainError } from "@/lib/domain-error";
import {
  canManageDrivers,
  canManageExpenses,
  canManageMaintenance,
  canManageVehicles,
  canPlanTrips,
} from "@/lib/registry-access";
import type { UserRole } from "@/lib/authorization";
import { minorToMajor } from "@/lib/vehicle-rules";

const datasets = ["fleet", "drivers", "trips", "maintenance", "expenses", "reports"] as const;
export type ExportDataset = (typeof datasets)[number];

export function isExportDataset(value: string): value is ExportDataset {
  return (datasets as readonly string[]).includes(value);
}

function allowed(role: UserRole, dataset: ExportDataset): boolean {
  if (dataset === "fleet") return canManageVehicles(role);
  if (dataset === "drivers") return canManageDrivers(role);
  if (dataset === "trips") return canPlanTrips(role);
  if (dataset === "maintenance") return canManageMaintenance(role);
  return canManageExpenses(role);
}

export async function buildExport(actorUserId: string, dataset: ExportDataset) {
  const [actor] = await db.select({ role: user.role }).from(user).where(eq(user.id, actorUserId)).limit(1);
  if (!actor || !allowed(actor.role, dataset)) throw new DomainError("forbidden", "The acting user cannot export this dataset");

  let csv: { body: string; rowCount: number };
  if (dataset === "fleet") {
    const rows = await db.select({ registrationNumber: vehicle.registrationNumber, name: vehicle.name, lifecycle: vehicle.lifecycle, capacityKg: vehicle.capacityKg }).from(vehicle).limit(1000);
    csv = toCsv(["registration", "name", "lifecycle", "capacity_kg"], rows.map((row) => [row.registrationNumber, row.name, row.lifecycle, row.capacityKg]));
  } else if (dataset === "drivers") {
    const rows = await db.select({ employeeCode: driver.employeeCode, name: driver.name, dutyState: driver.dutyState }).from(driver).limit(1000);
    csv = toCsv(["employee_code", "name", "duty"], rows.map((row) => [row.employeeCode, row.name, row.dutyState]));
  } else if (dataset === "trips") {
    const rows = await db.select({ code: trip.code, status: trip.status, customerName: trip.customerName, scheduledStartAt: trip.scheduledStartAt }).from(trip).orderBy(desc(trip.scheduledStartAt)).limit(1000);
    csv = toCsv(["code", "status", "customer", "scheduled_start"], rows.map((row) => [row.code, row.status, row.customerName ?? "", row.scheduledStartAt.toISOString()]));
  } else if (dataset === "maintenance") {
    const rows = await db.select({ code: maintenanceOrder.code, status: maintenanceOrder.status, scheduledAt: maintenanceOrder.scheduledAt }).from(maintenanceOrder).orderBy(desc(maintenanceOrder.scheduledAt)).limit(1000);
    csv = toCsv(["code", "status", "scheduled_at"], rows.map((row) => [row.code, row.status, row.scheduledAt.toISOString()]));
  } else {
    const rows = await db.select({ kind: expense.kind, amountMinor: expense.amountMinor, description: expense.description, incurredAt: expense.incurredAt }).from(expense).orderBy(desc(expense.incurredAt)).limit(1000);
    csv = toCsv(["kind", "amount_inr", "description", "incurred_at"], rows.map((row) => [row.kind, minorToMajor(row.amountMinor), row.description, row.incurredAt.toISOString()]));
  }

  await db.insert(auditEvent).values({
    ...auditMetadata(),
    actorUserId,
    action: "export.created",
    entityType: "export",
    entityId: dataset,
    after: { dataset, rowCount: csv.rowCount },
  });
  return csv;
}
