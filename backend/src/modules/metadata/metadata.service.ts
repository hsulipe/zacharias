import { Pool } from "pg";
import { DocumentMetadata } from "../../types";

export async function setMetadata(
  db: Pool,
  documentId: string,
  entries: { key: string; value: string }[]
): Promise<DocumentMetadata[]> {
  if (entries.length === 0) return [];

  // Upsert each key-value pair
  const results: DocumentMetadata[] = [];
  for (const { key, value } of entries) {
    const result = await db.query<DocumentMetadata>(
      `INSERT INTO document_metadata (document_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (document_id, key) DO UPDATE SET value = EXCLUDED.value
       RETURNING *`,
      [documentId, key, value]
    );
    results.push(result.rows[0]);
  }
  return results;
}

export async function getMetadata(
  db: Pool,
  documentId: string
): Promise<DocumentMetadata[]> {
  const result = await db.query<DocumentMetadata>(
    "SELECT * FROM document_metadata WHERE document_id = $1 ORDER BY key",
    [documentId]
  );
  return result.rows;
}

export async function deleteMetadataKey(
  db: Pool,
  documentId: string,
  key: string
): Promise<void> {
  await db.query(
    "DELETE FROM document_metadata WHERE document_id = $1 AND key = $2",
    [documentId, key]
  );
}
