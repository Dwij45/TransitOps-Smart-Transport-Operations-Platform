import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
  location,
  locationType,
  safetyEventType,
  vehicleType,
} from "@/db/schema/fleet";
import { maintenanceServiceType } from "@/db/schema/finance";
import { appSettings, auditEvent } from "@/db/schema/platform";
import { auditMetadata } from "@/lib/audit";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";
import { listSelectableLocations } from "@/lib/services/locations";

export const lookupKinds = [
  "vehicle_type",
  "location_type",
  "maintenance_service_type",
  "safety_event_type",
] as const;

export type LookupKind = (typeof lookupKinds)[number];

export interface SettingsInput {
  operatorName: string;
  defaultDepotId: string | null;
  currency: string;
  timezone: string;
  distanceUnit: "kilometre" | "mile";
  weightUnit: "kilogram" | "pound";
}

export interface LookupInput {
  kind: LookupKind;
  name: string;
  description?: string | null;
  defaultPoints?: string | null;
}

export interface LookupRow {
  id: string;
  name: string;
  detail: string | null;
  archivedAt: Date | null;
}

export interface DepotOption {
  id: string;
  label: string;
  archived: boolean;
}

export interface SettingsView {
  operatorName: string;
  defaultDepotId: string | null;
  currency: string;
  timezone: string;
  distanceUnit: "kilometre" | "mile";
  weightUnit: "kilogram" | "pound";
  depots: DepotOption[];
  lookups: Record<LookupKind, LookupRow[]>;
}

async function assertSettingsAdmin(actorUserId: string) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "user:manage")) {
    throw new DomainError("forbidden", "Only an administrator can change settings");
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    return true;
  }
  if (typeof error === "object" && error !== null && "cause" in error) {
    return isUniqueViolation(error.cause);
  }
  return false;
}

function settingsSnapshot(row: {
  operatorName: string;
  defaultDepotId: string | null;
  currency: string;
  timezone: string;
  distanceUnit: "kilometre" | "mile";
  weightUnit: "kilogram" | "pound";
}) {
  return {
    operatorName: row.operatorName,
    defaultDepotId: row.defaultDepotId,
    currency: row.currency,
    timezone: row.timezone,
    distanceUnit: row.distanceUnit,
    weightUnit: row.weightUnit,
  };
}

async function listLookups(kind: LookupKind): Promise<LookupRow[]> {
  if (kind === "vehicle_type") {
    const rows = await db
      .select({
        id: vehicleType.id,
        name: vehicleType.name,
        detail: vehicleType.description,
        archivedAt: vehicleType.archivedAt,
      })
      .from(vehicleType)
      .orderBy(asc(vehicleType.name));
    return rows;
  }

  if (kind === "location_type") {
    const rows = await db
      .select({
        id: locationType.id,
        name: locationType.name,
        archivedAt: locationType.archivedAt,
      })
      .from(locationType)
      .orderBy(asc(locationType.name));
    return rows.map((row) => ({ ...row, detail: null }));
  }

  if (kind === "maintenance_service_type") {
    const rows = await db
      .select({
        id: maintenanceServiceType.id,
        name: maintenanceServiceType.name,
        detail: maintenanceServiceType.description,
        archivedAt: maintenanceServiceType.archivedAt,
      })
      .from(maintenanceServiceType)
      .orderBy(asc(maintenanceServiceType.name));
    return rows;
  }

  const rows = await db
    .select({
      id: safetyEventType.id,
      name: safetyEventType.name,
      detail: safetyEventType.defaultPoints,
      archivedAt: safetyEventType.archivedAt,
    })
    .from(safetyEventType)
    .orderBy(asc(safetyEventType.name));
  return rows.map((row) => ({
    ...row,
    detail: `${row.detail} points`,
  }));
}

export async function getSettingsWorkspace(actorUserId: string): Promise<SettingsView> {
  await assertSettingsAdmin(actorUserId);

  const [settings] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  const depots = await listSelectableLocations(settings?.defaultDepotId);

  const [vehicleRows, locationRows, maintenanceRows, safetyRows] = await Promise.all([
    listLookups("vehicle_type"),
    listLookups("location_type"),
    listLookups("maintenance_service_type"),
    listLookups("safety_event_type"),
  ]);

  return {
    operatorName: settings?.operatorName ?? "",
    defaultDepotId: settings?.defaultDepotId ?? null,
    currency: settings?.currency ?? "INR",
    timezone: settings?.timezone ?? "Asia/Kolkata",
    distanceUnit: settings?.distanceUnit ?? "kilometre",
    weightUnit: settings?.weightUnit ?? "kilogram",
    depots: depots.map((depot) => ({
      id: depot.id,
      label: depot.archived ? `${depot.name}, ${depot.city} (archived)` : `${depot.name}, ${depot.city}`,
      archived: depot.archived,
    })),
    lookups: {
      vehicle_type: vehicleRows,
      location_type: locationRows,
      maintenance_service_type: maintenanceRows,
      safety_event_type: safetyRows,
    },
  };
}

export async function updateOperatorSettings(actorUserId: string, input: SettingsInput) {
  await assertSettingsAdmin(actorUserId);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .for("update")
      .limit(1);

    if (input.defaultDepotId) {
      const [depot] = await tx
        .select({ id: location.id, archivedAt: location.archivedAt })
        .from(location)
        .where(eq(location.id, input.defaultDepotId))
        .limit(1);

      if (!depot) {
        throw new DomainError("validation_failed", "Choose a depot that exists");
      }

      if (depot.archivedAt && depot.id !== existing?.defaultDepotId) {
        throw new DomainError("validation_failed", "Archived depots cannot be selected");
      }
    }

    const next = {
      operatorName: input.operatorName,
      defaultDepotId: input.defaultDepotId,
      currency: input.currency,
      timezone: input.timezone,
      distanceUnit: input.distanceUnit,
      weightUnit: input.weightUnit,
    };

    if (!existing) {
      await tx.insert(appSettings).values({ id: 1, ...next });
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "settings.created",
        entityType: "app_settings",
        entityId: "1",
        after: next,
      });
      return { id: "1" };
    }

    await tx.update(appSettings).set(next).where(eq(appSettings.id, 1));
    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "settings.updated",
      entityType: "app_settings",
      entityId: "1",
      before: settingsSnapshot(existing),
      after: next,
    });

    return { id: "1" };
  });
}

export async function createLookup(actorUserId: string, input: LookupInput) {
  await assertSettingsAdmin(actorUserId);

  try {
    return await db.transaction(async (tx) => {
      let id = "";
      let after: Record<string, unknown> = { name: input.name };

      if (input.kind === "vehicle_type") {
        const [row] = await tx
          .insert(vehicleType)
          .values({ name: input.name, description: input.description ?? null })
          .returning({ id: vehicleType.id });
        id = row.id;
        after = { name: input.name, description: input.description ?? null };
      } else if (input.kind === "location_type") {
        const [row] = await tx
          .insert(locationType)
          .values({ name: input.name })
          .returning({ id: locationType.id });
        id = row.id;
      } else if (input.kind === "maintenance_service_type") {
        const [row] = await tx
          .insert(maintenanceServiceType)
          .values({ name: input.name, description: input.description ?? null })
          .returning({ id: maintenanceServiceType.id });
        id = row.id;
        after = { name: input.name, description: input.description ?? null };
      } else {
        const [row] = await tx
          .insert(safetyEventType)
          .values({ name: input.name, defaultPoints: input.defaultPoints ?? "0" })
          .returning({ id: safetyEventType.id });
        id = row.id;
        after = { name: input.name, defaultPoints: input.defaultPoints ?? "0" };
      }

      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "lookup.created",
        entityType: input.kind,
        entityId: id,
        after,
      });

      return { id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("conflict", "A classification with this name already exists");
    }
    throw error;
  }
}

export async function archiveLookup(actorUserId: string, kind: LookupKind, id: string) {
  await assertSettingsAdmin(actorUserId);

  return db.transaction(async (tx) => {
    const archivedAt = new Date();

    if (kind === "vehicle_type") {
      const [current] = await tx
        .select({ id: vehicleType.id, archivedAt: vehicleType.archivedAt, name: vehicleType.name })
        .from(vehicleType)
        .where(eq(vehicleType.id, id))
        .for("update")
        .limit(1);
      if (!current) throw new DomainError("not_found", "Classification not found");
      if (current.archivedAt) throw new DomainError("invalid_state", "Classification is already archived");
      await tx.update(vehicleType).set({ archivedAt }).where(eq(vehicleType.id, id));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "lookup.archived",
        entityType: kind,
        entityId: id,
        before: { name: current.name, archivedAt: null },
        after: { name: current.name, archivedAt: archivedAt.toISOString() },
      });
      return { id };
    }

    if (kind === "location_type") {
      const [current] = await tx
        .select({ id: locationType.id, archivedAt: locationType.archivedAt, name: locationType.name })
        .from(locationType)
        .where(eq(locationType.id, id))
        .for("update")
        .limit(1);
      if (!current) throw new DomainError("not_found", "Classification not found");
      if (current.archivedAt) throw new DomainError("invalid_state", "Classification is already archived");
      await tx.update(locationType).set({ archivedAt }).where(eq(locationType.id, id));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "lookup.archived",
        entityType: kind,
        entityId: id,
        before: { name: current.name, archivedAt: null },
        after: { name: current.name, archivedAt: archivedAt.toISOString() },
      });
      return { id };
    }

    if (kind === "maintenance_service_type") {
      const [current] = await tx
        .select({
          id: maintenanceServiceType.id,
          archivedAt: maintenanceServiceType.archivedAt,
          name: maintenanceServiceType.name,
        })
        .from(maintenanceServiceType)
        .where(eq(maintenanceServiceType.id, id))
        .for("update")
        .limit(1);
      if (!current) throw new DomainError("not_found", "Classification not found");
      if (current.archivedAt) throw new DomainError("invalid_state", "Classification is already archived");
      await tx.update(maintenanceServiceType).set({ archivedAt }).where(eq(maintenanceServiceType.id, id));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "lookup.archived",
        entityType: kind,
        entityId: id,
        before: { name: current.name, archivedAt: null },
        after: { name: current.name, archivedAt: archivedAt.toISOString() },
      });
      return { id };
    }

    const [current] = await tx
      .select({
        id: safetyEventType.id,
        archivedAt: safetyEventType.archivedAt,
        name: safetyEventType.name,
      })
      .from(safetyEventType)
      .where(eq(safetyEventType.id, id))
      .for("update")
      .limit(1);
    if (!current) throw new DomainError("not_found", "Classification not found");
    if (current.archivedAt) throw new DomainError("invalid_state", "Classification is already archived");
    await tx.update(safetyEventType).set({ archivedAt }).where(eq(safetyEventType.id, id));
    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId,
      action: "lookup.archived",
      entityType: kind,
      entityId: id,
      before: { name: current.name, archivedAt: null },
      after: { name: current.name, archivedAt: archivedAt.toISOString() },
    });
    return { id };
  });
}

export async function selectableLookupNames(kind: LookupKind): Promise<string[]> {
  const rows = await listLookups(kind);
  return rows.filter((row) => row.archivedAt === null).map((row) => row.name);
}
