"use client";

import { useActionState } from "react";

import { archiveDriverAction, createDriverAction, updateDriverAction } from "@/app/(workspace)/drivers/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";
import { driverDutyStates, type DriverDutyState } from "@/lib/driver-rules";

const dutyLabels: Record<DriverDutyState, string> = {
  on_duty: "On duty",
  off_duty: "Off duty",
  suspended: "Suspended",
};

export function DriverForm({
  values,
}: {
  values?: {
    id: string;
    employeeCode: string;
    name: string;
    phone: string;
    email: string;
    dutyState: DriverDutyState;
    hiredOn: string;
    archived: boolean;
  };
}) {
  const action = values ? updateDriverAction : createDriverAction;
  const [state, formAction, pending] = useActionState(action, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const current = values ?? {
    employeeCode: "",
    name: "",
    phone: "",
    email: "",
    dutyState: "off_duty" as const,
    hiredOn: "",
    archived: false,
  };

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        {values ? <input type="hidden" name="id" value={values.id} /> : null}
        {state ? <Notice tone={state.ok ? "success" : "error"} title={state.message} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors?.name?.[0]}>
            <Input id="name" name="name" defaultValue={current.name} required className="h-11" />
          </Field>
          <Field label="Employee code" htmlFor="employeeCode" error={errors?.employeeCode?.[0]}>
            <Input id="employeeCode" name="employeeCode" defaultValue={current.employeeCode} required className="h-11" />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors?.phone?.[0]}>
            <Input id="phone" name="phone" defaultValue={current.phone} required className="h-11" />
          </Field>
          <Field label="Email" htmlFor="email" error={errors?.email?.[0]}>
            <Input id="email" name="email" type="email" defaultValue={current.email} className="h-11" />
          </Field>
          <Field label="Duty" htmlFor="dutyState" error={errors?.dutyState?.[0]}>
            <Select id="dutyState" name="dutyState" defaultValue={current.dutyState}>
              {driverDutyStates.map((duty) => (
                <option key={duty} value={duty}>
                  {dutyLabels[duty]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hired on" htmlFor="hiredOn" error={errors?.hiredOn?.[0]}>
            <Input id="hiredOn" name="hiredOn" type="date" defaultValue={current.hiredOn} className="h-11" />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="h-11 w-fit">
          {pending ? "Saving..." : values ? "Save driver" : "Create driver"}
        </Button>
      </form>
      {values && !values.archived ? <ArchiveDriverButton id={values.id} /> : null}
    </div>
  );
}

function ArchiveDriverButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(archiveDriverAction, null as ActionState);
  return (
    <div className="grid gap-3">
      {state && !state.ok ? <Notice tone="error" title={state.message} /> : null}
      <ConfirmDialog
        title="Archive this driver"
        description="The profile stays on record. An archived driver is taken off duty and cannot be dispatched."
        trigger="Archive"
      >
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive" disabled={pending} className="h-11">
            {pending ? "Archiving..." : "Archive driver"}
          </Button>
        </form>
      </ConfirmDialog>
    </div>
  );
}
