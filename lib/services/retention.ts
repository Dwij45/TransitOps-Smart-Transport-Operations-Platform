import "server-only";

import { lt } from "drizzle-orm";

import { db } from "@/db";
import { verification } from "@/db/schema/auth";

export async function deleteExpiredVerifications(now = new Date()): Promise<number> {
  const removed = await db.delete(verification).where(lt(verification.expiresAt, now)).returning({ id: verification.id });
  return removed.length;
}
