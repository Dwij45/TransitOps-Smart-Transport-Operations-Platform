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
import { driverDutyStates, type DriverDutyState } from "@/lib/driver-rules";
import { canManageDrivers } from "@/lib/registry-access";
import { searchDrivers } from "@/lib/services/drivers";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const dutyLabels: Record<DriverDutyState, string> = {
  on_duty: "On duty",
  off_duty: "Off duty",
  suspended: "Suspended",
};

function driversHref(query: { q: string; duty: string; status: string; page?: number }) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.duty !== "all") params.set("duty", query.duty);
  if (query.status !== "active") params.set("status", query.status);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const value = params.toString();
  return value ? `/drivers?${value}` : "/drivers";
}

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; duty?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!canManageDrivers(user.role)) return <Forbidden />;
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const duty = driverDutyStates.includes(params.duty as DriverDutyState) ? (params.duty as DriverDutyState) : "all";
  const status = params.status === "archived" || params.status === "all" ? params.status : "active";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = await searchDrivers(user.id, { q, duty, status, page });

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Drivers"
          description="Profiles, duty, and licences. An expired or unverified primary licence blocks dispatch."
        />
        <Link href="/drivers/new" className={cn(buttonVariants(), "h-11")}>
          Add driver
        </Link>
      </div>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto]">
        <Input name="q" defaultValue={q} placeholder="Name, code, or phone" aria-label="Search drivers" className="h-11" />
        <Select name="duty" defaultValue={duty} aria-label="Duty">
          <option value="all">All duties</option>
          {driverDutyStates.map((item) => (
            <option key={item} value={item}>
              {dutyLabels[item]}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status} aria-label="Driver status">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Search
        </button>
      </form>
      {result.rows.length === 0 ? (
        <EmptyState title="No drivers" description="Nothing matches this search." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Duty</TableHead>
              <TableHead>Dispatch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/drivers/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.employeeCode}</TableCell>
                <TableCell>{dutyLabels[row.dutyState]}</TableCell>
                <TableCell>
                  <Badge tone={row.dispatchBlock ? "danger" : "success"}>
                    {row.dispatchBlock ?? "Eligible"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(nextPage) => driversHref({ q, duty, status, page: nextPage })} />
    </div>
  );
}
