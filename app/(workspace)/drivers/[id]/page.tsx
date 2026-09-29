import { DriverEditorPage } from "../driver-editor";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverEditorPage id={id} />;
}
