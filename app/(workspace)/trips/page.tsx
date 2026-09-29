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
import { canPlanTrips } from "@/lib/registry-access";
import { searchTrips } from "@/lib/services/trip-planning";
import { requireUser } from "@/lib/session";
import { tripStatuses, tripStatusLabels, type TripStatus } from "@/lib/trip-rules";
import { cn } from "@/lib/utils";

const statusTone = {
  draft: "neutral",
  dispatched: "warning",
  in_progress: "success",
  completed: "success",
  cancelled: "danger",
} as const;

function tripHref(query: { q: string; status: string; page?: number }) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "all") params.set("status", query.status);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const value = params.toString();
  return value ? `/trips?${value}` : "/trips";
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!canPlanTrips(user.role)) return <Forbidden />;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = tripStatuses.includes(params.status as TripStatus) ? (params.status as TripStatus) : "all";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = await searchTrips(user.id, { q, status, page });

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Trips"
          description="Create a draft, assign an eligible vehicle and driver, then dispatch. A live assignment cannot be given to a second trip."
        />
        <Link href="/trips/new" className={cn(buttonVariants(), "h-11")}>
          Add trip
        </Link>
      </div>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <Input name="q" defaultValue={q} placeholder="Trip code or customer" aria-label="Search trips" className="h-11" />
        <Select name="status" defaultValue={status} aria-label="Trip status">
          <option value="all">All statuses</option>
          {tripStatuses.map((item) => (
            <option key={item} value={item}>
              {tripStatusLabels[item]}
            </option>
          ))}
        </Select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Search
        </button>
      </form>
      {result.rows.length === 0 ? (
        <EmptyState title="No trips" description="Nothing matches this search. Drafts stay editable until they are dispatched." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/trips/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                    {row.code}
                  </Link>
                </TableCell>
                <TableCell>
                  {row.originName} to {row.destinationName}
                </TableCell>
                <TableCell>{row.customerName ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={statusTone[row.status]}>{row.statusLabel}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(nextPage) => tripHref({ q, status, page: nextPage })} />
    </div>
  );
}
