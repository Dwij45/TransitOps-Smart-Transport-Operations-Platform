import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { auditEvent } from "@/db/schema/platform";
import { eq, desc } from "drizzle-orm";

async function getActor() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session?.user?.id) return null;

  const [dbUser] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  return dbUser ?? null;
}

// ─── GET /api/admin/audit ─── Return last 50 audit events ────────────────────
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (actor.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const events = await db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      entityId: auditEvent.entityId,
      actorUserId: auditEvent.actorUserId,
      before: auditEvent.before,
      after: auditEvent.after,
      ipAddress: auditEvent.ipAddress,
      occurredAt: auditEvent.occurredAt,
    })
    .from(auditEvent)
    .orderBy(desc(auditEvent.occurredAt))
    .limit(50);

  return NextResponse.json({ events });
}
