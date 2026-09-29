import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import {
  canManageDrivers,
  canManageExpenses,
  canManageMaintenance,
  canManageVehicles,
  canPlanTrips,
} from "@/lib/registry-access";
import { requireUser } from "@/lib/session";

export default async function ExportsPage() {
  const user = await requireUser();
  const links = [
    canManageVehicles(user.role) ? ["fleet", "Vehicles"] : null,
    canManageDrivers(user.role) ? ["drivers", "Drivers"] : null,
    canPlanTrips(user.role) ? ["trips", "Trips"] : null,
    canManageMaintenance(user.role) ? ["maintenance", "Maintenance"] : null,
    canManageExpenses(user.role) ? ["expenses", "Expenses"] : null,
    canManageExpenses(user.role) ? ["reports", "Report ledger"] : null,
  ].filter((item): item is [string, string] => Boolean(item));

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title="Exports"
        description="Each download is a CSV of at most 1,000 rows, using the records this role can already see. The audit log stores the dataset and row count, not the file."
      />
      {links.length === 0 ? <p className="text-sm">This role has no exportable datasets.</p> : null}
      <ul className="grid gap-2">
        {links.map(([dataset, label]) => (
          <li key={dataset}>
            <Link href={`/api/exports/${dataset}`} className="underline-offset-4 hover:underline">
              Download {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
