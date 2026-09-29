"use client";

import { useActionState } from "react";

import { recordExpenseAction, recordFuelAction, updateExpenseAction, uploadReceiptAction } from "@/app/(workspace)/expenses/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";

export function FuelForm({ vehicles }: { vehicles: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(recordFuelAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-3">
      <h2 className="text-sm font-medium">Fuel</h2>
      {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
      <Field label="Vehicle" htmlFor="vehicleId" error={errors?.vehicleId?.[0]}>
        <Select id="vehicleId" name="vehicleId" required defaultValue="">
          <option value="">Choose a vehicle</option>
          {vehicles.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Trip id" htmlFor="tripId">
        <Input id="tripId" name="tripId" placeholder="Optional" className="h-11" />
      </Field>
      <Field label="Litres" htmlFor="litres" error={errors?.litres?.[0]}>
        <Input id="litres" name="litres" inputMode="decimal" required className="h-11" />
      </Field>
      <Field label="Amount (INR)" htmlFor="fuel-amount" error={errors?.amount?.[0]}>
        <Input id="fuel-amount" name="amount" inputMode="decimal" required className="h-11" />
      </Field>
      <Field label="Fuel type" htmlFor="fuelType">
        <Input id="fuelType" name="fuelType" defaultValue="diesel" required className="h-11" />
      </Field>
      <Field label="Vendor" htmlFor="fuel-vendor">
        <Input id="fuel-vendor" name="vendorName" className="h-11" />
      </Field>
      <Field label="Odometer (km)" htmlFor="odometerKm" error={errors?.odometerKm?.[0]}>
        <Input id="odometerKm" name="odometerKm" inputMode="decimal" required className="h-11" />
      </Field>
      <Field label="When" htmlFor="fuel-when" error={errors?.incurredAt?.[0]}>
        <Input id="fuel-when" name="incurredAt" type="datetime-local" required className="h-11" />
      </Field>
      <Button type="submit" disabled={pending} className="h-11">{pending ? "Saving" : "Log fuel"}</Button>
    </form>
  );
}

export function OtherExpenseForm({ vehicles }: { vehicles: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(recordExpenseAction, null as ActionState);
  return (
    <form action={action} className="grid gap-3">
      <h2 className="text-sm font-medium">Toll or miscellaneous</h2>
      {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
      <Field label="Kind" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="toll">
          <option value="toll">Toll</option>
          <option value="miscellaneous">Miscellaneous</option>
        </Select>
      </Field>
      <Field label="Vehicle" htmlFor="other-vehicle">
        <Select id="other-vehicle" name="vehicleId" defaultValue="">
          <option value="">None</option>
          {vehicles.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Description" htmlFor="description">
        <Input id="description" name="description" required className="h-11" />
      </Field>
      <Field label="Amount (INR)" htmlFor="other-amount">
        <Input id="other-amount" name="amount" inputMode="decimal" required className="h-11" />
      </Field>
      <Field label="Vendor" htmlFor="other-vendor">
        <Input id="other-vendor" name="vendorName" className="h-11" />
      </Field>
      <Field label="When" htmlFor="other-when">
        <Input id="other-when" name="incurredAt" type="datetime-local" required className="h-11" />
      </Field>
      <Button type="submit" disabled={pending} className="h-11">{pending ? "Saving" : "Record expense"}</Button>
    </form>
  );
}

export function EditExpenseForm({ id, description, vendorName }: { id: string; description: string; vendorName: string }) {
  const [state, action, pending] = useActionState(updateExpenseAction, null as ActionState);
  const [receipt, receiptAction, uploading] = useActionState(uploadReceiptAction, null as ActionState);
  return (
    <div className="grid gap-2">
      <form action={action} className="grid gap-2 sm:grid-cols-4">
        <input type="hidden" name="id" value={id} />
        <Input name="description" defaultValue={description} aria-label="Description" className="h-11" />
        <Input name="vendorName" defaultValue={vendorName} aria-label="Vendor" className="h-11" />
        <Input name="amount" inputMode="decimal" placeholder="Amount" aria-label="Amount" required className="h-11" />
        <Button type="submit" disabled={pending} className="h-11">{pending ? "Saving" : "Update"}</Button>
        {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
      </form>
      <form action={receiptAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="expenseId" value={id} />
        <Input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Receipt" className="h-11" />
        <Button type="submit" disabled={uploading} variant="outline" className="h-11">{uploading ? "Uploading" : "Upload receipt"}</Button>
        {receipt ? <Notice tone={receipt.ok ? "success" : "error"} title={receipt.message} /> : null}
      </form>
    </div>
  );
}
