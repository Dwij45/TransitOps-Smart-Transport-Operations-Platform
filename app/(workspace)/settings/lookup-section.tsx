"use client";

import { useActionState } from "react";

import { archiveLookupAction, createLookupAction } from "@/app/(workspace)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionState } from "@/lib/action-state";
import type { LookupKind, LookupRow } from "@/lib/services/operator-settings";

function ArchiveButton({ kind, id }: { kind: LookupKind; id: string }) {
  const [state, action, pending] = useActionState(archiveLookupAction, null as ActionState);

  return (
    <ConfirmDialog
      title="Archive classification"
      description="Archived classifications stay on existing records and cannot be selected for new ones."
      trigger="Archive"
    >
      <form action={action}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Archiving..." : "Archive"}
        </Button>
        {state && !state.ok ? <Notice tone="error" title={state.message} /> : null}
      </form>
    </ConfirmDialog>
  );
}

export function LookupSection({
  kind,
  title,
  rows,
  detailLabel,
  showDescription,
  showPoints,
  emptyLabel = "No classifications in this filter.",
}: {
  kind: LookupKind;
  title: string;
  rows: LookupRow[];
  detailLabel?: string;
  showDescription?: boolean;
  showPoints?: boolean;
  emptyLabel?: string;
}) {
  const [state, action, pending] = useActionState(createLookupAction, null as ActionState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <form action={action} className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
        <input type="hidden" name="kind" value={kind} />
        {state ? <div className="sm:col-span-2"><Notice tone={state.ok ? "success" : "error"} title={state.message} /></div> : null}
        <Field label="Name" htmlFor={`${kind}-name`} error={errors?.name?.[0]}>
          <Input id={`${kind}-name`} name="name" required className="h-11" aria-invalid={Boolean(errors?.name)} />
        </Field>
        {showDescription ? (
          <Field label="Description" htmlFor={`${kind}-description`} error={errors?.description?.[0]}>
            <Input id={`${kind}-description`} name="description" className="h-11" />
          </Field>
        ) : null}
        {showPoints ? (
          <Field label="Default points" htmlFor={`${kind}-points`} error={errors?.defaultPoints?.[0]}>
            <Input id={`${kind}-points`} name="defaultPoints" required inputMode="decimal" className="h-11" aria-invalid={Boolean(errors?.defaultPoints)} />
          </Field>
        ) : null}
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="h-11">
            {pending ? "Adding..." : "Add classification"}
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No classifications" description={emptyLabel} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {detailLabel ? <TableHead>{detailLabel}</TableHead> : null}
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                {detailLabel ? <TableCell>{row.detail ?? "—"}</TableCell> : null}
                <TableCell>
                  <Badge tone={row.archivedAt ? "danger" : "neutral"}>
                    {row.archivedAt ? "Archived" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.archivedAt ? <span className="text-sm text-muted-foreground">Unavailable for new records</span> : <ArchiveButton kind={kind} id={row.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
