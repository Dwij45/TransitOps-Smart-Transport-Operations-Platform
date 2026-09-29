import Link from "next/link";

import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { canPlanTrips } from "@/lib/registry-access";
import { listTripBoard } from "@/lib/services/trip-planning";
import { requireUser } from "@/lib/session";
import { tripStatuses, tripStatusLabels } from "@/lib/trip-rules";
import { cn } from "@/lib/utils";

const statusTone = {
  draft: "neutral",
  dispatched: "warning",
  in_progress: "success",
  completed: "success",
  cancelled: "danger",
} as const;

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  if (!canPlanTrips(user.role)) return <Forbidden />;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const board = await listTripBoard(user.id, q);

  return (
    <div className="mx-auto grid max-w-7xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Trips"
          description="The board groups every trip by status. Open a card to start, complete, or cancel when that transition is valid."
        />
        <Link href="/trips/new" className={cn(buttonVariants(), "h-11")}>
          Add trip
        </Link>
      </div>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input name="q" defaultValue={q} placeholder="Trip code or customer" aria-label="Search trips" className="h-11" />
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Search
        </button>
      </form>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {tripStatuses.map((status) => (
          <section key={status} className="grid content-start gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{tripStatusLabels[status]}</h2>
              <Badge tone={statusTone[status]}>{board[status].length}</Badge>
            </div>
            {board[status].length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              board[status].map((row) => (
                <Link
                  key={row.id}
                  href={`/trips/${row.id}`}
                  className="grid gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{row.code}</span>
                  <span>
                    {row.originName} to {row.destinationName}
                  </span>
                  <span className="text-muted-foreground">{row.customerName ?? "No customer"}</span>
                </Link>
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
