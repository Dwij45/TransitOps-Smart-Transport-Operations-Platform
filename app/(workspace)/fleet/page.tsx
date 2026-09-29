import Link from "next/link";

import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageVehicles } from "@/lib/registry-access";
import { listDispatchableVehicles, listVehicleTypes, searchVehicles } from "@/lib/services/vehicles";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { vehicleDisplayLabels, vehicleDisplayStatuses, type VehicleDisplayStatus } from "@/lib/vehicle-status";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tones: Record<VehicleDisplayStatus, "success" | "warning" | "neutral" | "danger"> = {
  available: "success",
  reserved: "warning",
  on_trip: "neutral",
  in_shop: "warning",
  retired: "danger",
};

function fleetHref(query: { q: string; type: string; status: string; page?: number }) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.status !== "all") params.set("status", query.status);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const value = params.toString();
  return value ? `/fleet?${value}` : "/fleet";
}

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!canManageVehicles(user.role)) return <Forbidden />;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = params.type && uuidPattern.test(params.type) ? params.type : "";
  const status = vehicleDisplayStatuses.includes(params.status as VehicleDisplayStatus)
    ? (params.status as VehicleDisplayStatus)
    : "all";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [types, result, dispatchable] = await Promise.all([
    listVehicleTypes(user.id),
    searchVehicles(user.id, { q, typeId: type, status, page }),
    listDispatchableVehicles(user.id),
  ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Vehicles"
          description={`${dispatchable.length} active ${dispatchable.length === 1 ? "vehicle is" : "vehicles are"} eligible for dispatch. Retired and in-shop vehicles are excluded, as are vehicles already reserved or on a trip.`}
        />
        <Link href="/fleet/new" className={cn(buttonVariants(), "h-11")}>
          Add vehicle
        </Link>
      </div>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_12rem_10rem_auto]">
        <Input name="q" defaultValue={q} placeholder="Name, registration, or fleet number" aria-label="Search vehicles" className="h-11" />
        <Select name="type" defaultValue={type} aria-label="Vehicle type">
          <option value="">All types</option>
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.archived ? `${item.name} (archived)` : item.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status} aria-label="Vehicle status">
          <option value="all">All statuses</option>
          {vehicleDisplayStatuses.map((item) => (
            <option key={item} value={item}>
              {vehicleDisplayLabels[item]}
            </option>
          ))}
        </Select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Search
        </button>
      </form>
      {result.rows.length === 0 ? (
        <EmptyState title="No vehicles" description="Nothing matches this search." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registration</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dispatch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/fleet/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                    {row.registrationNumber}
                  </Link>
                  {row.fleetNumber ? <p className="text-xs text-muted-foreground">{row.fleetNumber}</p> : null}
                </TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.typeName}</TableCell>
                <TableCell>
                  <Badge tone={tones[row.displayStatus]}>{vehicleDisplayLabels[row.displayStatus]}</Badge>
                </TableCell>
                <TableCell>{row.dispatchEligible ? "Eligible" : "Not eligible"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(nextPage) => fleetHref({ q, type, status, page: nextPage })} />
    </div>
  );
}
