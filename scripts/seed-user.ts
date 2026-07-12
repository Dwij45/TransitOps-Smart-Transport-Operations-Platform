import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { user, account } from "../db/schema/auth";

const TEST_USER_ID = "test-user-1";
const TEST_EMAIL = "dwijgosai@gmail.com";
const TEST_PASSWORD = "Admin@1234";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function seedAdminUser() {
  console.log("Seeding admin user with a hashed password...");

  try {
    const passwordHash = await hashPassword(TEST_PASSWORD);

    // 1. Insert (or skip) the user row
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Admin User",
        email: TEST_EMAIL,
        emailVerified: true,
        role: "admin",
        failedLoginAttempts: 0,
      })
      .onConflictDoNothing();

    // 2. Insert (or skip) the credential account row so Better-Auth can verify the password
    await db
      .insert(account)
      .values({
        id: randomUUID(),
        accountId: TEST_USER_ID,
        providerId: "credential",
        userId: TEST_USER_ID,
        password: passwordHash,
      })
      .onConflictDoNothing();

    console.log("\n✅ Admin user seeded successfully!");
    console.log("─────────────────────────────────────");
    console.log(`  Email   : ${TEST_EMAIL}`);
    console.log(`  Password: ${TEST_PASSWORD}`);
    console.log(`  Role    : admin`);
    console.log(`  User ID : ${TEST_USER_ID}`);
    console.log("─────────────────────────────────────");
    console.log("Use these credentials to sign in via Postman or the sign-in page.\n");
  } catch (error) {
    console.error("❌ Error seeding admin user:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedAdminUser();
