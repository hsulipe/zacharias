import { Pool } from "pg";
import { Group, GroupMember } from "../../types";

export async function listGroups(db: Pool): Promise<Group[]> {
  const result = await db.query<Group>(
    "SELECT * FROM groups ORDER BY name"
  );
  return result.rows;
}

export async function createGroup(
  db: Pool,
  params: { name: string; description?: string; created_by: string }
): Promise<Group> {
  const result = await db.query<Group>(
    `INSERT INTO groups (name, description, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [params.name, params.description ?? null, params.created_by]
  );
  return result.rows[0];
}

export async function getGroupById(db: Pool, id: string): Promise<Group | null> {
  const result = await db.query<Group>(
    "SELECT * FROM groups WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function deleteGroup(db: Pool, id: string): Promise<void> {
  await db.query("DELETE FROM groups WHERE id = $1", [id]);
}

export async function getGroupMembers(db: Pool, groupId: string): Promise<GroupMember[]> {
  const result = await db.query<GroupMember>(
    `SELECT gm.*, u.name AS user_name, u.email AS user_email
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY u.name`,
    [groupId]
  );
  return result.rows;
}

export async function addGroupMember(
  db: Pool,
  groupId: string,
  userId: string,
  addedBy: string
): Promise<void> {
  await db.query(
    `INSERT INTO group_members (group_id, user_id, added_by)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [groupId, userId, addedBy]
  );
}

export async function removeGroupMember(
  db: Pool,
  groupId: string,
  userId: string
): Promise<void> {
  await db.query(
    "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId]
  );
}

export async function assignDocumentToGroup(
  db: Pool,
  documentId: string,
  groupId: string
): Promise<void> {
  await db.query(
    `INSERT INTO document_groups (document_id, group_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [documentId, groupId]
  );
}

export async function removeDocumentFromGroup(
  db: Pool,
  documentId: string,
  groupId: string
): Promise<void> {
  await db.query(
    "DELETE FROM document_groups WHERE document_id = $1 AND group_id = $2",
    [documentId, groupId]
  );
}

export async function getDocumentGroups(db: Pool, documentId: string): Promise<Group[]> {
  const result = await db.query<Group>(
    `SELECT g.* FROM groups g
     JOIN document_groups dg ON dg.group_id = g.id
     WHERE dg.document_id = $1
     ORDER BY g.name`,
    [documentId]
  );
  return result.rows;
}
