import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { eq } from "drizzle-orm";
import { changeStaffRole, revokeStaffSessions, unlockStaffUser } from "@/lib/services/staff-management";
import { userRoleValues } from "@/db/schema/auth";

/** Helper: get the authenticated admin actor from the request */
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

// ─── GET /api/admin/staff ─── List all staff + their lock status ─────────────
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (actor.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const staff = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(user.createdAt);

  return NextResponse.json({ staff });
}

// ─── POST /api/admin/staff ─── Dispatch admin actions ────────────────────────
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (actor.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const schema = z.object({
    action: z.enum(["change_role", "unlock", "revoke_sessions"]),
    targetUserId: z.string().min(1),
    newRole: z.enum(userRoleValues).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }

  const { action, targetUserId, newRole } = parsed.data;

  try {
    if (action === "change_role") {
      if (!newRole) {
        return NextResponse.json({ error: "newRole is required for change_role" }, { status: 422 });
      }
      const result = await changeStaffRole({ actorUserId: actor.id, targetUserId, newRole });
      return NextResponse.json({ ok: true, data: result });
    }

    if (action === "unlock") {
      const result = await unlockStaffUser(actor.id, targetUserId);
      return NextResponse.json({ ok: true, data: result });
    }

    if (action === "revoke_sessions") {
      const result = await revokeStaffSessions({ actorUserId: actor.id, targetUserId });
      return NextResponse.json({ ok: true, data: result });
    }
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    const code = errorObj?.code ?? "internal";
    const status = code === "not_found" ? 404 : code === "forbidden" ? 403 : code === "conflict" ? 409 : 500;
    return NextResponse.json({ error: errorObj?.message ?? "Internal error" }, { status });
  }
}
