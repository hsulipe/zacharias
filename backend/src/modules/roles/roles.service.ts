import { Pool } from "pg";
import { Role, RoleDocument, RoleBinding } from "../../types";

export async function listRoles(db: Pool): Promise<Role[]> {
  const result = await db.query<Role>("SELECT * FROM roles ORDER BY name");
  return result.rows;
}

export async function createRole(
  db: Pool,
  params: { name: string; description?: string; permission_level: string; created_by: string }
): Promise<Role> {
  const result = await db.query<Role>(
    `INSERT INTO roles (name, description, permission_level, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [params.name, params.description ?? null, params.permission_level, params.created_by]
  );
  return result.rows[0];
}

export async function getRoleById(db: Pool, id: string): Promise<Role | null> {
  const result = await db.query<Role>("SELECT * FROM roles WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function updateRole(
  db: Pool,
  id: string,
  params: { name?: string; description?: string; permission_level?: string }
): Promise<Role | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (params.name !== undefined) { sets.push(`name = $${i++}`); values.push(params.name); }
  if (params.description !== undefined) { sets.push(`description = $${i++}`); values.push(params.description); }
  if (params.permission_level !== undefined) { sets.push(`permission_level = $${i++}`); values.push(params.permission_level); }
  if (sets.length === 0) return getRoleById(db, id);
  values.push(id);
  const result = await db.query<Role>(
    `UPDATE roles SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteRole(db: Pool, id: string): Promise<void> {
  await db.query("DELETE FROM roles WHERE id = $1", [id]);
}

// ── Role → Document bindings ─────────────────────────────────────────────────

export async function getRoleDocuments(db: Pool, roleId: string): Promise<RoleDocument[]> {
  const result = await db.query<RoleDocument>(
    `SELECT rd.role_id, rd.document_id, d.title AS document_title, d.filename AS document_filename
     FROM role_documents rd
     JOIN documents d ON d.id = rd.document_id
     WHERE rd.role_id = $1
     ORDER BY d.title`,
    [roleId]
  );
  return result.rows;
}

export async function addDocumentToRole(db: Pool, roleId: string, documentId: string): Promise<void> {
  await db.query(
    `INSERT INTO role_documents (role_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [roleId, documentId]
  );
}

export async function removeDocumentFromRole(db: Pool, roleId: string, documentId: string): Promise<void> {
  await db.query(
    "DELETE FROM role_documents WHERE role_id = $1 AND document_id = $2",
    [roleId, documentId]
  );
}

// ── Role → User bindings ─────────────────────────────────────────────────────

export async function getRoleUserBindings(db: Pool, roleId: string): Promise<RoleBinding[]> {
  const result = await db.query<RoleBinding>(
    `SELECT urb.role_id, urb.user_id AS subject_id, 'user' AS subject_type,
            u.name AS subject_name, u.email AS subject_email, urb.assigned_at
     FROM user_role_bindings urb
     JOIN users u ON u.id = urb.user_id
     WHERE urb.role_id = $1
     ORDER BY u.name`,
    [roleId]
  );
  return result.rows;
}

export async function bindUserToRole(
  db: Pool, roleId: string, userId: string, assignedBy: string
): Promise<void> {
  await db.query(
    `INSERT INTO user_role_bindings (user_id, role_id, assigned_by)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, roleId, assignedBy]
  );
}

export async function unbindUserFromRole(db: Pool, roleId: string, userId: string): Promise<void> {
  await db.query(
    "DELETE FROM user_role_bindings WHERE role_id = $1 AND user_id = $2",
    [roleId, userId]
  );
}

// ── Role → Group bindings ────────────────────────────────────────────────────

export async function getRoleGroupBindings(db: Pool, roleId: string): Promise<RoleBinding[]> {
  const result = await db.query<RoleBinding>(
    `SELECT grb.role_id, grb.group_id AS subject_id, 'group' AS subject_type,
            g.name AS subject_name, NULL AS subject_email, grb.assigned_at
     FROM group_role_bindings grb
     JOIN groups g ON g.id = grb.group_id
     WHERE grb.role_id = $1
     ORDER BY g.name`,
    [roleId]
  );
  return result.rows;
}

export async function bindGroupToRole(
  db: Pool, roleId: string, groupId: string, assignedBy: string
): Promise<void> {
  await db.query(
    `INSERT INTO group_role_bindings (group_id, role_id, assigned_by)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [groupId, roleId, assignedBy]
  );
}

export async function unbindGroupFromRole(db: Pool, roleId: string, groupId: string): Promise<void> {
  await db.query(
    "DELETE FROM group_role_bindings WHERE role_id = $1 AND group_id = $2",
    [roleId, groupId]
  );
}

// ── Per-group / per-user role lookups ────────────────────────────────────────

export async function getGroupRoles(db: Pool, groupId: string): Promise<Role[]> {
  const result = await db.query<Role>(
    `SELECT r.* FROM roles r
     JOIN group_role_bindings grb ON grb.role_id = r.id
     WHERE grb.group_id = $1
     ORDER BY r.name`,
    [groupId]
  );
  return result.rows;
}

export async function getUserRoles(db: Pool, userId: string): Promise<Role[]> {
  const result = await db.query<Role>(
    `SELECT r.* FROM roles r
     JOIN user_role_bindings urb ON urb.role_id = r.id
     WHERE urb.user_id = $1
     ORDER BY r.name`,
    [userId]
  );
  return result.rows;
}
