import Link from "next/link";

import { Forbidden } from "@/components/forbidden";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/authorization";
import { searchAudit } from "@/lib/services/audit-history";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; entity?: string; action?: string; from?: string; to?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!hasPermission(user.role, "user:manage")) return <Forbidden />;
  const params = await searchParams;
  const actor = params.actor?.trim() ?? "";
  const entity = params.entity?.trim() ?? "";
  const action = params.action?.trim() ?? "";
  const from = params.from ? new Date(params.from) : null;
  const to = params.to ? new Date(params.to) : null;
  const requested = Number(params.page ?? "1");
  const result = await searchAudit(user.id, {
    actor,
    entity,
    action,
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
    page: Number.isInteger(requested) && requested > 0 ? requested : 1,
  });

  function hrefFor(page: number) {
    const search = new URLSearchParams();
    if (actor) search.set("actor", actor);
    if (entity) search.set("entity", entity);
    if (action) search.set("action", action);
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    if (page > 1) search.set("page", String(page));
    const value = search.toString();
    return value ? `/audit?${value}` : "/audit";
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader
        title="Audit"
        description="Security, trip, assignment, maintenance, and financial changes are append-only. Snapshots hide passwords, tokens, and similar secrets."
      />
      <form method="get" className="grid gap-3 sm:grid-cols-3">
        <Input name="actor" defaultValue={actor} placeholder="Actor user id" aria-label="Actor" className="h-11" />
        <Input name="entity" defaultValue={entity} placeholder="Entity type" aria-label="Entity" className="h-11" />
        <Input name="action" defaultValue={action} placeholder="Action" aria-label="Action" className="h-11" />
        <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="From" className="h-11" />
        <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="To" className="h-11" />
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Search</button>
      </form>
      <ul className="grid gap-3">
        {result.rows.length === 0 ? <li className="text-sm text-muted-foreground">No matching events.</li> : null}
        {result.rows.map((row) => (
          <li key={row.id} className="grid gap-1 rounded-lg border border-border p-3 text-sm">
            <p>
              {row.occurredAt.toLocaleString()} · {row.action} · {row.entityType}
            </p>
            <p className="text-muted-foreground">{row.actorName ?? "Unknown actor"}</p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
      <Link href="/dashboard" className="text-sm underline-offset-4 hover:underline">Back to dashboard</Link>
    </div>
  );
}
