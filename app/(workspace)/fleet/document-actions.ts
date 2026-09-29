"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { allowedDocumentTypes, MAX_DOCUMENT_BYTES } from "@/lib/document-policy";
import { removeVehicleDocument, uploadVehicleDocument } from "@/lib/services/documents";
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

const uploadSchema = z.object({
  vehicleId: z.string().regex(uuidPattern, "Choose a vehicle"),
  expiresOn: z.string().trim().refine((value) => value === "" || isIsoDate(value), "Enter a valid expiry date"),
  file: z
    .instanceof(File, { message: "Choose a file" })
    .refine((file) => file.size > 0 && file.size <= MAX_DOCUMENT_BYTES, "File must be 1 MB or smaller")
    .refine(
      (file) => (allowedDocumentTypes as readonly string[]).includes(file.type),
      "Use a PDF, JPEG, PNG, or WebP file",
    ),
});

const removeSchema = z.object({
  vehicleId: z.string().regex(uuidPattern, "Choose a vehicle"),
  documentId: z.string().regex(uuidPattern, "Choose a document"),
});

function failure(result: OperationResult<unknown>): ActionState {
  if (result.ok) return { ok: true, message: "Saved" };
  return {
    ok: false,
    message: result.error.message,
    fieldErrors: result.error.fieldErrors,
  };
}

export async function uploadDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, uploadSchema, (actor, input) =>
    uploadVehicleDocument(actor.userId, {
      vehicleId: input.vehicleId,
      file: input.file,
      expiresOn: input.expiresOn ? parseDate(input.expiresOn) : null,
    }),
  );
  if (!result.ok) return failure(result);
  revalidatePath(`/fleet/${inputVehicleId(formData)}`);
  return { ok: true, message: "Document uploaded." };
}

export async function removeDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await executeProtectedFormOperation(formData, removeSchema, (actor, input) =>
    removeVehicleDocument(actor.userId, input.vehicleId, input.documentId),
  );
  if (!result.ok) return failure(result);
  revalidatePath(`/fleet/${inputVehicleId(formData)}`);
  return { ok: true, message: "Document removed." };
}

function inputVehicleId(formData: FormData) {
  const value = formData.get("vehicleId");
  return typeof value === "string" ? value : "";
}
