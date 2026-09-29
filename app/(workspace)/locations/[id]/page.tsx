import { LocationEditorPage } from "../location-editor";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LocationEditorPage id={id} />;
}
