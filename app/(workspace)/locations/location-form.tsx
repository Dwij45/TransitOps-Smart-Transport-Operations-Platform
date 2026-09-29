"use client";

import { useActionState } from "react";

import {
  archiveLocationAction,
  createLocationAction,
  updateLocationAction,
} from "@/app/(workspace)/locations/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";

export interface LocationTypeOption {
  id: string;
  name: string;
  archived: boolean;
}

export interface LocationFormValues {
  id?: string;
  name: string;
  typeId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  archived: boolean;
}

export function LocationForm({
  types,
  values,
}: {
  types: LocationTypeOption[];
  values?: LocationFormValues;
}) {
  const action = values ? updateLocationAction : createLocationAction;
  const [state, formAction, pending] = useActionState(action, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const current = values ?? {
    name: "",
    typeId: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    countryCode: "IN",
    latitude: "",
    longitude: "",
    archived: false,
  };

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        {values ? <input type="hidden" name="id" value={values.id} /> : null}
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
          <Field label="Address" htmlFor="addressLine1" error={errors?.addressLine1?.[0]}>
            <Input id="addressLine1" name="addressLine1" defaultValue={current.addressLine1} required className="h-11" aria-invalid={Boolean(errors?.addressLine1)} />
          </Field>
          <Field label="Address line 2" htmlFor="addressLine2" error={errors?.addressLine2?.[0]}>
            <Input id="addressLine2" name="addressLine2" defaultValue={current.addressLine2} className="h-11" />
          </Field>
          <Field label="City" htmlFor="city" error={errors?.city?.[0]}>
            <Input id="city" name="city" defaultValue={current.city} required className="h-11" aria-invalid={Boolean(errors?.city)} />
          </Field>
          <Field label="State" htmlFor="state" error={errors?.state?.[0]}>
            <Input id="state" name="state" defaultValue={current.state} required className="h-11" aria-invalid={Boolean(errors?.state)} />
          </Field>
          <Field label="Postal code" htmlFor="postalCode" error={errors?.postalCode?.[0]}>
            <Input id="postalCode" name="postalCode" defaultValue={current.postalCode} className="h-11" />
          </Field>
          <Field label="Country" htmlFor="countryCode" error={errors?.countryCode?.[0]}>
            <Input id="countryCode" name="countryCode" defaultValue={current.countryCode} required maxLength={2} className="h-11" aria-invalid={Boolean(errors?.countryCode)} />
          </Field>
          <Field label="Latitude" htmlFor="latitude" error={errors?.latitude?.[0]}>
            <Input id="latitude" name="latitude" defaultValue={current.latitude} inputMode="decimal" className="h-11" aria-invalid={Boolean(errors?.latitude)} />
          </Field>
          <Field label="Longitude" htmlFor="longitude" error={errors?.longitude?.[0]}>
            <Input id="longitude" name="longitude" defaultValue={current.longitude} inputMode="decimal" className="h-11" aria-invalid={Boolean(errors?.longitude)} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="h-11 w-fit">
          {pending ? "Saving..." : values ? "Save location" : "Create location"}
        </Button>
      </form>
      {values && !values.archived && values.id ? <ArchiveLocationButton id={values.id} /> : null}
    </div>
  );
}

function ArchiveLocationButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(archiveLocationAction, null as ActionState);

  return (
    <div className="grid gap-3">
      {state && !state.ok ? <Notice tone="error" title={state.message} /> : null}
      <ConfirmDialog
        title="Archive this location"
        description="It stays in the registry for history. New trips and a new default depot cannot select it."
        trigger="Archive"
      >
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive" disabled={pending} className="h-11">
            {pending ? "Archiving..." : "Archive location"}
          </Button>
        </form>
      </ConfirmDialog>
    </div>
  );
}
