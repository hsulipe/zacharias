/**
 * Creates the first admin user.
 * Usage: DATABASE_URL=... npx tsx scripts/seed-admin.ts
 */
import { Pool } from "pg";
import crypto from "crypto";

async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  const name = process.env.ADMIN_NAME ?? "Admin";
  const email = process.env.ADMIN_EMAIL ?? "admin@ged.local";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");

  try {
    await db.query(
      `INSERT INTO users (name, email, password_hash, password_salt, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
      [name, email, hash, salt]
    );
    console.log(`Admin user created: ${email} / ${password}`);
    console.log("IMPORTANT: Change the password after first login!");
  } finally {
    await db.end();
  }
}

main().catch(console.error);
