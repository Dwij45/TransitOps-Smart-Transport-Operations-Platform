"use client";

import { useActionState } from "react";

import {
  addLicenceAction,
  makePrimaryAction,
  removeLicenceDocumentAction,
  uploadLicenceDocumentAction,
  verifyLicenceAction,
} from "@/app/(workspace)/drivers/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { ActionState } from "@/lib/action-state";
import { allowedDocumentTypes } from "@/lib/document-policy";

export function AddLicenceForm({ driverId }: { driverId: string }) {
  const [state, action, pending] = useActionState(addLicenceAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="driverId" value={driverId} />
      {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Licence number" htmlFor="licenseNumber" error={errors?.licenseNumber?.[0]}>
          <Input id="licenseNumber" name="licenseNumber" required className="h-11" />
        </Field>
        <Field label="Category" htmlFor="category" error={errors?.category?.[0]}>
          <Input id="category" name="category" required className="h-11" />
        </Field>
        <Field label="Issued" htmlFor="issuedOn" error={errors?.issuedOn?.[0]}>
          <Input id="issuedOn" name="issuedOn" type="date" className="h-11" />
        </Field>
        <Field label="Expires" htmlFor="expiresOn" error={errors?.expiresOn?.[0]}>
          <Input id="expiresOn" name="expiresOn" type="date" required className="h-11" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPrimary" className="size-4" />
        Make this the primary licence
      </label>
      <Button type="submit" disabled={pending} className="h-11 w-fit">
        {pending ? "Adding..." : "Add licence"}
      </Button>
    </form>
  );
}

export function LicenceActions({
  driverId,
  licenceId,
  primary,
  verified,
}: {
  driverId: string;
  licenceId: string;
  primary: boolean;
  verified: boolean;
}) {
  const [primaryState, primaryAction, primaryPending] = useActionState(makePrimaryAction, null as ActionState);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyLicenceAction, null as ActionState);
  return (
    <div className="flex flex-wrap gap-2">
      {primaryState && !primaryState.ok ? <Notice tone="error" title={primaryState.message} /> : null}
      {verifyState && !verifyState.ok ? <Notice tone="error" title={verifyState.message} /> : null}
      {primary ? null : (
        <form action={primaryAction}>
          <input type="hidden" name="driverId" value={driverId} />
          <input type="hidden" name="licenceId" value={licenceId} />
          <Button type="submit" variant="outline" disabled={primaryPending} className="h-11">
            Make primary
          </Button>
        </form>
      )}
      {verified ? null : (
        <form action={verifyAction}>
          <input type="hidden" name="driverId" value={driverId} />
          <input type="hidden" name="licenceId" value={licenceId} />
          <Button type="submit" variant="outline" disabled={verifyPending} className="h-11">
            Mark verified
          </Button>
        </form>
      )}
    </div>
  );
}

export function LicenceDocumentForm({ driverId, licenceId }: { driverId: string; licenceId: string }) {
  const [state, action, pending] = useActionState(uploadLicenceDocumentAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="licenceId" value={licenceId} />
      {state ? <div className="sm:col-span-2"><Notice tone={state.ok ? "success" : "error"} title={state.message} /></div> : null}
      <Field label="Document" htmlFor={`file-${licenceId}`} error={errors?.file?.[0]}>
        <Input id={`file-${licenceId}`} name="file" type="file" required accept={allowedDocumentTypes.join(",")} className="h-11" />
      </Field>
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}

export function RemoveLicenceDocumentButton({
  driverId,
  licenceId,
  documentId,
}: {
  driverId: string;
  licenceId: string;
  documentId: string;
}) {
  const [state, action, pending] = useActionState(removeLicenceDocumentAction, null as ActionState);
  return (
    <form action={action}>
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="licenceId" value={licenceId} />
      <input type="hidden" name="documentId" value={documentId} />
      {state && !state.ok ? <Notice tone="error" title={state.message} /> : null}
      <Button type="submit" variant="outline" disabled={pending} className="h-11">
        {pending ? "Removing..." : "Remove"}
      </Button>
    </form>
  );
}
