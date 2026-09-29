import "server-only";

import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { driver, driverLicense } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { trip } from "@/db/schema/trips";
import { auditMetadata } from "@/lib/audit";
import { isUniqueViolation } from "@/lib/db-error";
import { DomainError } from "@/lib/domain-error";
import {
  driverDispatchBlock,
  normalizeEmployeeCode,
  type DriverDutyState,
  type PrimaryLicence,
} from "@/lib/driver-rules";
import type { UserRole } from "@/lib/authorization";
import { canManageDrivers } from "@/lib/registry-access";
import { withSerializableRetry } from "@/lib/transaction";

const pageSize = 8;
const serializable = { isolationLevel: "serializable", accessMode: "read write" } as const;

export interface DriverInput {
  employeeCode: string;
  name: string;
  phone: string;
  email: string | null;
  dutyState: DriverDutyState;
  hiredOn: Date | null;
}

export interface LicenceInput {
  licenseNumber: string;
  category: string;
  issuedOn: Date | null;
  expiresOn: Date;
  isPrimary: boolean;
}

async function assertStaff(actorUserId: string) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);
  const role = actor?.role as UserRole | undefined;
  if (!role || !canManageDrivers(role)) {
    throw new DomainError("forbidden", "Only safety staff can change drivers");
  }
}

function licenceOf(row: { verifiedAt: Date | null; expiresOn: Date } | null): PrimaryLicence | null {
  if (!row) return null;
  return { verifiedAt: row.verifiedAt, expiresOn: row.expiresOn };
}

export async function searchDrivers(
  actorUserId: string,
  query: { q: string; duty: DriverDutyState | "all"; status: "active" | "archived" | "all"; page: number },
) {
  await assertStaff(actorUserId);
  const conditions = [];
  const term = query.q.trim();
  if (term) {
    const pattern = `%${term.replace(/[%_\\]/g, "")}%`;
    conditions.push(or(ilike(driver.name, pattern), ilike(driver.employeeCode, pattern), ilike(driver.phone, pattern)));
  }
  if (query.duty !== "all") conditions.push(eq(driver.dutyState, query.duty));
  if (query.status === "active") conditions.push(isNull(driver.archivedAt));
  if (query.status === "archived") conditions.push(isNotNull(driver.archivedAt));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(driver).where(where);
  const pageCount = Math.max(1, Math.ceil(Number(total) / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const rows = await db
    .select({
      id: driver.id,
      name: driver.name,
      employeeCode: driver.employeeCode,
      phone: driver.phone,
      dutyState: driver.dutyState,
      archivedAt: driver.archivedAt,
      verifiedAt: driverLicense.verifiedAt,
      expiresOn: driverLicense.expiresOn,
    })
    .from(driver)
    .leftJoin(driverLicense, and(eq(driverLicense.driverId, driver.id), eq(driverLicense.isPrimary, true)))
    .where(where)
    .orderBy(asc(driver.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const today = new Date();
  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      employeeCode: row.employeeCode,
      phone: row.phone,
      dutyState: row.dutyState,
      archived: Boolean(row.archivedAt),
      dispatchBlock: driverDispatchBlock({
        archived: Boolean(row.archivedAt),
        dutyState: row.dutyState,
        licence: row.expiresOn ? licenceOf({ verifiedAt: row.verifiedAt, expiresOn: row.expiresOn }) : null,
        today,
      }),
    })),
    total: Number(total),
    page,
    pageCount,
  };
}

export async function getDriver(actorUserId: string, id: string) {
  await assertStaff(actorUserId);
  const [row] = await db.select().from(driver).where(eq(driver.id, id)).limit(1);
  if (!row) return null;
  const licences = await db
    .select()
    .from(driverLicense)
    .where(eq(driverLicense.driverId, id))
    .orderBy(asc(driverLicense.expiresOn));
  const primary = licences.find((licence) => licence.isPrimary) ?? null;
  return {
    ...row,
    archived: Boolean(row.archivedAt),
    licences,
    dispatchBlock: driverDispatchBlock({
      archived: Boolean(row.archivedAt),
      dutyState: row.dutyState,
      licence: primary ? licenceOf(primary) : null,
      today: new Date(),
    }),
  };
}

async function assertCanLeaveDuty(tx: Pick<typeof db, "select">, driverId: string, nextDuty: DriverDutyState, archiving: boolean) {
  if (nextDuty === "on_duty" && !archiving) return;
  const [live] = await tx
    .select({ id: trip.id })
    .from(trip)
    .where(and(eq(trip.driverId, driverId), inArray(trip.status, ["dispatched", "in_progress"])))
    .limit(1);
  if (live) throw new DomainError("invalid_state", "Driver has a live trip");
}

export async function createDriver(actorUserId: string, input: DriverInput) {
  await assertStaff(actorUserId);
  try {
    return await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(driver)
          .values({
            employeeCode: normalizeEmployeeCode(input.employeeCode),
            name: input.name,
            phone: input.phone,
            email: input.email,
            dutyState: input.dutyState,
            hiredOn: input.hiredOn,
          })
          .returning({ id: driver.id });
        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: "driver.created",
          entityType: "driver",
          entityId: created.id,
          after: { employeeCode: normalizeEmployeeCode(input.employeeCode), dutyState: input.dutyState },
        });
        return created;
      }, serializable),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("conflict", "Employee code is already in use");
    throw error;
  }
}

export async function updateDriver(actorUserId: string, id: string, input: DriverInput) {
  await assertStaff(actorUserId);
  try {
    return await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        const [current] = await tx.select().from(driver).where(eq(driver.id, id)).for("update").limit(1);
        if (!current) throw new DomainError("not_found", "Driver not found");
        if (current.archivedAt && input.dutyState === "on_duty") {
          throw new DomainError("invalid_state", "An archived driver cannot go on duty");
        }
        if (input.dutyState !== "on_duty") await assertCanLeaveDuty(tx, id, input.dutyState, false);
        await tx
          .update(driver)
          .set({
            employeeCode: normalizeEmployeeCode(input.employeeCode),
            name: input.name,
            phone: input.phone,
            email: input.email,
            dutyState: input.dutyState,
            hiredOn: input.hiredOn,
          })
          .where(eq(driver.id, id));
        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: current.dutyState === input.dutyState ? "driver.updated" : "driver.duty_changed",
          entityType: "driver",
          entityId: id,
          before: { dutyState: current.dutyState, employeeCode: current.employeeCode },
          after: { dutyState: input.dutyState, employeeCode: normalizeEmployeeCode(input.employeeCode) },
        });
        return { id };
      }, serializable),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("conflict", "Employee code is already in use");
    throw error;
  }
}

export async function archiveDriver(actorUserId: string, id: string) {
  await assertStaff(actorUserId);
  return withSerializableRetry(() =>
    db.transaction(async (tx) => {
      const [current] = await tx.select().from(driver).where(eq(driver.id, id)).for("update").limit(1);
      if (!current) throw new DomainError("not_found", "Driver not found");
      if (current.archivedAt) throw new DomainError("invalid_state", "Driver is already archived");
      await assertCanLeaveDuty(tx, id, "off_duty", true);
      await tx.update(driver).set({ archivedAt: new Date(), dutyState: "off_duty" }).where(eq(driver.id, id));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "driver.archived",
        entityType: "driver",
        entityId: id,
        before: { dutyState: current.dutyState, archived: false },
        after: { dutyState: "off_duty", archived: true },
      });
      return { id };
    }, serializable),
  );
}

export async function addLicence(actorUserId: string, driverId: string, input: LicenceInput) {
  await assertStaff(actorUserId);
  if (input.issuedOn && input.expiresOn < input.issuedOn) {
    throw new DomainError("validation_failed", "Expiry must follow the issue date");
  }
  try {
    return await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        const [owner] = await tx.select({ id: driver.id }).from(driver).where(eq(driver.id, driverId)).limit(1);
        if (!owner) throw new DomainError("not_found", "Driver not found");
        const existing = await tx
          .select({ id: driverLicense.id })
          .from(driverLicense)
          .where(eq(driverLicense.driverId, driverId));
        const primary = input.isPrimary || existing.length === 0;
        if (primary) {
          await tx
            .update(driverLicense)
            .set({ isPrimary: false })
            .where(and(eq(driverLicense.driverId, driverId), eq(driverLicense.isPrimary, true)));
        }
        const [created] = await tx
          .insert(driverLicense)
          .values({
            driverId,
            licenseNumber: input.licenseNumber.toUpperCase().replace(/\s+/g, ""),
            category: input.category,
            issuedOn: input.issuedOn,
            expiresOn: input.expiresOn,
            isPrimary: primary,
          })
          .returning({ id: driverLicense.id });
        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: "driver_licence.created",
          entityType: "driver_licence",
          entityId: created.id,
          after: { driverId, isPrimary: primary },
        });
        return created;
      }, serializable),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("conflict", "Licence number is already in use");
    throw error;
  }
}

export async function makeLicencePrimary(actorUserId: string, driverId: string, licenceId: string) {
  await assertStaff(actorUserId);
  return withSerializableRetry(() =>
    db.transaction(async (tx) => {
      const [licence] = await tx
        .select()
        .from(driverLicense)
        .where(and(eq(driverLicense.id, licenceId), eq(driverLicense.driverId, driverId)))
        .for("update")
        .limit(1);
      if (!licence) throw new DomainError("not_found", "Licence not found");
      await tx
        .update(driverLicense)
        .set({ isPrimary: false })
        .where(and(eq(driverLicense.driverId, driverId), eq(driverLicense.isPrimary, true)));
      await tx.update(driverLicense).set({ isPrimary: true }).where(eq(driverLicense.id, licenceId));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "driver_licence.primary_changed",
        entityType: "driver_licence",
        entityId: licenceId,
        after: { driverId, isPrimary: true },
      });
      return { id: licenceId };
    }, serializable),
  );
}

export async function verifyLicence(actorUserId: string, driverId: string, licenceId: string) {
  await assertStaff(actorUserId);
  return withSerializableRetry(() =>
    db.transaction(async (tx) => {
      const [licence] = await tx
        .select()
        .from(driverLicense)
        .where(and(eq(driverLicense.id, licenceId), eq(driverLicense.driverId, driverId)))
        .for("update")
        .limit(1);
      if (!licence) throw new DomainError("not_found", "Licence not found");
      if (licence.verifiedAt) throw new DomainError("invalid_state", "Licence is already verified");
      await tx.update(driverLicense).set({ verifiedAt: new Date() }).where(eq(driverLicense.id, licenceId));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "driver_licence.verified",
        entityType: "driver_licence",
        entityId: licenceId,
        after: { driverId, verified: true },
      });
      return { id: licenceId };
    }, serializable),
  );
}
