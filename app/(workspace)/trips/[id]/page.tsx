import { TripEditorPage } from "../trip-editor";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TripEditorPage id={id} />;
}
