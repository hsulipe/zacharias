import { Pool } from "pg";
import { AuditAction, AuditLog, PaginatedResult } from "../../types";

interface LogAuditParams {
  document_id?: string;
  user_id?: string;
  action: AuditAction;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(db: Pool, params: LogAuditParams): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (document_id, user_id, action, ip, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.document_id ?? null,
      params.user_id ?? null,
      params.action,
      params.ip ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );
}

export async function getAuditLogs(
  db: Pool,
  params: {
    document_id?: string;
    user_id?: string;
    page: number;
    limit: number;
  }
): Promise<PaginatedResult<AuditLog>> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.document_id) {
    conditions.push(`document_id = $${idx++}`);
    values.push(params.document_id);
  }
  if (params.user_id) {
    conditions.push(`user_id = $${idx++}`);
    values.push(params.user_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (params.page - 1) * params.limit;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM audit_logs ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query<AuditLog>(
    `SELECT * FROM audit_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, params.limit, offset]
  );

  return {
    data: result.rows,
    total,
    page: params.page,
    limit: params.limit,
    pages: Math.ceil(total / params.limit),
  };
}
