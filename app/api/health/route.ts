import { logEvent } from "@/lib/log";
import { deleteExpiredVerifications } from "@/lib/services/retention";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("x-cron-secret") === secret) {
    const removed = await deleteExpiredVerifications();
    logEvent("verification.cleanup", { removed });
  }
  return Response.json({ ok: true });
}
