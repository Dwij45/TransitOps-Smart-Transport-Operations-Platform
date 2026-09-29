"use client";

import { useActionState } from "react";

import { cancelTripAction, completeTripAction, startTripAction } from "@/app/(workspace)/trips/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { ActionState } from "@/lib/action-state";

export function TripOperations({
  tripId,
  start,
  complete,
  cancel,
  startOdometerKm,
  vehicleOdometerKm,
}: {
  tripId: string;
  start: boolean;
  complete: boolean;
  cancel: boolean;
  startOdometerKm: string;
  vehicleOdometerKm: string;
}) {
  const [startState, startAction, starting] = useActionState(startTripAction, null as ActionState);
  const [completeState, completeAction, completing] = useActionState(completeTripAction, null as ActionState);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelTripAction, null as ActionState);
  const completeErrors = completeState && !completeState.ok ? completeState.fieldErrors : undefined;
  const cancelErrors = cancelState && !cancelState.ok ? cancelState.fieldErrors : undefined;

  return (
    <div className="grid gap-6">
      {start ? (
        <form action={startAction} className="grid gap-3">
          <input type="hidden" name="id" value={tripId} />
          {startState ? <Notice tone={startState.ok ? "success" : "error"} title={startState.message} /> : null}
          <p className="text-sm text-muted-foreground">
            Starting records the current time and copies the vehicle odometer as the trip start.
          </p>
          <div>
            <Button type="submit" disabled={starting} className="h-11">
              {starting ? "Starting" : "Start trip"}
            </Button>
          </div>
        </form>
      ) : null}
      {complete ? (
        <form action={completeAction} className="grid gap-4">
          <input type="hidden" name="id" value={tripId} />
          <input type="hidden" name="startOdometerKm" value={startOdometerKm} />
          <input type="hidden" name="vehicleOdometerKm" value={vehicleOdometerKm} />
          {completeState ? <Notice tone={completeState.ok ? "success" : "error"} title={completeState.message} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="End odometer (km)" htmlFor="endOdometerKm" error={completeErrors?.endOdometerKm?.[0]}>
              <Input id="endOdometerKm" name="endOdometerKm" inputMode="decimal" required className="h-11" />
            </Field>
            <Field label="Final revenue (INR)" htmlFor="finalRevenue" error={completeErrors?.finalRevenue?.[0]}>
              <Input id="finalRevenue" name="finalRevenue" inputMode="decimal" required className="h-11" />
            </Field>
          </div>
          <div>
            <Button type="submit" disabled={completing} className="h-11">
              {completing ? "Completing" : "Complete trip"}
            </Button>
          </div>
        </form>
      ) : null}
      {cancel ? (
        <form action={cancelAction} className="grid gap-4">
          <input type="hidden" name="id" value={tripId} />
          {cancelState ? <Notice tone={cancelState.ok ? "success" : "error"} title={cancelState.message} /> : null}
          <Field label="Cancellation reason" htmlFor="reason" error={cancelErrors?.reason?.[0]}>
            <Input id="reason" name="reason" required className="h-11" />
          </Field>
          <div>
            <Button type="submit" variant="destructive" disabled={cancelling} className="h-11">
              {cancelling ? "Cancelling" : "Cancel trip"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
