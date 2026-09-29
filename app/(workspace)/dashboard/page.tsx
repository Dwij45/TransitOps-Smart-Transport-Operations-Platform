import Link from "next/link";

import { areasForRole, formatRole } from "@/lib/navigation";
import { loadDashboard } from "@/lib/services/dashboard";
import { requireUser } from "@/lib/session";
import { minorToMajor } from "@/lib/vehicle-rules";

export default async function DashboardPage() {
  const user = await requireUser();
  const areas = areasForRole(user.role).filter((area) => area.href !== "/dashboard");
  const board = await loadDashboard(user.role);

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <div>
        <p className="text-sm text-muted-foreground">{formatRole(user.role)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Signed in as {user.name}. Figures below come from the same records as the working pages, and only for areas this role can use.
        </p>
      </div>
      {board.sections.fleet ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Active" value={String(board.fleet.active)} />
          <Metric label="Available" value={String(board.fleet.available)} />
          <Metric label="In shop" value={String(board.fleet.inShop)} />
          <Metric label="Retired" value={String(board.fleet.retired)} />
          <Metric label="Utilization" value={board.utilization === null ? "No operable vehicles" : `${Math.round(board.utilization * 100)}%`} />
        </section>
      ) : null}
      {board.sections.trips ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-medium">Trips</h2>
          <p className="text-sm text-muted-foreground">
            {board.activeTrips} in progress, {board.pendingTrips} pending.
          </p>
          <ul className="grid gap-2 text-sm">
            {board.trips.map((item) => (
              <li key={item.id}>
                <Link href={`/trips/${item.id}`} className="underline-offset-4 hover:underline">
                  {item.code}
                </Link>{" "}
                · {item.status}
                {item.customerName ? ` · ${item.customerName}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {board.sections.drivers ? (
        <section className="grid gap-2 text-sm">
          <h2 className="font-medium">Drivers</h2>
          <p>{board.onDutyDrivers} on duty.</p>
          {board.expiring.length === 0 ? (
            <p className="text-muted-foreground">No primary licences expire in the next 30 days.</p>
          ) : (
            <ul>
              {board.expiring.map((item) => (
                <li key={`${item.name}-${String(item.expiresOn)}`}>
                  {item.name} licence expires {String(item.expiresOn)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {board.sections.maintenance ? (
        <section className="grid gap-2 text-sm">
          <h2 className="font-medium">Maintenance</h2>
          {board.shop.length === 0 ? <p className="text-muted-foreground">No open service orders.</p> : null}
          <ul>
            {board.shop.map((item) => (
              <li key={item.code}>
                {item.code} · {item.status.replace("_", " ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {board.sections.money ? <Metric label="Expense ledger" value={`INR ${minorToMajor(board.expenseMinor)}`} /> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {areas.map((area) => (
          <li key={area.href}>
            <Link href={area.href} className="flex min-h-24 flex-col justify-center rounded-lg border border-border px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="font-medium">{area.label}</span>
              <span className="mt-1 text-sm text-muted-foreground">{area.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
