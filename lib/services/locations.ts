import "server-only";

import { and, asc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { location, locationType } from "@/db/schema/fleet";
import { auditEvent } from "@/db/schema/platform";
import { auditMetadata } from "@/lib/audit";
import type { UserRole } from "@/lib/authorization";
import { isUniqueViolation } from "@/lib/db-error";
import { DomainError } from "@/lib/domain-error";
import { canManageLocations, canViewLocations } from "@/lib/registry-access";
import { withSerializableRetry } from "@/lib/transaction";

const pageSize = 8;
const serializable = { isolationLevel: "serializable", accessMode: "read write" } as const;

export interface SelectableLocation {
  id: string;
  name: string;
  city: string;
  archived: boolean;
}

export interface LocationInput {
  name: string;
  typeId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  countryCode: string;
  latitude: string | null;
  longitude: string | null;
}

export interface LocationTypeChoice {
  id: string;
  name: string;
  archived: boolean;
}

export interface LocationListItem {
  id: string;
  name: string;
  typeName: string;
  city: string;
  state: string;
  archived: boolean;
}

export interface LocationDetail extends LocationInput {
  id: string;
  typeName: string;
  typeArchived: boolean;
  archived: boolean;
}

export interface LocationSearchResult {
  rows: LocationListItem[];
  total: number;
  page: number;
  pageCount: number;
}

async function actorRole(actorUserId: string): Promise<UserRole | null> {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);
  return actor?.role ?? null;
}

async function assertView(actorUserId: string) {
  const role = await actorRole(actorUserId);
  if (!role || !canViewLocations(role)) {
    throw new DomainError("forbidden", "You cannot view locations");
  }
}

async function assertManage(actorUserId: string) {
  const role = await actorRole(actorUserId);
  if (!role || !canManageLocations(role)) {
    throw new DomainError("forbidden", "Only an administrator or fleet manager can change locations");
  }
}

export async function listSelectableLocations(includeId?: string | null): Promise<SelectableLocation[]> {
  const rows = await db
    .select({
      id: location.id,
      name: location.name,
      city: location.city,
      archivedAt: location.archivedAt,
    })
    .from(location)
    .where(
      includeId
        ? or(isNull(location.archivedAt), eq(location.id, includeId))
        : isNull(location.archivedAt),
    )
    .orderBy(asc(location.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    archived: Boolean(row.archivedAt),
  }));
}

export async function listLocationTypes(actorUserId: string): Promise<LocationTypeChoice[]> {
  await assertView(actorUserId);
  const rows = await db
    .select({ id: locationType.id, name: locationType.name, archivedAt: locationType.archivedAt })
    .from(locationType)
    .orderBy(asc(locationType.name));
  return rows.map((row) => ({ id: row.id, name: row.name, archived: Boolean(row.archivedAt) }));
}

export async function searchLocations(
  actorUserId: string,
  query: { q: string; typeId: string; status: "active" | "archived" | "all"; page: number },
): Promise<LocationSearchResult> {
  await assertView(actorUserId);

  const conditions = [];
  const term = query.q.trim();
  if (term) {
    const pattern = `%${term.replace(/[%_\\]/g, "")}%`;
    conditions.push(
      or(
        ilike(location.name, pattern),
        ilike(location.city, pattern),
        ilike(location.addressLine1, pattern),
      ),
    );
  }
  if (query.typeId) conditions.push(eq(location.typeId, query.typeId));
  if (query.status === "active") conditions.push(isNull(location.archivedAt));
  if (query.status === "archived") conditions.push(isNotNull(location.archivedAt));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(location)
    .where(where);

  const pageCount = Math.max(1, Math.ceil(Number(total) / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const rows = await db
    .select({
      id: location.id,
      name: location.name,
      typeName: locationType.name,
      city: location.city,
      state: location.state,
      archivedAt: location.archivedAt,
    })
    .from(location)
    .innerJoin(locationType, eq(location.typeId, locationType.id))
    .where(where)
    .orderBy(asc(location.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      typeName: row.typeName,
      city: row.city,
      state: row.state,
      archived: Boolean(row.archivedAt),
    })),
    total: Number(total),
    page,
    pageCount,
  };
}

export async function getLocation(actorUserId: string, id: string): Promise<LocationDetail | null> {
  await assertView(actorUserId);
  const [row] = await db
    .select({
      id: location.id,
      name: location.name,
      typeId: location.typeId,
      typeName: locationType.name,
      typeArchivedAt: locationType.archivedAt,
      addressLine1: location.addressLine1,
      addressLine2: location.addressLine2,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode,
      countryCode: location.countryCode,
      latitude: location.latitude,
      longitude: location.longitude,
      archivedAt: location.archivedAt,
    })
    .from(location)
    .innerJoin(locationType, eq(location.typeId, locationType.id))
    .where(eq(location.id, id))
    .limit(1);

  if (!row || !row.typeId) return null;

  return {
    id: row.id,
    name: row.name,
    typeId: row.typeId,
    typeName: row.typeName,
    typeArchived: Boolean(row.typeArchivedAt),
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    countryCode: row.countryCode,
    latitude: row.latitude,
    longitude: row.longitude,
    archived: Boolean(row.archivedAt),
  };
}

async function assertTypeSelectable(
  typeId: string,
  currentTypeId: string | null,
) {
  const [type] = await db
    .select({ id: locationType.id, archivedAt: locationType.archivedAt })
    .from(locationType)
    .where(eq(locationType.id, typeId))
    .limit(1);

  if (!type) throw new DomainError("validation_failed", "Choose a location type");
  if (type.archivedAt && type.id !== currentTypeId) {
    throw new DomainError("validation_failed", "Archived location types cannot be selected");
  }
}

function locationValues(input: LocationInput) {
  return {
    name: input.name,
    typeId: input.typeId,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}

export async function createLocation(actorUserId: string, input: LocationInput) {
  await assertManage(actorUserId);
  await assertTypeSelectable(input.typeId, null);

  try {
    return await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(location)
          .values(locationValues(input))
          .returning({ id: location.id });

        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: "location.created",
          entityType: "location",
          entityId: created.id,
          after: { name: input.name, typeId: input.typeId, city: input.city },
        });

        return created;
      }, serializable),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("conflict", "Location conflicts with an existing record");
    throw error;
  }
}

export async function updateLocation(actorUserId: string, id: string, input: LocationInput) {
  await assertManage(actorUserId);

  try {
    return await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(location)
          .where(eq(location.id, id))
          .for("update")
          .limit(1);

        if (!current) throw new DomainError("not_found", "Location not found");
        await assertTypeSelectable(input.typeId, current.typeId);

        const [updated] = await tx
          .update(location)
          .set(locationValues(input))
          .where(eq(location.id, id))
          .returning({ id: location.id });

        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: "location.updated",
          entityType: "location",
          entityId: id,
          before: { name: current.name, typeId: current.typeId, city: current.city },
          after: { name: input.name, typeId: input.typeId, city: input.city },
        });

        return updated;
      }, serializable),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("conflict", "Location conflicts with an existing record");
    throw error;
  }
}

export async function archiveLocation(actorUserId: string, id: string) {
  await assertManage(actorUserId);

  return withSerializableRetry(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: location.id, archivedAt: location.archivedAt, name: location.name })
        .from(location)
        .where(eq(location.id, id))
        .for("update")
        .limit(1);

      if (!current) throw new DomainError("not_found", "Location not found");
      if (current.archivedAt) throw new DomainError("invalid_state", "Location is already archived");

      await tx.update(location).set({ archivedAt: new Date() }).where(eq(location.id, id));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "location.archived",
        entityType: "location",
        entityId: id,
        before: { name: current.name, archived: false },
        after: { name: current.name, archived: true },
      });

      return { id };
    }, serializable),
  );
}
