"use client";

import { useActionState } from "react";

import { retireVehicleAction, updateVehicleAction, createVehicleAction } from "@/app/(workspace)/fleet/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";
import { vehicleLifecycles, type VehicleLifecycle } from "@/lib/vehicle-status";

const lifecycleLabels: Record<VehicleLifecycle, string> = {
  active: "Active",
  in_shop: "In shop",
  retired: "Retired",
};

export interface VehicleTypeOption {
  id: string;
  name: string;
  archived: boolean;
}

export interface VehicleFormValues {
  id?: string;
  registrationNumber: string;
  fleetNumber: string;
  name: string;
  manufacturer: string;
  model: string;
  typeId: string;
  capacityKg: string;
  currentOdometerKm: string;
  acquisitionCost: string;
  acquisitionCurrency: string;
  acquiredOn: string;
  lifecycle: VehicleLifecycle;
  canRetire: boolean;
}

export function VehicleForm({
  types,
  values,
}: {
  types: VehicleTypeOption[];
  values?: VehicleFormValues;
}) {
  const action = values ? updateVehicleAction : createVehicleAction;
  const [state, formAction, pending] = useActionState(action, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const current = values ?? {
    registrationNumber: "",
    fleetNumber: "",
    name: "",
    manufacturer: "",
    model: "",
    typeId: "",
    capacityKg: "",
    currentOdometerKm: "0",
    acquisitionCost: "",
    acquisitionCurrency: "INR",
    acquiredOn: "",
    lifecycle: "active" as const,
    canRetire: false,
  };

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}
        {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors?.name?.[0]}>
            <Input id="name" name="name" defaultValue={current.name} required className="h-11" aria-invalid={Boolean(errors?.name)} />
          </Field>
          <Field label="Type" htmlFor="typeId" error={errors?.typeId?.[0]}>
            <Select id="typeId" name="typeId" defaultValue={current.typeId} required aria-invalid={Boolean(errors?.typeId)}>
              <option value="">Choose a type</option>
              {types.map((type) => (
                <option key={type.id} value={type.id} disabled={type.archived && type.id !== current.typeId}>
                  {type.archived ? `${type.name} (archived)` : type.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Registration number" htmlFor="registrationNumber" error={errors?.registrationNumber?.[0]}>
            <Input id="registrationNumber" name="registrationNumber" defaultValue={current.registrationNumber} required className="h-11" aria-invalid={Boolean(errors?.registrationNumber)} />
          </Field>
          <Field label="Fleet number" htmlFor="fleetNumber" error={errors?.fleetNumber?.[0]}>
            <Input id="fleetNumber" name="fleetNumber" defaultValue={current.fleetNumber} className="h-11" aria-invalid={Boolean(errors?.fleetNumber)} />
          </Field>
          <Field label="Manufacturer" htmlFor="manufacturer" error={errors?.manufacturer?.[0]}>
            <Input id="manufacturer" name="manufacturer" defaultValue={current.manufacturer} className="h-11" />
          </Field>
          <Field label="Model" htmlFor="model" error={errors?.model?.[0]}>
            <Input id="model" name="model" defaultValue={current.model} className="h-11" />
          </Field>
          <Field label="Capacity (kg)" htmlFor="capacityKg" error={errors?.capacityKg?.[0]}>
            <Input id="capacityKg" name="capacityKg" defaultValue={current.capacityKg} required inputMode="decimal" className="h-11" aria-invalid={Boolean(errors?.capacityKg)} />
          </Field>
          <Field label="Odometer (km)" htmlFor="currentOdometerKm" error={errors?.currentOdometerKm?.[0]}>
            <Input id="currentOdometerKm" name="currentOdometerKm" defaultValue={current.currentOdometerKm} required inputMode="decimal" className="h-11" aria-invalid={Boolean(errors?.currentOdometerKm)} />
          </Field>
          <Field label="Acquisition cost" htmlFor="acquisitionCost" error={errors?.acquisitionCost?.[0]}>
            <Input id="acquisitionCost" name="acquisitionCost" defaultValue={current.acquisitionCost} inputMode="decimal" placeholder="0.00" className="h-11" aria-invalid={Boolean(errors?.acquisitionCost)} />
          </Field>
          <Field label="Currency" htmlFor="acquisitionCurrency" error={errors?.acquisitionCurrency?.[0]}>
            <Input id="acquisitionCurrency" name="acquisitionCurrency" defaultValue={current.acquisitionCurrency} required maxLength={3} className="h-11" aria-invalid={Boolean(errors?.acquisitionCurrency)} />
          </Field>
          <Field label="Acquired on" htmlFor="acquiredOn" error={errors?.acquiredOn?.[0]}>
            <Input id="acquiredOn" name="acquiredOn" type="date" defaultValue={current.acquiredOn} className="h-11" aria-invalid={Boolean(errors?.acquiredOn)} />
          </Field>
          {values ? (
            <Field label="Lifecycle" htmlFor="lifecycle" error={errors?.lifecycle?.[0]}>
              <Select id="lifecycle" name="lifecycle" defaultValue={current.lifecycle}>
                {vehicleLifecycles.map((lifecycle) => (
                  <option key={lifecycle} value={lifecycle}>
                    {lifecycleLabels[lifecycle]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
        <Button type="submit" disabled={pending} className="h-11 w-fit">
          {pending ? "Saving..." : values ? "Save vehicle" : "Create vehicle"}
        </Button>
      </form>
      {values?.id && values.canRetire ? <RetireVehicleButton id={values.id} /> : null}
    </div>
  );
}

function RetireVehicleButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(retireVehicleAction, null as ActionState);

  return (
    <div className="grid gap-3">
      {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
      <ConfirmDialog
        title="Retire this vehicle"
        description="A retired vehicle stays in the registry and is excluded from dispatch."
        trigger="Retire"
      >
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive" disabled={pending} className="h-11">
            {pending ? "Retiring..." : "Retire vehicle"}
          </Button>
        </form>
      </ConfirmDialog>
    </div>
  );
}
