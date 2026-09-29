import { notFound } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { areaByHref } from "@/lib/navigation";
import { requireUser } from "@/lib/session";

export default async function AreaPage({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area } = await params;
  const spec = areaByHref(`/${area}`);

  if (!spec || spec.href === "/dashboard") {
    notFound();
  }

  const user = await requireUser();

  if (!spec.roles.includes(user.role)) {
    return <Forbidden />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{spec.label}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {spec.summary} This workspace is open for your role. The records for it are not on screen yet.
      </p>
    </div>
  );
}
