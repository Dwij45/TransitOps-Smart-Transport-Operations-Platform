import Link from "next/link";
import { notFound } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { canManageVehicles } from "@/lib/registry-access";
import { getVehicle, listVehicleTypes } from "@/lib/services/vehicles";
import { requireUser } from "@/lib/session";
import { minorToMajor } from "@/lib/vehicle-rules";
import { isDispatchEligible, vehicleDisplayLabels, type VehicleDisplayStatus } from "@/lib/vehicle-status";
import { VehicleForm } from "./vehicle-form";
import { VehicleDocuments } from "./vehicle-documents";

function calendarDate(value: Date | null) {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const tones: Record<VehicleDisplayStatus, "success" | "warning" | "neutral" | "danger"> = {
  available: "success",
  reserved: "warning",
  on_trip: "neutral",
  in_shop: "warning",
  retired: "danger",
};

export async function VehicleEditorPage({ id }: { id?: string }) {
  const user = await requireUser();
  if (!canManageVehicles(user.role)) return <Forbidden />;
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const current = id ? await getVehicle(user.id, id) : null;
  if (id && !current) notFound();
  const types = await listVehicleTypes(user.id);
  const choices = types.filter((type) => !type.archived || type.id === current?.typeId);

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title={current ? current.registrationNumber : "New vehicle"}
        description="Registration and fleet numbers stay unique regardless of letter case. Mileage cannot move backwards."
      />
      <Link href="/fleet" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to vehicles
      </Link>
      {current ? (
        <div className="flex flex-wrap gap-2">
          <Badge tone={tones[current.displayStatus]}>{vehicleDisplayLabels[current.displayStatus]}</Badge>
          <Badge tone={isDispatchEligible(current.displayStatus) ? "success" : "neutral"}>
            {isDispatchEligible(current.displayStatus) ? "Dispatch eligible" : "Not dispatch eligible"}
          </Badge>
        </div>
      ) : null}
      {choices.length === 0 ? (
        <EmptyState title="No vehicle types" description="Add a vehicle type in Settings before creating a vehicle." />
      ) : (
        <VehicleForm
          types={choices}
          values={
            current
              ? {
                  id: current.id,
                  registrationNumber: current.registrationNumber,
                  fleetNumber: current.fleetNumber ?? "",
                  name: current.name,
                  manufacturer: current.manufacturer ?? "",
                  model: current.model ?? "",
                  typeId: current.typeId,
                  capacityKg: current.capacityKg,
                  currentOdometerKm: current.currentOdometerKm,
                  acquisitionCost: minorToMajor(current.acquisitionCostMinor),
                  acquisitionCurrency: current.acquisitionCurrency,
                  acquiredOn: calendarDate(current.acquiredOn),
                  lifecycle: current.lifecycle,
                  canRetire: current.lifecycle !== "retired" && current.displayStatus !== "reserved" && current.displayStatus !== "on_trip",
                }
              : undefined
          }
        />
      )}
      {current ? <VehicleDocuments vehicleId={current.id} /> : null}
    </div>
  );
}
