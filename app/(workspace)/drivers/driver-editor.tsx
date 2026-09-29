import Link from "next/link";
import { notFound } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { primaryLicenceBlock } from "@/lib/driver-rules";
import { canManageDrivers } from "@/lib/registry-access";
import { listLicenceDocuments } from "@/lib/services/documents";
import { getDriver } from "@/lib/services/drivers";
import { requireUser } from "@/lib/session";
import { DriverForm } from "./driver-form";
import { DriverSafety } from "./driver-safety";
import { AddLicenceForm, LicenceActions, LicenceDocumentForm, RemoveLicenceDocumentButton } from "./licence-forms";

function calendarDate(value: Date | null) {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function DriverEditorPage({ id }: { id?: string }) {
  const user = await requireUser();
  if (!canManageDrivers(user.role)) return <Forbidden />;
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const current = id ? await getDriver(user.id, id) : null;
  if (id && !current) notFound();
  const documents = current
    ? await Promise.all(
        current.licences.map(async (licence) => ({
          licenceId: licence.id,
          files: await listLicenceDocuments(user.id, licence.id),
        })),
      )
    : [];

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title={current ? current.name : "New driver"}
        description="Duty changes are recorded. Dispatch needs one verified primary licence that has not expired."
      />
      <Link href="/drivers" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to drivers
      </Link>
      {current ? (
        <Badge tone={current.dispatchBlock ? "danger" : "success"}>{current.dispatchBlock ?? "Dispatch eligible"}</Badge>
      ) : null}
      <DriverForm
        values={
          current
            ? {
                id: current.id,
                employeeCode: current.employeeCode,
                name: current.name,
                phone: current.phone,
                email: current.email ?? "",
                dutyState: current.dutyState,
                hiredOn: calendarDate(current.hiredOn),
                archived: current.archived,
              }
            : undefined
        }
      />
      {current ? (
        <section className="grid gap-6">
          <h2 className="text-lg font-semibold">Licences</h2>
          {current.licences.map((licence) => {
            const files = documents.find((entry) => entry.licenceId === licence.id)?.files ?? [];
            const block = licence.isPrimary
              ? primaryLicenceBlock({ verifiedAt: licence.verifiedAt, expiresOn: licence.expiresOn }, new Date())
              : null;
            return (
              <article key={licence.id} className="grid gap-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{licence.licenseNumber}</p>
                  <Badge tone={licence.isPrimary ? "success" : "neutral"}>{licence.isPrimary ? "Primary" : "Additional"}</Badge>
                  {block ? <Badge tone="danger">{block}</Badge> : null}
                  {licence.verifiedAt ? <Badge tone="neutral">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {licence.category} · expires {calendarDate(licence.expiresOn)}
                </p>
                <LicenceActions
                  driverId={current.id}
                  licenceId={licence.id}
                  primary={licence.isPrimary}
                  verified={Boolean(licence.verifiedAt)}
                />
                <ul className="grid gap-2 text-sm">
                  {files.map((file) => (
                    <li key={file.id} className="flex flex-wrap items-center justify-between gap-2">
                      <a href={`/api/documents/${file.id}`} className="underline-offset-4 hover:underline">
                        {file.filename}
                      </a>
                      <RemoveLicenceDocumentButton driverId={current.id} licenceId={licence.id} documentId={file.id} />
                    </li>
                  ))}
                </ul>
                <LicenceDocumentForm driverId={current.id} licenceId={licence.id} />
              </article>
            );
          })}
          <AddLicenceForm driverId={current.id} />
        </section>
      ) : null}
      {current ? <DriverSafety driverId={current.id} /> : null}
    </div>
  );
}
