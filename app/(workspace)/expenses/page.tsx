import { Forbidden } from "@/components/forbidden";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { canManageExpenses } from "@/lib/registry-access";
import { listExpenseVehicles, listExpenses } from "@/lib/services/expenses";
import { requireUser } from "@/lib/session";
import { minorToMajor } from "@/lib/vehicle-rules";
import { cn } from "@/lib/utils";
import { EditExpenseForm, FuelForm, OtherExpenseForm } from "./expense-form";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const user = await requireUser();
  if (!canManageExpenses(user.role)) return <Forbidden />;
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const kind = params.kind ?? "all";
  const [vehicles, ledger] = await Promise.all([
    listExpenseVehicles(user.id),
    listExpenses(user.id, { kind, q }),
  ]);
  const choices = vehicles.map((item) => ({ id: item.id, label: `${item.registrationNumber} · ${item.name}` }));

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader
        title="Fuel and expenses"
        description="Fuel, tolls, miscellaneous costs, and maintenance completion all land in one ledger. The total below counts each expense once."
      />
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <Input name="q" defaultValue={q} placeholder="Description" aria-label="Search expenses" className="h-11" />
        <select name="kind" defaultValue={kind} aria-label="Expense kind" className="h-11 rounded-lg border border-input bg-transparent px-2 text-sm">
          <option value="all">All kinds</option>
          <option value="fuel">Fuel</option>
          <option value="toll">Toll</option>
          <option value="miscellaneous">Miscellaneous</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Filter</button>
      </form>
      <p className="text-sm">Ledger total INR {minorToMajor(ledger.totalMinor)}</p>
      <ul className="grid gap-4">
        {ledger.rows.map((row) => (
          <li key={row.id} className="grid gap-2 rounded-lg border border-border p-3 text-sm">
            <p>
              {row.kind} · INR {minorToMajor(row.amountMinor)} · {row.description}
              {row.litres ? ` · ${row.litres} L` : ""}
              {row.registrationNumber ? ` · ${row.registrationNumber}` : ""}
            </p>
            {row.kind === "maintenance" ? null : (
              <EditExpenseForm id={row.id} description={row.description} vendorName={row.vendorName ?? ""} />
            )}
          </li>
        ))}
      </ul>
      <div className="grid gap-8 lg:grid-cols-2">
        <FuelForm vehicles={choices} />
        <OtherExpenseForm vehicles={choices} />
      </div>
    </div>
  );
}
