import "server-only";

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins";
import { and, eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { user, userRoleValues } from "@/db/schema/auth";
import { auditEvent } from "@/db/schema/platform";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async (data) => {
      // Build the URL pointing to our /reset-password page with the token
      const resetUrl = new URL("/reset-password", process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
      resetUrl.searchParams.set("token", new URL(data.url).searchParams.get("token") ?? "");

      console.log(`[AUTH] Sending password reset email to: ${data.user.email}`);
      await sendEmail({
        to: data.user.email,
        subject: "Reset your TransitOps password",
        html: `<p>Hi ${data.user.name},</p>
<p>Click the link below to reset your password. This link is <strong>single-use</strong> and will expire shortly.</p>
<p><a href="${resetUrl.toString()}" style="background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500;">Reset Password</a></p>
<p style="color:#999;font-size:12px;">If you did not request a password reset, you can safely ignore this email.</p>`,
      });
    },
    onPasswordReset: async ({ user: resetUser }) => {
      await db.transaction(async (tx) => {
        const [before] = await tx
          .select({
            failedLoginAttempts: user.failedLoginAttempts,
            lockedUntil: user.lockedUntil,
          })
          .from(user)
          .where(eq(user.id, resetUser.id))
          .for("update")
          .limit(1);

        await tx
          .update(user)
          .set({ failedLoginAttempts: 0, lockedUntil: null })
          .where(eq(user.id, resetUser.id));

        if (before && (before.failedLoginAttempts > 0 || before.lockedUntil)) {
          await tx.insert(auditEvent).values({
            actorUserId: resetUser.id,
            action: "auth.lockout_cleared_by_password_reset",
            entityType: "user",
            entityId: resetUser.id,
            before: {
              failedLoginAttempts: before.failedLoginAttempts,
              lockedUntil: before.lockedUntil?.toISOString() ?? null,
            },
            after: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }
      });
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
        await db.transaction(async (tx) => {
          const [before] = await tx
            .select({
              failedLoginAttempts: user.failedLoginAttempts,
              lockedUntil: user.lockedUntil,
            })
            .from(user)
            .where(eq(user.id, signedInUser.id))
            .for("update")
            .limit(1);

          await tx
            .update(user)
            .set({ failedLoginAttempts: 0, lockedUntil: null })
            .where(eq(user.id, signedInUser.id));

          if (before && (before.failedLoginAttempts > 0 || before.lockedUntil)) {
            await tx.insert(auditEvent).values({
              actorUserId: signedInUser.id,
              action: "auth.lockout_cleared_by_login",
              entityType: "user",
              entityId: signedInUser.id,
              before: {
                failedLoginAttempts: before.failedLoginAttempts,
                lockedUntil: before.lockedUntil?.toISOString() ?? null,
              },
              after: { failedLoginAttempts: 0, lockedUntil: null },
            });
          }
        });
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
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token }) => {
        // Build the URL pointing to our /accept-invite page with the token
        const inviteUrl = new URL("/accept-invite", process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
        inviteUrl.searchParams.set("token", token);

        console.log(`[AUTH] Sending invitation email to: ${email}`);
        await sendEmail({
          to: email,
          subject: "You've been invited to TransitOps",
          html: `<p>You have been invited to join <strong>TransitOps</strong>.</p>
<p>Click the link below to securely accept your invitation. This link is <strong>single-use</strong> and will expire shortly.</p>
<p><a href="${inviteUrl.toString()}" style="background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500;">Accept Invitation</a></p>
<p style="color:#999;font-size:12px;">If you were not expecting this invitation, you can safely ignore this email.</p>`,
        });
      },
    }),
  ],
});
