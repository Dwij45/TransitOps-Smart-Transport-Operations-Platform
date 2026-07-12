import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  account,
  session,
  user,
  userRoleValues,
  verification,
} from "@/db/schema/auth";
import { auditEvent } from "@/db/schema/platform";
import { hasPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-error";
import { auditMetadata } from "@/lib/audit";

type UserRole = (typeof userRoleValues)[number];

export interface InviteStaffUserInput {
  actorUserId: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AcceptStaffInvitationInput {
  token: string;
  password: string;
}

const invitationLifetimeMs = 24 * 60 * 60 * 1000;

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function assertUserManager(actorUserId: string): Promise<void> {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);

  if (!actor || !hasPermission(actor.role, "user:manage")) {
    throw new DomainError(
      "forbidden",
      "The acting user cannot manage staff users",
    );
  }
}

export async function inviteStaffUser(input: InviteStaffUserInput) {
  await assertUserManager(input.actorUserId);

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) {
    throw new DomainError("validation_failed", "Staff name is required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError("validation_failed", "A valid email is required");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = new Date(Date.now() + invitationLifetimeMs);

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

    await tx.insert(verification).values({
      id: randomUUID(),
      identifier: `staff-invitation:${userId}`,
      value: tokenHash,
      expiresAt,
    });

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId: input.actorUserId,
      action: "user.invited",
      entityType: "user",
      entityId: userId,
      after: {
        email: created.email,
        role: created.role,
        invitationExpiresAt: expiresAt.toISOString(),
      },
    });

    const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    return {
      user: created,
      invitationUrl: `${baseUrl}/accept-invitation?token=${encodeURIComponent(rawToken)}`,
      expiresAt,
    };
  });
}

export async function acceptStaffInvitation(
  input: AcceptStaffInvitationInput,
) {
  if (input.password.length < 8 || input.password.length > 128) {
    throw new DomainError(
      "validation_failed",
      "Password must contain between 8 and 128 characters",
    );
  }

  const tokenHash = hashInvitationToken(input.token);
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(verification)
      .where(
        and(
          eq(verification.value, tokenHash),
          gt(verification.expiresAt, new Date()),
          sql`${verification.identifier} like 'staff-invitation:%'`,
        ),
      )
      .for("update")
      .limit(1);

    if (!invitation) {
      throw new DomainError(
        "validation_failed",
        "Invitation is invalid or expired",
      );
    }

    const userId = invitation.identifier.slice("staff-invitation:".length);
    const [invitedUser] = await tx
      .select({ id: user.id, email: user.email, role: user.role })
      .from(user)
      .where(eq(user.id, userId))
      .for("update")
      .limit(1);

    if (!invitedUser) {
      throw new DomainError("not_found", "Invited staff user no longer exists");
    }

    const [existingCredential] = await tx
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      )
      .limit(1);

    if (existingCredential) {
      throw new DomainError("conflict", "Invitation has already been accepted");
    }

    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });

    const [activated] = await tx
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      });

    await tx.delete(verification).where(eq(verification.id, invitation.id));

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId: userId,
      action: "user.invitation_accepted",
      entityType: "user",
      entityId: userId,
      after: { emailVerified: true, role: activated.role },
    });

    return activated;
  });
}

export async function unlockStaffUser(
  actorUserId: string,
  targetUserId: string,
) {
  await assertUserManager(actorUserId);

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
      ...auditMetadata(),
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

// ─── Change Role ──────────────────────────────────────────────────────────────

export interface ChangeStaffRoleInput {
  actorUserId: string;
  targetUserId: string;
  newRole: UserRole;
}

export async function changeStaffRole(input: ChangeStaffRoleInput) {
  await assertUserManager(input.actorUserId);

  // Edge case: admin cannot change their own role to prevent self-lockout
  if (input.actorUserId === input.targetUserId) {
    throw new DomainError("forbidden", "You cannot change your own role");
  }

  // Edge case: validate the new role is one of the allowed values
  if (!userRoleValues.includes(input.newRole)) {
    throw new DomainError("validation_failed", "Invalid role specified");
  }

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, role: user.role, email: user.email })
      .from(user)
      .where(eq(user.id, input.targetUserId))
      .for("update")
      .limit(1);

    if (!target) {
      throw new DomainError("not_found", "Staff user not found");
    }

    // Edge case: no-op if role is already the same
    if (target.role === input.newRole) {
      return { id: target.id, role: target.role, changed: false };
    }

    const [updated] = await tx
      .update(user)
      .set({ role: input.newRole })
      .where(eq(user.id, input.targetUserId))
      .returning({ id: user.id, role: user.role });

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId: input.actorUserId,
      action: "user.role_changed",
      entityType: "user",
      entityId: input.targetUserId,
      before: { role: target.role },
      after: { role: input.newRole },
    });

    return { id: updated.id, role: updated.role, changed: true };
  });
}

// ─── Revoke Sessions ─────────────────────────────────────────────────────────

export interface RevokeStaffSessionsInput {
  actorUserId: string;
  targetUserId: string;
}

export async function revokeStaffSessions(input: RevokeStaffSessionsInput) {
  await assertUserManager(input.actorUserId);

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, input.targetUserId))
      .limit(1);

    if (!target) {
      throw new DomainError("not_found", "Staff user not found");
    }

    // Count sessions before deletion for audit record
    const existingSessions = await tx
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, input.targetUserId));

    // Delete all active sessions for the target user
    await tx.delete(session).where(eq(session.userId, input.targetUserId));

    await tx.insert(auditEvent).values({
      ...auditMetadata(),
      actorUserId: input.actorUserId,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: input.targetUserId,
      before: { sessionCount: existingSessions.length },
      after: { sessionCount: 0 },
    });

    return { userId: input.targetUserId, revokedCount: existingSessions.length };
  });
}
