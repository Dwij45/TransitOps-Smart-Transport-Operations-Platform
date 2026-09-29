import Link from "next/link";
import { notFound } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { canManageLocations, canViewLocations } from "@/lib/registry-access";
import { getLocation, listLocationTypes } from "@/lib/services/locations";
import { requireUser } from "@/lib/session";
import { LocationForm } from "./location-form";

export async function LocationEditorPage({ id }: { id?: string }) {
  const user = await requireUser();
  if (!canViewLocations(user.role)) return <Forbidden />;

  const canManage = canManageLocations(user.role);
  if (!id && !canManage) return <Forbidden />;
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const current = id ? await getLocation(user.id, id) : null;
  if (id && !current) notFound();

  const types = await listLocationTypes(user.id);
  const choices = types.filter((type) => !type.archived || type.id === current?.typeId);
  const address = current
    ? [current.addressLine1, current.addressLine2, `${current.city}, ${current.state}`, current.postalCode]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title={current ? current.name : "New location"}
        description={
          current?.archived
            ? "This location is archived. It remains visible here and on past trips."
            : "Address and country are required. Latitude and longitude are optional, and must be entered together."
        }
      />
      <Link href="/locations" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to locations
      </Link>
      {current && !canManage ? (
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{current.typeName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{address}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Country</dt>
            <dd>{current.countryCode}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Coordinates</dt>
            <dd>
              {current.latitude && current.longitude
                ? `${current.latitude}, ${current.longitude}`
                : "Not set"}
            </dd>
          </div>
        </dl>
      ) : null}
      {canManage && choices.length === 0 ? (
        <EmptyState title="No location types" description="Add a location type in Settings before creating a location." />
      ) : null}
      {canManage && choices.length > 0 ? (
        <LocationForm
          types={choices}
          values={
            current
              ? {
                  id: current.id,
                  name: current.name,
                  typeId: current.typeId,
                  addressLine1: current.addressLine1,
                  addressLine2: current.addressLine2 ?? "",
                  city: current.city,
                  state: current.state,
                  postalCode: current.postalCode ?? "",
                  countryCode: current.countryCode,
                  latitude: current.latitude ?? "",
                  longitude: current.longitude ?? "",
                  archived: current.archived,
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
