"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { allowedDocumentTypes, MAX_DOCUMENT_BYTES } from "@/lib/document-policy";
import { driverDutyStates } from "@/lib/driver-rules";
import { removeLicenceDocument, uploadLicenceDocument } from "@/lib/services/documents";
import { addLicence, archiveDriver, createDriver, makeLicencePrimary, updateDriver, verifyLicence } from "@/lib/services/drivers";
import { executeProtectedFormOperation, type OperationResult } from "@/lib/server-operation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const driverFields = z.object({
  employeeCode: z.string().trim().min(1, "Enter an employee code").max(32),
  name: z.string().trim().min(1, "Enter a name").max(120),
  phone: z.string().trim().min(6, "Enter a phone number").max(20),
  email: z.string().trim().max(160),
  dutyState: z.enum(driverDutyStates),
  hiredOn: z.string().trim().refine((value) => value === "" || isIsoDate(value), "Enter a valid date"),
});

const driverSchema = driverFields.transform((value) => ({
  employeeCode: value.employeeCode,
  name: value.name,
  phone: value.phone,
  email: value.email || null,
  dutyState: value.dutyState,
  hiredOn: value.hiredOn ? parseDate(value.hiredOn) : null,
}));

const updateDriverSchema = driverFields
  .extend({ id: z.string().regex(uuidPattern, "Choose a driver") })
  .transform((value) => ({
    id: value.id,
    input: {
      employeeCode: value.employeeCode,
      name: value.name,
      phone: value.phone,
      email: value.email || null,
      dutyState: value.dutyState,
      hiredOn: value.hiredOn ? parseDate(value.hiredOn) : null,
    },
  }));

const licenceSchema = z
  .object({
    driverId: z.string().regex(uuidPattern, "Choose a driver"),
    licenseNumber: z.string().trim().min(1, "Enter a licence number").max(40),
    category: z.string().trim().min(1, "Enter a category").max(40),
    issuedOn: z.string().trim().refine((value) => value === "" || isIsoDate(value), "Enter a valid issue date"),
    expiresOn: z.string().trim().refine((value) => isIsoDate(value), "Enter a valid expiry date"),
    isPrimary: z.string().optional(),
  })
  .transform((value) => ({
    driverId: value.driverId,
    input: {
      licenseNumber: value.licenseNumber,
      category: value.category,
      issuedOn: value.issuedOn ? parseDate(value.issuedOn) : null,
      expiresOn: parseDate(value.expiresOn),
      isPrimary: value.isPrimary === "on",
    },
  }));

const licenceIdSchema = z.object({
  driverId: z.string().regex(uuidPattern, "Choose a driver"),
  licenceId: z.string().regex(uuidPattern, "Choose a licence"),
});

const uploadSchema = z.object({
  driverId: z.string().regex(uuidPattern, "Choose a driver"),
  licenceId: z.string().regex(uuidPattern, "Choose a licence"),
  expiresOn: z.string().trim().refine((value) => value === "" || isIsoDate(value), "Enter a valid expiry date"),
  file: z
    .instanceof(File, { message: "Choose a file" })
    .refine((file) => file.size > 0 && file.size <= MAX_DOCUMENT_BYTES, "File must be 1 MB or smaller")
    .refine(
      (file) => (allowedDocumentTypes as readonly string[]).includes(file.type),
      "Use a PDF, JPEG, PNG, or WebP file",
    ),
});

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return { ok: false, message: result.error.message, fieldErrors: result.error.fieldErrors };
}

function refresh(driverId: string) {
  revalidatePath("/drivers");
  revalidatePath(`/drivers/${driverId}`);
}

export async function createDriverAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, driverSchema, (actor, input) =>
    createDriver(actor.userId, input),
  );
  if (!result.ok) return failure(result);
  refresh(result.data.id);
  redirect(`/drivers/${result.data.id}`);
}

export async function updateDriverAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, updateDriverSchema, (actor, input) =>
    updateDriver(actor.userId, input.id, input.input),
  );
  if (!result.ok) return failure(result);
  refresh(result.data.id);
  return { ok: true, message: "Driver saved." };
}

export async function archiveDriverAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(
    formData,
    z.object({ id: z.string().regex(uuidPattern, "Choose a driver") }),
    (actor, input) => archiveDriver(actor.userId, input.id),
  );
  if (!result.ok) return failure(result);
  revalidatePath("/drivers");
  redirect("/drivers");
}

export async function addLicenceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, licenceSchema, (actor, input) =>
    addLicence(actor.userId, input.driverId, input.input),
  );
  if (!result.ok) return failure(result);
  const driverId = String(formData.get("driverId") ?? "");
  refresh(driverId);
  return { ok: true, message: "Licence added." };
}

export async function makePrimaryAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, licenceIdSchema, (actor, input) =>
    makeLicencePrimary(actor.userId, input.driverId, input.licenceId),
  );
  if (!result.ok) return failure(result);
  refresh(String(formData.get("driverId") ?? ""));
  return { ok: true, message: "Primary licence updated." };
}

export async function verifyLicenceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, licenceIdSchema, (actor, input) =>
    verifyLicence(actor.userId, input.driverId, input.licenceId),
  );
  if (!result.ok) return failure(result);
  refresh(String(formData.get("driverId") ?? ""));
  return { ok: true, message: "Licence verified." };
}

export async function uploadLicenceDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, uploadSchema, (actor, input) =>
    uploadLicenceDocument(actor.userId, {
      licenceId: input.licenceId,
      file: input.file,
      expiresOn: input.expiresOn ? parseDate(input.expiresOn) : null,
    }),
  );
  if (!result.ok) return failure(result);
  refresh(String(formData.get("driverId") ?? ""));
  return { ok: true, message: "Licence document uploaded." };
}

export async function removeLicenceDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(
    formData,
    licenceIdSchema.extend({ documentId: z.string().regex(uuidPattern, "Choose a document") }),
    (actor, input) => removeLicenceDocument(actor.userId, input.licenceId, input.documentId),
  );
  if (!result.ok) return failure(result);
  refresh(String(formData.get("driverId") ?? ""));
  return { ok: true, message: "Licence document removed." };
}
