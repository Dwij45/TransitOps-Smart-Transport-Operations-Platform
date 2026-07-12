import "server-only";

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";

import { db, schema } from "@/db";

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
  },
  user: {
    additionalFields: {
      role: {
        type: [
          "admin",
          "fleet_manager",
          "dispatcher",
          "safety_officer",
          "financial_analyst",
        ],
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
});
