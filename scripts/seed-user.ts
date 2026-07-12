import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "../db/schema/auth";

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString!, { prepare: false });
const db = drizzle(client);

async function seedUser() {
  console.log("Seeding test user...");
  try {
    await db.insert(user).values({
      id: "test-user-1",
      name: "Admin User",
      email: "user@example.com",
      emailVerified: true,
      role: "admin",
      failedLoginAttempts: 0,
    }).onConflictDoNothing();
    console.log("Test user 'user@example.com' seeded successfully!");
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

seedUser();
