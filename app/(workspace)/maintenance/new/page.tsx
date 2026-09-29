import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { canManageMaintenance } from "@/lib/registry-access";
import { listMaintenanceVehicles, listServiceTypes } from "@/lib/services/maintenance";
import { requireUser } from "@/lib/session";
import { ScheduleForm } from "../maintenance-form";

export default async function NewMaintenancePage() {
  const user = await requireUser();
  if (!canManageMaintenance(user.role)) return <Forbidden />;
  const [vehicles, types] = await Promise.all([listMaintenanceVehicles(user.id), listServiceTypes(user.id)]);
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader title="Schedule maintenance" description="The vehicle stays available until the work is started." />
      <ScheduleForm
        vehicles={vehicles.map((item) => ({ id: item.id, label: `${item.registrationNumber} · ${item.name}` }))}
        types={types}
      />
    </div>
  );
}
