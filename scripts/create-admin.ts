import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user, account } from "../db/schema/auth";
import { auditEvent } from "../db/schema/platform";
import { sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL is not set in environment.");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return null;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  let name = getArg("--name");
  let email = getArg("--email");
  let password = getArg("--password");

  if (!name || !email || !password) {
    console.log("=== Bootstrap Admin User ===");
    if (!name) name = await question("Enter Name: ");
    if (!email) email = await question("Enter Email: ");
    if (!password) password = await question("Enter Password (min 8 chars): ");
  }

  name = name.trim();
  email = email.trim().toLowerCase();
  password = password.trim();

  if (!name) {
    console.error("Error: Name is required.");
    rl.close();
    await client.end();
    process.exit(1);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Error: A valid email is required.");
    rl.close();
    await client.end();
    process.exit(1);
  }

  if (!password || password.length < 8 || password.length > 128) {
    console.error("Error: Password must be between 8 and 128 characters.");
    rl.close();
    await client.end();
    process.exit(1);
  }

  console.log(`\nCreating admin user: ${name} <${email}>...`);

  try {
    // Check if user already exists
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`)
      .limit(1);

    if (existing) {
      console.error(`Error: A user with email '${email}' already exists.`);
      rl.close();
      await client.end();
      process.exit(1);
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    await db.transaction(async (tx) => {
      // Insert user
      await tx.insert(user).values({
        id: userId,
        name,
        email,
        role: "admin",
        emailVerified: true,
      });

      // Insert account credentials
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      });

      // Insert audit log
      await tx.insert(auditEvent).values({
        action: "user.admin_bootstrapped",
        entityType: "user",
        entityId: userId,
        after: {
          email,
          role: "admin",
          emailVerified: true,
        },
      });
    });

    console.log("\nSuccess: Admin user created successfully!");
    console.log("You can now log in using these credentials.");
  } catch (err) {
    console.error("\nDatabase transaction failed:", err);
  } finally {
    rl.close();
    await client.end();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
