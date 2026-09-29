import { Forbidden } from "@/components/forbidden";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { canManageExpenses } from "@/lib/registry-access";
import { loadReport } from "@/lib/services/reports";
import { requireUser } from "@/lib/session";
import { minorToMajor } from "@/lib/vehicle-rules";
import { cn } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; vehicle?: string }>;
}) {
  const user = await requireUser();
  if (!canManageExpenses(user.role)) return <Forbidden />;
  const params = await searchParams;
  const from = params.from ? new Date(params.from) : null;
  const to = params.to ? new Date(params.to) : null;
  const report = await loadReport(user.id, {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
    vehicleId: /^[0-9a-f-]{36}$/i.test(params.vehicle ?? "") ? params.vehicle ?? "" : "",
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader
        title="Reports"
        description="Efficiency, cost, revenue, and ROI are calculated from completed trips and the expense ledger. A blank figure means the source data is missing, not that the result is zero."
      />
      <form method="get" className="grid gap-3 sm:grid-cols-4">
        <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="From" className="h-11" />
        <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="To" className="h-11" />
        <Input name="vehicle" defaultValue={params.vehicle ?? ""} placeholder="Vehicle id" aria-label="Vehicle" className="h-11" />
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Apply</button>
      </form>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <p className="rounded-lg border border-border p-3 text-sm">Fuel efficiency {report.efficiency === null ? "not enough fuel data" : `${report.efficiency.toFixed(2)} km/L`}</p>
        <p className="rounded-lg border border-border p-3 text-sm">Cost INR {minorToMajor(report.costMinor)}</p>
        <p className="rounded-lg border border-border p-3 text-sm">Revenue INR {minorToMajor(report.revenueMinor)}</p>
        <p className="rounded-lg border border-border p-3 text-sm">ROI {report.roi === null ? "not enough cost data" : `${Math.round(report.roi * 100)}%`}</p>
        <p className="rounded-lg border border-border p-3 text-sm">Trip completion {report.completion === null ? "no finished trips" : `${Math.round(report.completion * 100)}%`}</p>
      </section>
      <section>
        <h2 className="text-sm font-medium">Highest-cost vehicles</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {report.costly.length === 0 ? <li>No vehicle expenses in this range.</li> : null}
          {report.costly.map((row) => (
            <li key={row.registrationNumber}>{row.registrationNumber} · INR {minorToMajor(row.amountMinor)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-medium">Monthly revenue</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {report.months.length === 0 ? <li>No completed-trip revenue in this range.</li> : null}
          {report.months.map((row) => (
            <li key={row.month}>{row.month} · INR {minorToMajor(row.amountMinor)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
