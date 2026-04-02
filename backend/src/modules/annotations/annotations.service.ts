import { Pool } from "pg";
import { PdfAnnotation, AnnotationRect, AnnotationType } from "../../types";

export async function listAnnotations(
  db: Pool,
  documentId: string
): Promise<PdfAnnotation[]> {
  const result = await db.query<PdfAnnotation>(
    `SELECT pa.*, u.name AS user_name
     FROM pdf_annotations pa
     LEFT JOIN users u ON u.id = pa.user_id
     WHERE pa.document_id = $1
     ORDER BY pa.page, pa.created_at`,
    [documentId]
  );
  return result.rows;
}

export async function createAnnotation(
  db: Pool,
  params: {
    document_id: string;
    user_id: string;
    page: number;
    type: AnnotationType;
    rect: AnnotationRect;
    selected_text?: string;
    content?: string;
    color?: string;
  }
): Promise<PdfAnnotation> {
  const result = await db.query<PdfAnnotation>(
    `INSERT INTO pdf_annotations (document_id, user_id, page, type, rect, selected_text, content, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      params.document_id,
      params.user_id,
      params.page,
      params.type,
      JSON.stringify(params.rect),
      params.selected_text ?? null,
      params.content ?? null,
      params.color ?? "#FBBF24",
    ]
  );
  return result.rows[0];
}

export async function updateAnnotation(
  db: Pool,
  id: string,
  params: { content?: string; color?: string }
): Promise<PdfAnnotation> {
  const sets: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let idx = 1;
  if (params.content !== undefined) { sets.push(`content = $${idx++}`); values.push(params.content); }
  if (params.color !== undefined) { sets.push(`color = $${idx++}`); values.push(params.color); }
  values.push(id);
  const result = await db.query<PdfAnnotation>(
    `UPDATE pdf_annotations SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new Error("NOT_FOUND");
  return result.rows[0];
}

export async function deleteAnnotation(
  db: Pool,
  id: string,
  userId: string,
  userRole: string
): Promise<void> {
  const existing = await db.query<{ user_id: string }>(
    "SELECT user_id FROM pdf_annotations WHERE id = $1",
    [id]
  );
  if (!existing.rows[0]) throw new Error("NOT_FOUND");
  if (userRole !== "admin" && existing.rows[0].user_id !== userId) {
    throw new Error("FORBIDDEN");
  }
  await db.query("DELETE FROM pdf_annotations WHERE id = $1", [id]);
}
