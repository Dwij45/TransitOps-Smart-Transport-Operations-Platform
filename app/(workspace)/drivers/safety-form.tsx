"use client";

import { useActionState } from "react";

import { recordSafetyEventAction } from "@/app/(workspace)/drivers/safety-action";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";

export function SafetyEventForm({
  driverId,
  types,
}: {
  driverId: string;
  types: { id: string; name: string; defaultPoints: string }[];
}) {
  const [state, action, pending] = useActionState(recordSafetyEventAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="driverId" value={driverId} />
      {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="eventTypeId" error={errors?.eventTypeId?.[0]}>
          <Select id="eventTypeId" name="eventTypeId" required defaultValue="">
            <option value="">Choose a type</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} ({type.defaultPoints} points)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Severity" htmlFor="severity" error={errors?.severity?.[0]}>
          <Select id="severity" name="severity" defaultValue="low">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </Field>
        <Field label="Date" htmlFor="occurredOn" error={errors?.occurredOn?.[0]}>
          <Input id="occurredOn" name="occurredOn" type="date" required className="h-11" />
        </Field>
        <Field label="Summary" htmlFor="summary" error={errors?.summary?.[0]}>
          <Input id="summary" name="summary" required className="h-11" />
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes" error={errors?.notes?.[0]}>
        <Input id="notes" name="notes" className="h-11" />
      </Field>
      <Button type="submit" disabled={pending} className="h-11 w-fit">
        {pending ? "Recording..." : "Record event"}
      </Button>
    </form>
  );
}
