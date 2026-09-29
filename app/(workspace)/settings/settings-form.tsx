"use client";

import { useActionState } from "react";

import { updateSettingsAction } from "@/app/(workspace)/settings/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";
import type { DepotOption } from "@/lib/services/operator-settings";

export function SettingsForm({
  operatorName,
  defaultDepotId,
  currency,
  timezone,
  distanceUnit,
  weightUnit,
  depots,
}: {
  operatorName: string;
  defaultDepotId: string | null;
  currency: string;
  timezone: string;
  distanceUnit: "kilometre" | "mile";
  weightUnit: "kilogram" | "pound";
  depots: DepotOption[];
}) {
  const [state, action, pending] = useActionState(updateSettingsAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="grid gap-4">
      {state ? (
        <Notice tone={state.ok ? "success" : "error"} title={state.message} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Operator name" htmlFor="operatorName" error={errors?.operatorName?.[0]}>
          <Input
            id="operatorName"
            name="operatorName"
            defaultValue={operatorName}
            required
            aria-invalid={Boolean(errors?.operatorName)}
            aria-describedby={errors?.operatorName ? "operatorName-error" : undefined}
            className="h-11"
          />
        </Field>
        <Field label="Default depot" htmlFor="defaultDepotId" error={errors?.defaultDepotId?.[0]}>
          <Select
            id="defaultDepotId"
            name="defaultDepotId"
            defaultValue={defaultDepotId ?? ""}
            aria-invalid={Boolean(errors?.defaultDepotId)}
          >
            <option value="">No default depot</option>
            {depots.map((depot) => (
              <option key={depot.id} value={depot.id} disabled={depot.archived && depot.id !== defaultDepotId}>
                {depot.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" htmlFor="currency" error={errors?.currency?.[0]}>
          <Input id="currency" name="currency" defaultValue={currency} required maxLength={3} className="h-11" aria-invalid={Boolean(errors?.currency)} />
        </Field>
        <Field label="Timezone" htmlFor="timezone" error={errors?.timezone?.[0]}>
          <Input id="timezone" name="timezone" defaultValue={timezone} required className="h-11" aria-invalid={Boolean(errors?.timezone)} />
        </Field>
        <Field label="Distance unit" htmlFor="distanceUnit" error={errors?.distanceUnit?.[0]}>
          <Select id="distanceUnit" name="distanceUnit" defaultValue={distanceUnit}>
            <option value="kilometre">Kilometre</option>
            <option value="mile">Mile</option>
          </Select>
        </Field>
        <Field label="Weight unit" htmlFor="weightUnit" error={errors?.weightUnit?.[0]}>
          <Select id="weightUnit" name="weightUnit" defaultValue={weightUnit}>
            <option value="kilogram">Kilogram</option>
            <option value="pound">Pound</option>
          </Select>
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="h-11 w-fit">
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
