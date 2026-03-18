/**
 * Simple migration runner — applies SQL files in order.
 * Run with: npx tsx migrations/run-migrations.ts
 */
import { Pool } from "pg";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = join(__dirname);
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const applied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [file]
      );
      if (applied.rows.length > 0) {
        console.log(`[Migration] Skipping ${file} (already applied)`);
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[Migration] Applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[Migration] Failed on ${file}:`, err);
        process.exit(1);
      }
    }

    console.log("[Migration] All migrations applied successfully");
  } finally {
    client.release();
    await pool.end();
  }
}

run();
