import { Pool } from "pg";
import { Client as MinioClient } from "minio";
import crypto from "crypto";
import { Document, PaginatedResult, UserRole } from "../../types";
import { config } from "../../config";

// Builds the RBAC visibility SQL clause.
// Admins see all. Others see: their own uploads, OR docs in their groups.
// Documents with NO groups assigned are visible only to uploader and admins.
function visibilityClause(userRole: UserRole, userId: string, idx: { n: number }): {
  sql: string;
  values: unknown[];
} {
  if (userRole === "admin") return { sql: "1=1", values: [] };
  const i1 = idx.n++;
  const i2 = idx.n++;
  return {
    sql: `(documents.uploader_id = $${i1} OR EXISTS (
      SELECT 1 FROM document_groups dg
      JOIN group_members gm ON gm.group_id = dg.group_id
      WHERE dg.document_id = documents.id AND gm.user_id = $${i2}
    ))`,
    values: [userId, userId],
  };
}

export async function createDocument(
  db: Pool,
  params: {
    title: string;
    filename: string;
    mime_type: string;
    size: number;
    uploader_id: string;
    expires_at?: Date;
    fileBuffer: Buffer;
    minio: MinioClient;
  }
): Promise<Document> {
  const storageKey = `${crypto.randomUUID()}/${params.filename}`;

  await params.minio.putObject(
    config.MINIO_BUCKET,
    storageKey,
    params.fileBuffer,
    params.size,
    { "Content-Type": params.mime_type }
  );

  const result = await db.query<Document>(
    `INSERT INTO documents (title, filename, storage_key, mime_type, size, uploader_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.title,
      params.filename,
      storageKey,
      params.mime_type,
      params.size,
      params.uploader_id,
      params.expires_at ?? null,
    ]
  );

  return result.rows[0];
}

export async function getDocumentById(
  db: Pool,
  id: string,
  caller: { userId: string; userRole: UserRole },
  includeDeleted = false
): Promise<Document | null> {
  const idx = { n: 2 };
  const vis = visibilityClause(caller.userRole, caller.userId, idx);
  const deletedCond = includeDeleted ? "" : "AND deleted_at IS NULL";
  const result = await db.query<Document>(
    `SELECT * FROM documents WHERE id = $1 ${deletedCond} AND ${vis.sql}`,
    [id, ...vis.values]
  );
  return result.rows[0] ?? null;
}

export async function listDocuments(
  db: Pool,
  params: {
    userId: string;
    userRole: UserRole;
    search?: string;
    process_type_id?: string;
    current_state_id?: string;
    assigned_to?: string;
    due_from?: string;
    due_to?: string;
    meta?: Record<string, string>;
    tag?: string | string[];
    page: number;
    limit: number;
  }
): Promise<PaginatedResult<Document>> {
  const conditions: string[] = ["documents.deleted_at IS NULL"];
  const values: unknown[] = [];
  const idx = { n: 1 };

  // Visibility filter
  const vis = visibilityClause(params.userRole, params.userId, idx);
  conditions.push(vis.sql);
  values.push(...vis.values);

  if (params.search) {
    const i = idx.n++;
    conditions.push(
      `(to_tsvector('portuguese', documents.title) @@ plainto_tsquery('portuguese', $${i})
       OR EXISTS (
         SELECT 1 FROM document_metadata dm
         WHERE dm.document_id = documents.id
         AND to_tsvector('portuguese', dm.value) @@ plainto_tsquery('portuguese', $${i})
       )
       OR documents.ocr_text_vector @@ plainto_tsquery('portuguese', $${i}))`
    );
    values.push(params.search);
  }

  if (params.process_type_id) {
    conditions.push(`documents.process_type_id = $${idx.n++}`);
    values.push(params.process_type_id);
  }

  if (params.current_state_id) {
    conditions.push(`documents.current_state_id = $${idx.n++}`);
    values.push(params.current_state_id);
  }

  if (params.assigned_to) {
    conditions.push(`documents.assigned_to = $${idx.n++}`);
    values.push(params.assigned_to);
  }

  if (params.due_from || params.due_to) {
    conditions.push(`EXISTS (
      SELECT 1 FROM process_deadlines pd
      WHERE pd.document_id = documents.id
        AND pd.status = 'pending'
        ${params.due_from ? `AND pd.due_at >= $${idx.n++}` : ""}
        ${params.due_to ? `AND pd.due_at <= $${idx.n++}` : ""}
    )`);
    if (params.due_from) values.push(params.due_from);
    if (params.due_to) values.push(params.due_to);
  }

  // Metadata key=value filters (AND-combined)
  if (params.meta) {
    for (const [key, val] of Object.entries(params.meta)) {
      const ki = idx.n++;
      const vi = idx.n++;
      conditions.push(
        `EXISTS (SELECT 1 FROM document_metadata dm WHERE dm.document_id = documents.id AND dm.key = $${ki} AND dm.value = $${vi})`
      );
      values.push(key, val);
    }
  }

  // Tag filters (OR-combined, tag: prefix)
  const tags = params.tag
    ? Array.isArray(params.tag) ? params.tag : [params.tag]
    : [];
  if (tags.length > 0) {
    const tagConditions = tags.map((tag) => {
      const ti = idx.n++;
      values.push(`tag:${tag}`);
      return `EXISTS (SELECT 1 FROM document_metadata dm WHERE dm.document_id = documents.id AND dm.key = $${ti})`;
    });
    conditions.push(`(${tagConditions.join(" OR ")})`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const offset = (params.page - 1) * params.limit;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM documents ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const limitIdx = idx.n++;
  const offsetIdx = idx.n++;
  const result = await db.query<Document>(
    `SELECT documents.id, documents.title, documents.filename, documents.storage_key,
            documents.mime_type, documents.size, documents.uploader_id,
            documents.expires_at, documents.is_searchable, documents.ocr_status,
            documents.process_type_id, documents.current_state_id, documents.assigned_to,
            documents.created_at, documents.updated_at, documents.deleted_at
     FROM documents ${where}
     ORDER BY documents.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
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

export async function getDocumentFacets(
  db: Pool,
  caller: { userId: string; userRole: UserRole }
): Promise<{
  by_process_type: { process_type_id: string; name: string; count: number }[];
  by_state: { current_state_id: string; label: string; color: string; count: number }[];
  by_assigned_to: { assigned_to: string; name: string; count: number }[];
}> {
  const idx = { n: 1 };
  const vis = visibilityClause(caller.userRole, caller.userId, idx);
  const visSql = vis.sql;
  const visVals = vis.values;

  const [ptResult, stResult, assignResult] = await Promise.all([
    db.query<{ process_type_id: string; name: string; count: string }>(
      `SELECT documents.process_type_id, pt.name, COUNT(*) AS count
       FROM documents
       JOIN process_types pt ON pt.id = documents.process_type_id
       WHERE documents.deleted_at IS NULL AND documents.process_type_id IS NOT NULL AND ${visSql}
       GROUP BY documents.process_type_id, pt.name
       ORDER BY pt.name`,
      visVals
    ),
    db.query<{ current_state_id: string; label: string; color: string; count: string }>(
      `SELECT documents.current_state_id, ps.label, ps.color, COUNT(*) AS count
       FROM documents
       JOIN process_states ps ON ps.id = documents.current_state_id
       WHERE documents.deleted_at IS NULL AND documents.current_state_id IS NOT NULL AND ${visSql}
       GROUP BY documents.current_state_id, ps.label, ps.color
       ORDER BY ps.label`,
      visVals
    ),
    db.query<{ assigned_to: string; name: string; count: string }>(
      `SELECT documents.assigned_to, u.name, COUNT(*) AS count
       FROM documents
       JOIN users u ON u.id = documents.assigned_to
       WHERE documents.deleted_at IS NULL AND documents.assigned_to IS NOT NULL AND ${visSql}
       GROUP BY documents.assigned_to, u.name
       ORDER BY u.name`,
      visVals
    ),
  ]);

  return {
    by_process_type: ptResult.rows.map((r) => ({ ...r, count: parseInt(r.count, 10) })),
    by_state: stResult.rows.map((r) => ({ ...r, count: parseInt(r.count, 10) })),
    by_assigned_to: assignResult.rows.map((r) => ({ ...r, count: parseInt(r.count, 10) })),
  };
}

export async function softDeleteDocument(db: Pool, id: string): Promise<void> {
  await db.query(
    "UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
}

export async function updateDocumentExpiry(
  db: Pool,
  id: string,
  expiresAt: Date | null
): Promise<Document> {
  const result = await db.query<Document>(
    "UPDATE documents SET expires_at = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *",
    [expiresAt, id]
  );
  if (result.rows.length === 0) throw new Error("DOCUMENT_NOT_FOUND");
  return result.rows[0];
}

export async function updateDocumentAssignedTo(
  db: Pool,
  id: string,
  assignedTo: string | null
): Promise<Document> {
  const result = await db.query<Document>(
    "UPDATE documents SET assigned_to = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *",
    [assignedTo, id]
  );
  if (result.rows.length === 0) throw new Error("DOCUMENT_NOT_FOUND");
  return result.rows[0];
}

// Rewrites the internal MinIO hostname in a presigned URL to the public-facing URL.
// The URL path and all query parameters (including the AWS4 signature) are preserved.
// An nginx proxy on the public port (see nginx.conf) forwards requests back to
// minio:9000 with `Host: minio:9000`, so the signature that was computed with
// the internal hostname continues to verify correctly.
function rewriteMinioUrl(url: string): string {
  if (!config.MINIO_PUBLIC_URL) return url;
  const internal = new URL(url);
  const pub = new URL(config.MINIO_PUBLIC_URL);
  internal.protocol = pub.protocol;
  internal.hostname = pub.hostname;
  internal.port = pub.port;
  return internal.toString();
}

export async function getPresignedDownloadUrl(
  minio: MinioClient,
  storageKey: string,
  filename: string,
  expirySeconds = 3600
): Promise<string> {
  const url = await minio.presignedGetObject(config.MINIO_BUCKET, storageKey, expirySeconds, {
    "response-content-disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
  });
  return rewriteMinioUrl(url);
}

export async function getPresignedViewUrl(
  minio: MinioClient,
  storageKey: string,
  expirySeconds = 3600
): Promise<string> {
  const url = await minio.presignedGetObject(config.MINIO_BUCKET, storageKey, expirySeconds);
  return rewriteMinioUrl(url);
}
