import Link from "next/link";

import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageMaintenance } from "@/lib/registry-access";
import { listMaintenanceOrders } from "@/lib/services/maintenance";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const tone = { scheduled: "neutral", in_progress: "warning", completed: "success", cancelled: "danger" } as const;

export default async function MaintenancePage() {
  const user = await requireUser();
  if (!canManageMaintenance(user.role)) return <Forbidden />;
  const rows = await listMaintenanceOrders(user.id);

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Maintenance"
          description="Schedule service, start it to take the vehicle out of dispatch, then complete it to post one expense and restore the vehicle when the shop is clear."
        />
        <Link href="/maintenance/new" className={cn(buttonVariants(), "h-11")}>
          Schedule work
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No maintenance orders" description="Scheduled work stays dispatchable until it is started." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/maintenance/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                    {row.code}
                  </Link>
                </TableCell>
                <TableCell>{row.registrationNumber}</TableCell>
                <TableCell>{row.serviceName}</TableCell>
                <TableCell>
                  <Badge tone={tone[row.status]}>{row.status.replace("_", " ")}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
