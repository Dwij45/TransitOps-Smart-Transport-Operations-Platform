import { VehicleEditorPage } from "../vehicle-editor";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VehicleEditorPage id={id} />;
}
