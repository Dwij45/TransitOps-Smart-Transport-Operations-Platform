import "server-only";

import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { auditEvent } from "@/db/schema/platform";
import { auditPageSize, redactSnapshot } from "@/lib/audit-redaction";
import { DomainError } from "@/lib/domain-error";
import { hasPermission } from "@/lib/authorization";

export async function searchAudit(
  actorUserId: string,
  query: { actor: string; entity: string; action: string; from: Date | null; to: Date | null; page: number },
) {
  const [actor] = await db.select({ role: user.role }).from(user).where(eq(user.id, actorUserId)).limit(1);
  if (!actor || !hasPermission(actor.role, "user:manage")) {
    throw new DomainError("forbidden", "The acting user cannot read the audit log");
  }
  const conditions = [];
  if (query.actor.trim()) conditions.push(eq(auditEvent.actorUserId, query.actor.trim()));
  if (query.entity.trim()) conditions.push(ilike(auditEvent.entityType, `%${query.entity.trim().replace(/[%_\\]/g, "")}%`));
  if (query.action.trim()) conditions.push(ilike(auditEvent.action, `%${query.action.trim().replace(/[%_\\]/g, "")}%`));
  if (query.from) conditions.push(gte(auditEvent.occurredAt, query.from));
  if (query.to) conditions.push(lte(auditEvent.occurredAt, query.to));
  const where = conditions.length ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(auditEvent).where(where);
  const pageCount = Math.max(1, Math.ceil(Number(total) / auditPageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const rows = await db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      entityId: auditEvent.entityId,
      before: auditEvent.before,
      after: auditEvent.after,
      occurredAt: auditEvent.occurredAt,
      actorName: user.name,
    })
    .from(auditEvent)
    .leftJoin(user, eq(auditEvent.actorUserId, user.id))
    .where(where)
    .orderBy(desc(auditEvent.occurredAt))
    .limit(auditPageSize)
    .offset((page - 1) * auditPageSize);
  return {
    page,
    pageCount,
    rows: rows.map((row) => ({
      ...row,
      before: redactSnapshot(row.before),
      after: redactSnapshot(row.after),
    })),
  };
}
