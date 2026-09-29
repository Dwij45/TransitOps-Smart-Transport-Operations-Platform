import { DomainError } from "@/lib/domain-error";
import { buildExport, isExportDataset } from "@/lib/services/exports";
import { requireUser } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ dataset: string }> }) {
  const user = await requireUser();
  const { dataset } = await context.params;
  if (!isExportDataset(dataset)) return new Response("Not found", { status: 404 });
  try {
    const csv = await buildExport(user.id, dataset);
    return new Response(csv.body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dataset}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "forbidden") return new Response("Forbidden", { status: 403 });
    console.error("[exports] failed", { dataset });
    return new Response("The export could not be created.", { status: 500 });
  }
}
