"use client";

import { useActionState } from "react";

import { removeDocumentAction, uploadDocumentAction } from "@/app/(workspace)/fleet/document-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { ActionState } from "@/lib/action-state";
import { allowedDocumentTypes } from "@/lib/document-policy";

export function DocumentUpload({ vehicleId }: { vehicleId: string }) {
  const [state, action, pending] = useActionState(uploadDocumentAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {state ? <div className="sm:col-span-3"><Notice tone={state.ok ? "success" : "error"} title={state.message} /></div> : null}
      <Field label="File" htmlFor="file" error={errors?.file?.[0]}>
        <Input
          id="file"
          name="file"
          type="file"
          required
          accept={allowedDocumentTypes.join(",")}
          className="h-11"
          aria-invalid={Boolean(errors?.file)}
        />
      </Field>
      <Field label="Expires" htmlFor="expiresOn" error={errors?.expiresOn?.[0]}>
        <Input id="expiresOn" name="expiresOn" type="date" className="h-11" aria-invalid={Boolean(errors?.expiresOn)} />
      </Field>
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}

export function RemoveDocumentButton({
  vehicleId,
  documentId,
}: {
  vehicleId: string;
  documentId: string;
}) {
  const [state, action, pending] = useActionState(removeDocumentAction, null as ActionState);

  return (
    <div className="grid justify-items-start gap-2">
      {state && !state.ok ? <Notice tone="error" title={state.message} /> : null}
      <ConfirmDialog
        title="Remove this document"
        description="The file is deleted from storage. This does not change the vehicle record."
        trigger="Remove"
      >
        <form action={action}>
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <input type="hidden" name="documentId" value={documentId} />
          <Button type="submit" variant="destructive" disabled={pending} className="h-11">
            {pending ? "Removing..." : "Remove document"}
          </Button>
        </form>
      </ConfirmDialog>
    </div>
  );
}
