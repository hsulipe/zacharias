import { Pool } from "pg";
import cron from "node-cron";
import { sendExpiryAlert } from "../notifications/email.service";

interface ExpiringDocument {
  id: string;
  title: string;
  expires_at: Date;
  uploader_email: string;
  uploader_name: string;
}

export async function getExpiringSoon(
  db: Pool,
  daysAhead: number
): Promise<ExpiringDocument[]> {
  const result = await db.query<ExpiringDocument>(
    `SELECT d.id, d.title, d.expires_at, u.email AS uploader_email, u.name AS uploader_name
     FROM documents d
     JOIN users u ON u.id = d.uploader_id
     WHERE d.deleted_at IS NULL
       AND d.expires_at IS NOT NULL
       AND d.expires_at BETWEEN NOW() AND NOW() + INTERVAL '${daysAhead} days'`,
    []
  );
  return result.rows;
}

export function startExpiryCron(db: Pool) {
  // Run every day at 08:00
  cron.schedule("0 8 * * *", async () => {
    console.log("[Expiry Cron] Checking for expiring documents...");
    try {
      const docs = await getExpiringSoon(db, 7);
      for (const doc of docs) {
        await sendExpiryAlert(doc);
      }
      console.log(`[Expiry Cron] Sent ${docs.length} alert(s)`);
    } catch (err) {
      console.error("[Expiry Cron] Error:", err);
    }
  });

  console.log("[Expiry Cron] Scheduled (daily at 08:00)");
}
