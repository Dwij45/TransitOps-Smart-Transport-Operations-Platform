import { WorkspaceFrame } from "@/components/workspace-frame";
import { requireUser } from "@/lib/session";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <WorkspaceFrame user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </WorkspaceFrame>
  );
}
