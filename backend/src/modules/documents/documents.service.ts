import { Pool } from "pg";
import { Client as MinioClient } from "minio";
import crypto from "crypto";
import { Document, PaginatedResult } from "../../types";
import { config } from "../../config";

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

  // Upload to MinIO
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
  includeDeleted = false
): Promise<Document | null> {
  const condition = includeDeleted ? "" : "AND deleted_at IS NULL";
  const result = await db.query<Document>(
    `SELECT * FROM documents WHERE id = $1 ${condition}`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listDocuments(
  db: Pool,
  params: {
    uploader_id?: string;
    search?: string;
    page: number;
    limit: number;
  }
): Promise<PaginatedResult<Document>> {
  const conditions: string[] = ["deleted_at IS NULL"];
  const values: unknown[] = [];
  let idx = 1;

  if (params.uploader_id) {
    conditions.push(`uploader_id = $${idx++}`);
    values.push(params.uploader_id);
  }

  if (params.search) {
    conditions.push(
      `(to_tsvector('portuguese', title) @@ plainto_tsquery('portuguese', $${idx})
       OR EXISTS (
         SELECT 1 FROM document_metadata dm
         WHERE dm.document_id = documents.id
         AND to_tsvector('portuguese', dm.value) @@ plainto_tsquery('portuguese', $${idx})
       )
       OR ocr_text_vector @@ plainto_tsquery('portuguese', $${idx}))`
    );
    values.push(params.search);
    idx++;
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const offset = (params.page - 1) * params.limit;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM documents ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query<Document>(
    `SELECT id, title, filename, storage_key, mime_type, size, uploader_id,
            expires_at, is_searchable, ocr_status, created_at, updated_at, deleted_at
     FROM documents ${where}
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

export async function getPresignedDownloadUrl(
  minio: MinioClient,
  storageKey: string,
  filename: string,
  expirySeconds = 3600
): Promise<string> {
  return minio.presignedGetObject(config.MINIO_BUCKET, storageKey, expirySeconds, {
    "response-content-disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
  });
}
