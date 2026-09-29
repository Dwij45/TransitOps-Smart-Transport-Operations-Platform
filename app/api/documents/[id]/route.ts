import { DomainError } from "@/lib/domain-error";
import { readStaffDocument } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;

  try {
    const file = await readStaffDocument(user.id, id);
    const filename = file.filename.replace(/["\r\n]/g, "");
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.body.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "forbidden") {
      return new Response("Forbidden", { status: 403 });
    }
    if (error instanceof DomainError && error.code === "not_found") {
      return new Response("Not found", { status: 404 });
    }
    if (error instanceof DomainError && error.code === "invalid_state") {
      return new Response("Object storage is not configured.", { status: 503 });
    }
    console.error("[documents] download failed", error);
    return new Response("The document could not be downloaded.", { status: 500 });
  }
}
