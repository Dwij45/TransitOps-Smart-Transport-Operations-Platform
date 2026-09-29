import Link from "next/link";
import { notFound } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { canPlanTrips } from "@/lib/registry-access";
import {
  getTrip,
  listAssignableDrivers,
  listAssignableVehicles,
  listTripLocations,
} from "@/lib/services/trip-planning";
import { requireUser } from "@/lib/session";
import { minorToMajor } from "@/lib/vehicle-rules";
import { TripForm } from "./trip-form";

function dateTimeLocal(value: Date | null): string {
  if (!value) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

const statusTone = {
  draft: "neutral",
  dispatched: "warning",
  in_progress: "success",
  completed: "success",
  cancelled: "danger",
} as const;

export async function TripEditorPage({ id }: { id?: string }) {
  const user = await requireUser();
  if (!canPlanTrips(user.role)) return <Forbidden />;
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const current = id ? await getTrip(user.id, id) : null;
  if (id && !current) notFound();

  const [locations, vehicles, drivers] = await Promise.all([
    listTripLocations(current?.originLocationId, current?.destinationLocationId),
    listAssignableVehicles(current?.cargoWeightKg ?? "", current?.vehicleId),
    listAssignableDrivers(current?.driverId),
  ]);
  const editable = !current || current.status === "draft";

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title={current ? current.code : "New trip"}
        description={
          editable
            ? "A draft can name an eligible vehicle and driver. Dispatch checks capacity, licence, duty, and live assignments again."
            : `${current.originName} to ${current.destinationName}. This trip is ${current.statusLabel.toLowerCase()} and can no longer be edited here.`
        }
      />
      {current ? <Badge tone={statusTone[current.status]}>{current.statusLabel}</Badge> : null}
      {editable ? (
        <TripForm
          locations={locations.map((item) => ({
            id: item.id,
            label: `${item.name}, ${item.city}`,
            archived: item.archived,
          }))}
          vehicles={vehicles}
          drivers={drivers}
          values={
            current
              ? {
                  id: current.id,
                  originLocationId: current.originLocationId,
                  destinationLocationId: current.destinationLocationId,
                  cargoWeightKg: current.cargoWeightKg,
                  plannedDistanceKm: current.plannedDistanceKm,
                  scheduledStartAt: dateTimeLocal(current.scheduledStartAt),
                  scheduledEndAt: dateTimeLocal(current.scheduledEndAt),
                  quotedRevenue: minorToMajor(current.quotedRevenueMinor),
                  customerName: current.customerName ?? "",
                  externalReference: current.externalReference ?? "",
                  notes: current.notes ?? "",
                  vehicleId: current.vehicleId ?? "",
                  driverId: current.driverId ?? "",
                  canDispatch: Boolean(current.vehicleId && current.driverId),
                }
              : undefined
          }
        />
      ) : current ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd>{current.vehicleLabel ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Driver</dt>
            <dd>{current.driverLabel ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cargo</dt>
            <dd>{current.cargoWeightKg} kg</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Distance</dt>
            <dd>{current.plannedDistanceKm} km</dd>
          </div>
        </dl>
      ) : null}
      <Link href="/trips" className="text-sm underline-offset-4 hover:underline">
        Back to trips
      </Link>
    </div>
  );
}
