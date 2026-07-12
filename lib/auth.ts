import "server-only";

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { and, eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { user, userRoleValues } from "@/db/schema/auth";
import { auditEvent } from "@/db/schema/platform";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user: resetUser }) => {
      await db
        .update(user)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(user.id, resetUser.id));
    },
  },
  user: {
    additionalFields: {
      role: {
        type: [...userRoleValues],
        required: true,
        defaultValue: "dispatcher",
        input: false,
      },
      failedLoginAttempts: {
        type: "number",
        required: true,
        defaultValue: 0,
        input: false,
      },
      lockedUntil: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      const email =
        typeof ctx.body?.email === "string"
          ? ctx.body.email.trim().toLowerCase()
          : null;

      if (!email) return;

      const [loginUser] = await db
        .select({
          id: user.id,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil,
        })
        .from(user)
        .where(sql`lower(${user.email}) = ${email}`)
        .limit(1);

      if (!loginUser?.lockedUntil) return;

      if (loginUser.lockedUntil > new Date()) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Account is temporarily locked. Try again later.",
        });
      }

      await db
        .update(user)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(user.id, loginUser.id));
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      const email =
        typeof ctx.body?.email === "string"
          ? ctx.body.email.trim().toLowerCase()
          : null;

      if (!email) return;

      const signedInUser = ctx.context.newSession?.user;

      if (signedInUser) {
        await db
          .update(user)
          .set({ failedLoginAttempts: 0, lockedUntil: null })
          .where(eq(user.id, signedInUser.id));
        return;
      }

      const [failedUser] = await db
        .update(user)
        .set({
          failedLoginAttempts: sql`${user.failedLoginAttempts} + 1`,
          lockedUntil: sql`case
            when ${user.failedLoginAttempts} + 1 >= 5
            then now() + interval '15 minutes'
            else ${user.lockedUntil}
          end`,
        })
        .where(
          and(
            sql`lower(${user.email}) = ${email}`,
            sql`(${user.lockedUntil} is null or ${user.lockedUntil} <= now())`,
          ),
        )
        .returning({
          id: user.id,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil,
        });

      if (failedUser) {
        await db.insert(auditEvent).values({
          action: "auth.login_failed",
          entityType: "user",
          entityId: failedUser.id,
          after: {
            failedLoginAttempts: failedUser.failedLoginAttempts,
            lockedUntil: failedUser.lockedUntil?.toISOString() ?? null,
          },
        });
      }
    }),
  },
});
