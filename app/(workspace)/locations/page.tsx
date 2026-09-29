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
import { canManageLocations, canViewLocations } from "@/lib/registry-access";
import { listLocationTypes, searchLocations } from "@/lib/services/locations";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function locationHref(query: { q: string; type: string; status: string; page?: number }) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.status !== "active") params.set("status", query.status);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const value = params.toString();
  return value ? `/locations?${value}` : "/locations";
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!canViewLocations(user.role)) return <Forbidden />;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = params.type && uuidPattern.test(params.type) ? params.type : "";
  const status = params.status === "archived" || params.status === "all" ? params.status : "active";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [types, result] = await Promise.all([
    listLocationTypes(user.id),
    searchLocations(user.id, { q, typeId: type, status, page }),
  ]);
  const canManage = canManageLocations(user.role);

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Locations"
          description="Depots, hubs, warehouses, customer sites, and any other type from Settings. Archived locations stay on record, but new trips cannot use them."
        />
        {canManage ? (
          <Link href="/locations/new" className={cn(buttonVariants(), "h-11")}>
            Add location
          </Link>
        ) : null}
      </div>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_12rem_10rem_auto]">
        <Input name="q" defaultValue={q} placeholder="Name, city, or address" aria-label="Search locations" className="h-11" />
        <Select name="type" defaultValue={type} aria-label="Location type">
          <option value="">All types</option>
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.archived ? `${item.name} (archived)` : item.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status} aria-label="Location status">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Search
        </button>
      </form>
      {result.rows.length === 0 ? (
        <EmptyState title="No locations" description="Nothing matches this search. Active locations are offered to trip planning and Settings." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/locations/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.typeName}</TableCell>
                <TableCell>
                  {row.city}, {row.state}
                </TableCell>
                <TableCell>
                  <Badge tone={row.archived ? "danger" : "success"}>{row.archived ? "Archived" : "Active"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(nextPage) => locationHref({ q, type, status, page: nextPage })} />
    </div>
  );
}
