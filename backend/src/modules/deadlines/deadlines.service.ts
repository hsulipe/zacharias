import { Pool } from "pg";
import cron from "node-cron";
import { ProcessDeadline } from "../../types";
import { sendDeadlineAlert } from "../notifications/email.service";

export async function listDeadlines(
  db: Pool,
  documentId: string
): Promise<ProcessDeadline[]> {
  const result = await db.query<ProcessDeadline>(
    `SELECT * FROM process_deadlines WHERE document_id = $1 ORDER BY due_at`,
    [documentId]
  );
  return result.rows;
}

export async function createDeadline(
  db: Pool,
  params: {
    document_id: string;
    label: string;
    due_at: Date;
    target_state_id?: string;
    alert_days_before?: number[];
    created_by: string;
  }
): Promise<ProcessDeadline> {
  const result = await db.query<ProcessDeadline>(
    `INSERT INTO process_deadlines (document_id, label, due_at, target_state_id, alert_days_before, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      params.document_id,
      params.label,
      params.due_at,
      params.target_state_id ?? null,
      params.alert_days_before ?? [],
      params.created_by,
    ]
  );
  return result.rows[0];
}

export async function updateDeadline(
  db: Pool,
  id: string,
  params: Partial<Pick<ProcessDeadline, "label" | "due_at" | "alert_days_before">>
): Promise<ProcessDeadline> {
  const sets: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let idx = 1;
  if (params.label !== undefined) { sets.push(`label = $${idx++}`); values.push(params.label); }
  if (params.due_at !== undefined) { sets.push(`due_at = $${idx++}`); values.push(params.due_at); }
  if (params.alert_days_before !== undefined) { sets.push(`alert_days_before = $${idx++}`); values.push(params.alert_days_before); }
  values.push(id);
  const result = await db.query<ProcessDeadline>(
    `UPDATE process_deadlines SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new Error("NOT_FOUND");
  return result.rows[0];
}

export async function deleteDeadline(db: Pool, id: string): Promise<void> {
  await db.query("DELETE FROM process_deadlines WHERE id = $1", [id]);
}

// ── Deadline Cron ─────────────────────────────────────────────────────────────

interface DeadlineAlertContext {
  deadline_id: string;
  label: string;
  due_at: Date;
  document_id: string;
  document_title: string;
  recipient_emails: string[];
  recipient_names: string[];
}

async function getAlertContexts(
  db: Pool,
  daysAhead: number
): Promise<DeadlineAlertContext[]> {
  // Get pending deadlines where today is in alert_days_before
  const result = await db.query<{
    deadline_id: string;
    label: string;
    due_at: Date;
    document_id: string;
    document_title: string;
    days_until: number;
  }>(
    `SELECT pd.id AS deadline_id, pd.label, pd.due_at,
            d.id AS document_id, d.title AS document_title,
            (pd.due_at::date - CURRENT_DATE) AS days_until
     FROM process_deadlines pd
     JOIN documents d ON d.id = pd.document_id
     WHERE pd.status = 'pending'
       AND (pd.due_at::date - CURRENT_DATE) = ANY(pd.alert_days_before)
       AND NOT EXISTS (
         SELECT 1 FROM deadline_alert_log dal
         WHERE dal.deadline_id = pd.id
           AND dal.days_before = (pd.due_at::date - CURRENT_DATE)
       )`
  );

  const contexts: DeadlineAlertContext[] = [];

  for (const row of result.rows) {
    // Collect recipients: uploader + assigned_to + all admins
    const recipientResult = await db.query<{ email: string; name: string }>(
      `SELECT DISTINCT u.email, u.name FROM users u
       WHERE u.id IN (
         SELECT uploader_id FROM documents WHERE id = $1
         UNION
         SELECT assigned_to FROM documents WHERE id = $1 AND assigned_to IS NOT NULL
       )
       OR u.role = 'admin'`,
      [row.document_id]
    );

    contexts.push({
      deadline_id: row.deadline_id,
      label: row.label,
      due_at: row.due_at,
      document_id: row.document_id,
      document_title: row.document_title,
      recipient_emails: recipientResult.rows.map((r) => r.email),
      recipient_names: recipientResult.rows.map((r) => r.name),
    });
  }

  return contexts;
}

async function markMissedDeadlines(db: Pool): Promise<number> {
  const result = await db.query(
    `UPDATE process_deadlines SET status = 'missed', updated_at = NOW()
     WHERE status = 'pending' AND due_at < NOW()`
  );
  return result.rowCount ?? 0;
}

async function recordAlertSent(
  db: Pool,
  deadlineId: string,
  daysBefore: number
): Promise<void> {
  await db.query(
    `INSERT INTO deadline_alert_log (deadline_id, days_before) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [deadlineId, daysBefore]
  );
}

export function startDeadlineCron(db: Pool) {
  cron.schedule("0 8 * * *", async () => {
    console.log("[Deadline Cron] Running...");
    try {
      // 1. Mark missed
      const missed = await markMissedDeadlines(db);
      console.log(`[Deadline Cron] Marked ${missed} deadline(s) as missed`);

      // 2. Send alerts
      const contexts = await getAlertContexts(db, 0);
      for (const ctx of contexts) {
        const daysLeft = Math.ceil(
          (new Date(ctx.due_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        for (let i = 0; i < ctx.recipient_emails.length; i++) {
          await sendDeadlineAlert({
            email: ctx.recipient_emails[i],
            name: ctx.recipient_names[i],
            document_id: ctx.document_id,
            document_title: ctx.document_title,
            label: ctx.label,
            due_at: ctx.due_at,
            days_left: daysLeft,
          });
        }
        await recordAlertSent(db, ctx.deadline_id, daysLeft);
      }

      console.log(`[Deadline Cron] Sent alerts for ${contexts.length} deadline(s)`);
    } catch (err) {
      console.error("[Deadline Cron] Error:", err);
    }
  });

  console.log("[Deadline Cron] Scheduled (daily at 08:00)");
}
