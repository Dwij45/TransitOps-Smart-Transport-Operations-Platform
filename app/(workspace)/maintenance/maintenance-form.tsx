"use client";

import { useActionState } from "react";

import {
  addLineAction,
  cancelMaintenanceAction,
  completeMaintenanceAction,
  scheduleMaintenanceAction,
  startMaintenanceAction,
  uploadMaintenanceDocumentAction,
} from "@/app/(workspace)/maintenance/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";
import { minorToMajor } from "@/lib/vehicle-rules";

export function ScheduleForm({
  vehicles,
  types,
}: {
  vehicles: { id: string; label: string }[];
  types: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(scheduleMaintenanceAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-4">
      {state && !state.ok ? <Notice tone="error" title={state.message} /> : null}
      <Field label="Vehicle" htmlFor="vehicleId" error={errors?.vehicleId?.[0]}>
        <Select id="vehicleId" name="vehicleId" required defaultValue="">
          <option value="">Choose a vehicle</option>
          {vehicles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Service type" htmlFor="serviceTypeId" error={errors?.serviceTypeId?.[0]}>
        <Select id="serviceTypeId" name="serviceTypeId" required defaultValue="">
          <option value="">Choose a service</option>
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Scheduled" htmlFor="scheduledAt" error={errors?.scheduledAt?.[0]}>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required className="h-11" />
      </Field>
      <Field label="Vendor" htmlFor="vendorName">
        <Input id="vendorName" name="vendorName" className="h-11" />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Input id="notes" name="notes" className="h-11" />
      </Field>
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Saving" : "Schedule"}
      </Button>
    </form>
  );
}

export function OrderActions({
  orderId,
  start,
  complete,
  cancel,
  editLines,
}: {
  orderId: string;
  start: boolean;
  complete: boolean;
  cancel: boolean;
  editLines: boolean;
}) {
  const [startState, startAction, starting] = useActionState(startMaintenanceAction, null as ActionState);
  const [completeState, completeAction, completing] = useActionState(completeMaintenanceAction, null as ActionState);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelMaintenanceAction, null as ActionState);
  const [lineState, lineAction, lining] = useActionState(addLineAction, null as ActionState);
  const [fileState, fileAction, uploading] = useActionState(uploadMaintenanceDocumentAction, null as ActionState);
  const lineErrors = lineState && !lineState.ok ? lineState.fieldErrors : undefined;

  return (
    <div className="grid gap-8">
      {editLines ? (
        <form action={lineAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="orderId" value={orderId} />
          {lineState ? <Notice tone={lineState.ok ? "success" : "error"} title={lineState.message} /> : null}
          <Field label="Kind" htmlFor="kind">
            <Select id="kind" name="kind" defaultValue="part">
              <option value="part">Part</option>
              <option value="labour">Labour</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="description" error={lineErrors?.description?.[0]}>
            <Input id="description" name="description" required className="h-11" />
          </Field>
          <Field label="Quantity" htmlFor="quantity" error={lineErrors?.quantity?.[0]}>
            <Input id="quantity" name="quantity" defaultValue="1" required className="h-11" />
          </Field>
          <Field label="Unit amount (INR)" htmlFor="unitAmount" error={lineErrors?.unitAmount?.[0]}>
            <Input id="unitAmount" name="unitAmount" inputMode="decimal" required className="h-11" />
          </Field>
          <Button type="submit" disabled={lining} className="h-11">
            {lining ? "Adding" : "Add line"}
          </Button>
        </form>
      ) : null}
      {start ? (
        <form action={startAction}>
          <input type="hidden" name="id" value={orderId} />
          {startState ? <Notice tone={startState.ok ? "success" : "error"} title={startState.message} /> : null}
          <Button type="submit" disabled={starting} className="h-11">
            {starting ? "Starting" : "Start work"}
          </Button>
        </form>
      ) : null}
      {complete ? (
        <form action={completeAction} className="grid gap-3">
          <input type="hidden" name="id" value={orderId} />
          {completeState ? <Notice tone={completeState.ok ? "success" : "error"} title={completeState.message} /> : null}
          <Field label="Closing odometer (km)" htmlFor="closingOdometerKm">
            <Input id="closingOdometerKm" name="closingOdometerKm" inputMode="decimal" required className="h-11" />
          </Field>
          <Button type="submit" disabled={completing} className="h-11">
            {completing ? "Completing" : "Complete and post expense"}
          </Button>
        </form>
      ) : null}
      {cancel ? (
        <form action={cancelAction} className="grid gap-3">
          <input type="hidden" name="id" value={orderId} />
          {cancelState ? <Notice tone={cancelState.ok ? "success" : "error"} title={cancelState.message} /> : null}
          <Field label="Cancellation reason" htmlFor="reason">
            <Input id="reason" name="reason" required className="h-11" />
          </Field>
          <Button type="submit" variant="destructive" disabled={cancelling} className="h-11">
            {cancelling ? "Cancelling" : "Cancel order"}
          </Button>
        </form>
      ) : null}
      <form action={fileAction} className="grid gap-3">
        <input type="hidden" name="orderId" value={orderId} />
        {fileState ? <Notice tone={fileState.ok ? "success" : "error"} title={fileState.message} /> : null}
        <Field label="Service document" htmlFor="file">
          <Input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="h-11" />
        </Field>
        <Button type="submit" disabled={uploading} className="h-11">
          {uploading ? "Uploading" : "Upload document"}
        </Button>
      </form>
    </div>
  );
}

export function formatMinor(value: bigint): string {
  return minorToMajor(value);
}
