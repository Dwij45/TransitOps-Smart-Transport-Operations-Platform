import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  hasPermission,
  permissionLabels,
  permissionsForRole,
  type Permission,
  type UserRole,
} from "@/lib/authorization";
import { formatRole, roleLabels } from "@/lib/navigation";
import { getSettingsWorkspace, type LookupKind, type LookupRow } from "@/lib/services/operator-settings";
import { requireUser } from "@/lib/session";
import { LookupSection } from "./lookup-section";
import { SettingsForm } from "./settings-form";

const pageSize = 8;

const sections: {
  kind: LookupKind;
  title: string;
  detailLabel?: string;
  showDescription?: boolean;
  showPoints?: boolean;
}[] = [
  { kind: "vehicle_type", title: "Vehicle types", detailLabel: "Description", showDescription: true },
  { kind: "location_type", title: "Location types" },
  { kind: "maintenance_service_type", title: "Maintenance types", detailLabel: "Description", showDescription: true },
  { kind: "safety_event_type", title: "Safety event types", detailLabel: "Points", showPoints: true },
];

const permissions = Object.keys(permissionLabels) as Permission[];
const roles = Object.keys(roleLabels) as UserRole[];

function filterRows(rows: LookupRow[], status: string) {
  if (status === "archived") return rows.filter((row) => row.archivedAt);
  if (status === "all") return rows;
  return rows.filter((row) => !row.archivedAt);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!hasPermission(user.role, "user:manage")) {
    return <Forbidden />;
  }

  const params = await searchParams;
  const status = params.status === "archived" || params.status === "all" ? params.status : "active";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const data = await getSettingsWorkspace(user.id);

  const filtered = Object.fromEntries(
    sections.map((section) => [section.kind, filterRows(data.lookups[section.kind], status)]),
  ) as Record<LookupKind, LookupRow[]>;
  const longest = Math.max(...sections.map((section) => filtered[section.kind].length));
  const pageCount = Math.max(1, Math.ceil(longest / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;

  const hrefFor = (nextPage: number) => {
    const query = new URLSearchParams();
    if (status !== "active") query.set("status", status);
    if (nextPage > 1) query.set("page", String(nextPage));
    const value = query.toString();
    return value ? `/settings?${value}` : "/settings";
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-10">
      <PageHeader
        title="Settings"
        description="Operator details, classifications, and the fixed permissions for each role."
      />

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Operator</h2>
        <SettingsForm
          operatorName={data.operatorName}
          defaultDepotId={data.defaultDepotId}
          currency={data.currency}
          timezone={data.timezone}
          distanceUnit={data.distanceUnit}
          weightUnit={data.weightUnit}
          depots={data.depots.filter((depot) => !depot.archived || depot.id === data.defaultDepotId)}
        />
      </section>

      <section className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold">Classifications</h2>
          <form method="get" className="flex items-end gap-2" aria-label="Filter classifications">
            <div className="grid gap-2">
              <label htmlFor="status" className="text-sm font-medium">Show</label>
              <Select id="status" name="status" defaultValue={status} className="w-40">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </Select>
            </div>
            <button type="submit" className="inline-flex h-11 items-center rounded-lg border border-border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              Apply
            </button>
          </form>
        </div>
      {sections.map((section) => {
        const source = filtered[section.kind];
        const rows = source.slice(start, start + pageSize);
        return (
          <LookupSection
            key={section.kind}
            {...section}
            rows={rows}
            emptyLabel={source.length === 0 ? "No classifications in this filter." : "Nothing else on this page."}
          />
        );
      })}
      <Pagination page={currentPage} pageCount={pageCount} hrefFor={hrefFor} />
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Role permissions</h2>
        <p className="text-sm text-muted-foreground">This matrix is fixed. It cannot be edited.</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role}>{formatRole(role)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission}>
                <TableCell>{permissionLabels[permission]}</TableCell>
                {roles.map((role) => {
                  const allowed = permissionsForRole(role).includes(permission);
                  return (
                    <TableCell key={role}>
                      <Badge tone={allowed ? "success" : "neutral"}>{allowed ? "Yes" : "No"}</Badge>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
