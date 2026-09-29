import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { driverLicense, vehicle } from "@/db/schema/fleet";
import { auditEvent, document } from "@/db/schema/platform";
import { auditMetadata } from "@/lib/audit";
import type { UserRole } from "@/lib/authorization";
import {
  detectDocumentType,
  MAX_DOCUMENT_BYTES,
  type AllowedDocumentType,
} from "@/lib/document-policy";
import { isForeignKeyViolation } from "@/lib/db-error";
import { DomainError } from "@/lib/domain-error";
import { putObject, readObject, removeObject } from "@/lib/object-storage";
import { canManageDrivers, canManageVehicles } from "@/lib/registry-access";
import { withSerializableRetry } from "@/lib/transaction";

const serializable = { isolationLevel: "serializable", accessMode: "read write" } as const;

export interface VehicleDocumentRow {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: bigint;
  expiresOn: Date | null;
  createdAt: Date;
}

async function assertManage(actorUserId: string) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);
  const role = actor?.role as UserRole | undefined;
  if (!role || !canManageVehicles(role)) {
    throw new DomainError("forbidden", "Only an administrator or fleet manager can change vehicle documents");
  }
}

function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 80);
  return cleaned || "document";
}

export async function listVehicleDocuments(
  actorUserId: string,
  vehicleId: string,
): Promise<VehicleDocumentRow[]> {
  await assertManage(actorUserId);
  return db
    .select({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      byteSize: document.byteSize,
      expiresOn: document.expiresOn,
      createdAt: document.createdAt,
    })
    .from(document)
    .where(eq(document.vehicleId, vehicleId))
    .orderBy(desc(document.createdAt));
}

export async function uploadVehicleDocument(
  actorUserId: string,
  input: { vehicleId: string; file: File; expiresOn: Date | null },
) {
  await assertManage(actorUserId);

  const [vehicleRow] = await db
    .select({ id: vehicle.id })
    .from(vehicle)
    .where(eq(vehicle.id, input.vehicleId))
    .limit(1);
  if (!vehicleRow) throw new DomainError("not_found", "Vehicle not found");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new DomainError("validation_failed", "File must be between 1 byte and 1 MB");
  }

  const detected = detectDocumentType(bytes);
  if (!detected || detected !== input.file.type) {
    throw new DomainError("validation_failed", "File content does not match an allowed type");
  }

  const id = crypto.randomUUID();
  const filename = safeFilename(input.file.name);
  const storageKey = `vehicles/${input.vehicleId}/${id}/${filename}`;
  const mimeType: AllowedDocumentType = detected;
  await putObject(storageKey, bytes);

  try {
    await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        await tx.insert(document).values({
          id,
          storageKey,
          filename,
          mimeType,
          byteSize: BigInt(bytes.length),
          expiresOn: input.expiresOn,
          uploadedByUserId: actorUserId,
          vehicleId: input.vehicleId,
        });
        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: "document.uploaded",
          entityType: "document",
          entityId: id,
          after: {
            vehicleId: input.vehicleId,
            filename,
            mimeType,
            byteSize: bytes.length,
          },
        });
      }, serializable),
    );
  } catch (error) {
    await removeObject(storageKey).catch(() => undefined);
    if (isForeignKeyViolation(error)) throw new DomainError("not_found", "Vehicle not found");
    throw error;
  }

  return { id };
}

export async function removeVehicleDocument(
  actorUserId: string,
  vehicleId: string,
  documentId: string,
) {
  await assertManage(actorUserId);

  const storageKey = await withSerializableRetry(() =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(document)
        .where(eq(document.id, documentId))
        .for("update")
        .limit(1);

      if (!row || row.vehicleId !== vehicleId) {
        throw new DomainError("not_found", "Document not found");
      }

      await tx.delete(document).where(eq(document.id, documentId));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "document.removed",
        entityType: "document",
        entityId: documentId,
        before: { vehicleId, filename: row.filename, storageKey: row.storageKey },
      });

      return row.storageKey;
    }, serializable),
  );

  await removeObject(storageKey).catch((error: unknown) => {
    console.error("[object-storage] remove failed", { storageKey, error });
  });

  return { id: vehicleId };
}

async function assertDriverStaff(actorUserId: string) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);
  const role = actor?.role as UserRole | undefined;
  if (!role || !canManageDrivers(role)) {
    throw new DomainError("forbidden", "Only safety staff can change licence documents");
  }
}

export async function listLicenceDocuments(actorUserId: string, licenceId: string) {
  await assertDriverStaff(actorUserId);
  return db
    .select({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      byteSize: document.byteSize,
      expiresOn: document.expiresOn,
      createdAt: document.createdAt,
    })
    .from(document)
    .where(eq(document.driverLicenseId, licenceId))
    .orderBy(desc(document.createdAt));
}

export async function uploadLicenceDocument(
  actorUserId: string,
  input: { licenceId: string; file: File; expiresOn: Date | null },
) {
  await assertDriverStaff(actorUserId);
  const [licence] = await db
    .select({ id: driverLicense.id })
    .from(driverLicense)
    .where(eq(driverLicense.id, input.licenceId))
    .limit(1);
  if (!licence) throw new DomainError("not_found", "Licence not found");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new DomainError("validation_failed", "File must be between 1 byte and 1 MB");
  }
  const detected = detectDocumentType(bytes);
  if (!detected || detected !== input.file.type) {
    throw new DomainError("validation_failed", "File content does not match an allowed type");
  }

  const id = crypto.randomUUID();
  const filename = safeFilename(input.file.name);
  const storageKey = `licences/${input.licenceId}/${id}/${filename}`;
  await putObject(storageKey, bytes);
  try {
    await withSerializableRetry(() =>
      db.transaction(async (tx) => {
        await tx.insert(document).values({
          id,
          storageKey,
          filename,
          mimeType: detected,
          byteSize: BigInt(bytes.length),
          expiresOn: input.expiresOn,
          uploadedByUserId: actorUserId,
          driverLicenseId: input.licenceId,
        });
        await tx.insert(auditEvent).values({
          ...auditMetadata(),
          actorUserId,
          action: "document.uploaded",
          entityType: "document",
          entityId: id,
          after: { driverLicenseId: input.licenceId, filename, mimeType: detected, byteSize: bytes.length },
        });
      }, serializable),
    );
  } catch (error) {
    await removeObject(storageKey).catch(() => undefined);
    if (isForeignKeyViolation(error)) throw new DomainError("not_found", "Licence not found");
    throw error;
  }
  return { id };
}

export async function removeLicenceDocument(actorUserId: string, licenceId: string, documentId: string) {
  await assertDriverStaff(actorUserId);
  const storageKey = await withSerializableRetry(() =>
    db.transaction(async (tx) => {
      const [row] = await tx.select().from(document).where(eq(document.id, documentId)).for("update").limit(1);
      if (!row || row.driverLicenseId !== licenceId) throw new DomainError("not_found", "Document not found");
      await tx.delete(document).where(eq(document.id, documentId));
      await tx.insert(auditEvent).values({
        ...auditMetadata(),
        actorUserId,
        action: "document.removed",
        entityType: "document",
        entityId: documentId,
        before: { driverLicenseId: licenceId, filename: row.filename },
      });
      return row.storageKey;
    }, serializable),
  );
  await removeObject(storageKey).catch((error: unknown) => {
    console.error("[object-storage] remove failed", { storageKey, error });
  });
  return { id: licenceId };
}

export async function readStaffDocument(actorUserId: string, documentId: string) {
  const [row] = await db
    .select({
      filename: document.filename,
      mimeType: document.mimeType,
      storageKey: document.storageKey,
      vehicleId: document.vehicleId,
      driverLicenseId: document.driverLicenseId,
    })
    .from(document)
    .where(eq(document.id, documentId))
    .limit(1);

  if (row?.vehicleId) await assertManage(actorUserId);
  else if (row?.driverLicenseId) await assertDriverStaff(actorUserId);
  else throw new DomainError("not_found", "Document not found");

  return {
    filename: row.filename,
    mimeType: row.mimeType,
    body: await readObject(row.storageKey),
  };
}

export async function readVehicleDocument(actorUserId: string, documentId: string) {
  return readStaffDocument(actorUserId, documentId);
}
