import "server-only";

import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  account,
  user,
  userRoleValues,
} from "@/db/schema/auth";
import { auditEvent } from "@/db/schema/platform";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";

type UserRole = (typeof userRoleValues)[number];

export interface CreateStaffUserInput {
  actorUserId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export async function createStaffUser(input: CreateStaffUserInput) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, input.actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "user:manage")) {
    throw new DomainError(
      "forbidden",
      "The acting user cannot create staff users",
    );
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) {
    throw new DomainError("validation_failed", "Staff name is required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError("validation_failed", "A valid email is required");
  }

  if (input.password.length < 8 || input.password.length > 128) {
    throw new DomainError(
      "validation_failed",
      "Password must contain between 8 and 128 characters",
    );
  }

  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`)
      .limit(1);

    if (existing) {
      throw new DomainError("conflict", "A user with this email already exists");
    }

    const userId = randomUUID();
    const [created] = await tx
      .insert(user)
      .values({
        id: userId,
        name,
        email,
        role: input.role,
        emailVerified: false,
      })
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      });

    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });

    await tx.insert(auditEvent).values({
      actorUserId: input.actorUserId,
      action: "user.created",
      entityType: "user",
      entityId: userId,
      after: {
        email: created.email,
        role: created.role,
        emailVerified: created.emailVerified,
      },
    });

    return created;
  });
}

export async function unlockStaffUser(
  actorUserId: string,
  targetUserId: string,
) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "user:manage")) {
    throw new DomainError(
      "forbidden",
      "The acting user cannot unlock staff users",
    );
  }

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: user.id,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
      })
      .from(user)
      .where(eq(user.id, targetUserId))
      .for("update")
      .limit(1);

    if (!target) {
      throw new DomainError("not_found", "Staff user not found");
    }

    const [updated] = await tx
      .update(user)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(user.id, targetUserId))
      .returning({
        id: user.id,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
      });

    await tx.insert(auditEvent).values({
      actorUserId,
      action: "user.unlocked",
      entityType: "user",
      entityId: targetUserId,
      before: {
        failedLoginAttempts: target.failedLoginAttempts,
        lockedUntil: target.lockedUntil?.toISOString() ?? null,
      },
      after: { failedLoginAttempts: 0, lockedUntil: null },
    });

    return updated;
  });
}
