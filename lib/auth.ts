import "server-only";

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";

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
