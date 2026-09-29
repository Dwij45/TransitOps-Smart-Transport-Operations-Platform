"use client";

import { useActionState } from "react";

import { createTripAction, dispatchTripAction, updateTripAction } from "@/app/(workspace)/trips/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";

export interface TripOption {
  id: string;
  label: string;
  archived?: boolean;
  eligible?: boolean;
}

export interface TripFormValues {
  id?: string;
  originLocationId: string;
  destinationLocationId: string;
  cargoWeightKg: string;
  plannedDistanceKm: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  quotedRevenue: string;
  customerName: string;
  externalReference: string;
  notes: string;
  vehicleId: string;
  driverId: string;
  canDispatch: boolean;
}

export function TripForm({
  locations,
  vehicles,
  drivers,
  values,
}: {
  locations: TripOption[];
  vehicles: TripOption[];
  drivers: TripOption[];
  values?: TripFormValues;
}) {
  const action = values ? updateTripAction : createTripAction;
  const [state, formAction, pending] = useActionState(action, null as ActionState);
  const [dispatchState, dispatchAction, dispatching] = useActionState(dispatchTripAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const current = values ?? {
    originLocationId: "",
    destinationLocationId: "",
    cargoWeightKg: "",
    plannedDistanceKm: "",
    scheduledStartAt: "",
    scheduledEndAt: "",
    quotedRevenue: "",
    customerName: "",
    externalReference: "",
    notes: "",
    vehicleId: "",
    driverId: "",
    canDispatch: false,
  };

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        {values ? <input type="hidden" name="id" value={values.id} /> : null}
        {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origin" htmlFor="originLocationId" error={errors?.originLocationId?.[0]}>
            <Select id="originLocationId" name="originLocationId" defaultValue={current.originLocationId} required>
              <option value="">Choose an origin</option>
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.archived ? `${item.label} (archived)` : item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Destination" htmlFor="destinationLocationId" error={errors?.destinationLocationId?.[0]}>
            <Select id="destinationLocationId" name="destinationLocationId" defaultValue={current.destinationLocationId} required>
              <option value="">Choose a destination</option>
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.archived ? `${item.label} (archived)` : item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cargo weight (kg)" htmlFor="cargoWeightKg" error={errors?.cargoWeightKg?.[0]}>
            <Input id="cargoWeightKg" name="cargoWeightKg" inputMode="decimal" defaultValue={current.cargoWeightKg} required className="h-11" />
          </Field>
          <Field label="Planned distance (km)" htmlFor="plannedDistanceKm" error={errors?.plannedDistanceKm?.[0]}>
            <Input id="plannedDistanceKm" name="plannedDistanceKm" inputMode="decimal" defaultValue={current.plannedDistanceKm} required className="h-11" />
          </Field>
          <Field label="Scheduled start" htmlFor="scheduledStartAt" error={errors?.scheduledStartAt?.[0]}>
            <Input id="scheduledStartAt" name="scheduledStartAt" type="datetime-local" defaultValue={current.scheduledStartAt} required className="h-11" />
          </Field>
          <Field label="Scheduled end" htmlFor="scheduledEndAt" error={errors?.scheduledEndAt?.[0]}>
            <Input id="scheduledEndAt" name="scheduledEndAt" type="datetime-local" defaultValue={current.scheduledEndAt} className="h-11" />
          </Field>
          <Field label="Quoted revenue (INR)" htmlFor="quotedRevenue" error={errors?.quotedRevenue?.[0]}>
            <Input id="quotedRevenue" name="quotedRevenue" inputMode="decimal" defaultValue={current.quotedRevenue} className="h-11" />
          </Field>
          <Field label="Customer" htmlFor="customerName" error={errors?.customerName?.[0]}>
            <Input id="customerName" name="customerName" defaultValue={current.customerName} className="h-11" />
          </Field>
          <Field label="External reference" htmlFor="externalReference" error={errors?.externalReference?.[0]}>
            <Input id="externalReference" name="externalReference" defaultValue={current.externalReference} className="h-11" />
          </Field>
          <Field label="Vehicle" htmlFor="vehicleId" error={errors?.vehicleId?.[0]}>
            <Select id="vehicleId" name="vehicleId" defaultValue={current.vehicleId}>
              <option value="">Unassigned</option>
              {vehicles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.eligible === false ? `${item.label} (not eligible)` : item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Driver" htmlFor="driverId" error={errors?.driverId?.[0]}>
            <Select id="driverId" name="driverId" defaultValue={current.driverId}>
              <option value="">Unassigned</option>
              {drivers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.eligible === false ? `${item.label} (not eligible)` : item.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes" htmlFor="notes" error={errors?.notes?.[0]}>
          <textarea
            id="notes"
            name="notes"
            defaultValue={current.notes}
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Field>
        <div>
          <Button type="submit" disabled={pending} className="h-11">
            {pending ? "Saving" : values ? "Save draft" : "Create draft"}
          </Button>
        </div>
      </form>
      {values?.canDispatch ? (
        <form action={dispatchAction} className="grid gap-3">
          <input type="hidden" name="id" value={values.id} />
          {dispatchState ? <Notice tone={dispatchState.ok ? "success" : "error"} title={dispatchState.message} /> : null}
          <p className="text-sm text-muted-foreground">
            Dispatch uses the saved vehicle and driver. Capacity, licence, duty, and a live assignment are checked again before the trip leaves draft.
          </p>
          <div>
            <Button type="submit" disabled={dispatching} className="h-11">
              {dispatching ? "Dispatching" : "Dispatch trip"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
