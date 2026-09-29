import Link from "next/link";
import { notFound } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { canManageMaintenance } from "@/lib/registry-access";
import { listMaintenanceDocuments } from "@/lib/services/documents";
import { getMaintenanceOrder } from "@/lib/services/maintenance";
import { requireUser } from "@/lib/session";
import { maintenanceActions } from "@/lib/maintenance-rules";
import { minorToMajor } from "@/lib/vehicle-rules";
import { OrderActions } from "../maintenance-form";

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageMaintenance(user.role)) return <Forbidden />;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const order = await getMaintenanceOrder(user.id, id);
  if (!order) notFound();
  const documents = await listMaintenanceDocuments(user.id, id);
  const actions = maintenanceActions(order.status);

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title={order.code}
        description={`${order.registrationNumber} · ${order.serviceName}. Starting work sets the vehicle in shop. Completion posts a single expense for these lines.`}
      />
      <Badge>{order.status.replace("_", " ")}</Badge>
      <ul className="grid gap-2 text-sm">
        {order.lines.map((line) => (
          <li key={line.id}>
            {line.kind}: {line.description} × {line.quantity} = INR {minorToMajor(line.unitAmountMinor)} each
          </li>
        ))}
        {order.lines.length === 0 ? <li>No parts or labour yet.</li> : null}
      </ul>
      <ul className="grid gap-2 text-sm">
        {documents.map((item) => (
          <li key={item.id}>
            <a className="underline-offset-4 hover:underline" href={`/api/documents/${item.id}`}>
              {item.filename}
            </a>
          </li>
        ))}
      </ul>
      {order.cancellationReason ? <p className="text-sm">Cancelled: {order.cancellationReason}</p> : null}
      <OrderActions orderId={order.id} {...actions} />
      <Link href="/maintenance" className="text-sm underline-offset-4 hover:underline">
        Back to maintenance
      </Link>
    </div>
  );
}
