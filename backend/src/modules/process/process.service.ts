import { Pool } from "pg";
import {
  ProcessType,
  ProcessState,
  ProcessTransition,
  ProcessHistory,
  MetadataSchema,
  SchemaField,
  UserRole,
} from "../../types";

// ── Process Types ────────────────────────────────────────────────────────────

export async function listProcessTypes(db: Pool): Promise<ProcessType[]> {
  const result = await db.query<ProcessType>(
    "SELECT * FROM process_types ORDER BY name"
  );
  return result.rows;
}

export async function createProcessType(
  db: Pool,
  params: { name: string; description?: string; created_by: string }
): Promise<ProcessType> {
  const result = await db.query<ProcessType>(
    `INSERT INTO process_types (name, description, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [params.name, params.description ?? null, params.created_by]
  );
  return result.rows[0];
}

export async function getProcessTypeById(
  db: Pool,
  id: string
): Promise<ProcessType | null> {
  const result = await db.query<ProcessType>(
    "SELECT * FROM process_types WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateProcessType(
  db: Pool,
  id: string,
  params: { name?: string; description?: string }
): Promise<ProcessType> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (params.name !== undefined) { sets.push(`name = $${idx++}`); values.push(params.name); }
  if (params.description !== undefined) { sets.push(`description = $${idx++}`); values.push(params.description); }
  if (sets.length === 0) throw new Error("NO_FIELDS");
  values.push(id);
  const result = await db.query<ProcessType>(
    `UPDATE process_types SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new Error("NOT_FOUND");
  return result.rows[0];
}

export async function deleteProcessType(db: Pool, id: string): Promise<void> {
  await db.query("DELETE FROM process_types WHERE id = $1", [id]);
}

// ── Process States ───────────────────────────────────────────────────────────

export async function listProcessStates(
  db: Pool,
  processTypeId: string
): Promise<ProcessState[]> {
  const result = await db.query<ProcessState>(
    `SELECT * FROM process_states WHERE process_type_id = $1 ORDER BY position_order, name`,
    [processTypeId]
  );
  return result.rows;
}

export async function createProcessState(
  db: Pool,
  params: {
    process_type_id: string;
    name: string;
    label: string;
    is_initial?: boolean;
    is_terminal?: boolean;
    color?: string;
    position_order?: number;
  }
): Promise<ProcessState> {
  const result = await db.query<ProcessState>(
    `INSERT INTO process_states (process_type_id, name, label, is_initial, is_terminal, color, position_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      params.process_type_id,
      params.name,
      params.label,
      params.is_initial ?? false,
      params.is_terminal ?? false,
      params.color ?? "#6B7280",
      params.position_order ?? 0,
    ]
  );
  return result.rows[0];
}

export async function updateProcessState(
  db: Pool,
  id: string,
  params: Partial<Pick<ProcessState, "name" | "label" | "is_initial" | "is_terminal" | "color" | "position_order">>
): Promise<ProcessState> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const fields = ["name", "label", "is_initial", "is_terminal", "color", "position_order"] as const;
  for (const f of fields) {
    if (params[f] !== undefined) {
      sets.push(`${f} = $${idx++}`);
      values.push(params[f]);
    }
  }
  if (sets.length === 0) throw new Error("NO_FIELDS");
  values.push(id);
  const result = await db.query<ProcessState>(
    `UPDATE process_states SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new Error("NOT_FOUND");
  return result.rows[0];
}

export async function deleteProcessState(db: Pool, id: string): Promise<void> {
  await db.query("DELETE FROM process_states WHERE id = $1", [id]);
}

// ── Process Transitions ──────────────────────────────────────────────────────

export async function listProcessTransitions(
  db: Pool,
  processTypeId: string
): Promise<ProcessTransition[]> {
  const result = await db.query<ProcessTransition>(
    `SELECT * FROM process_transitions WHERE process_type_id = $1 ORDER BY label`,
    [processTypeId]
  );
  return result.rows;
}

export async function createProcessTransition(
  db: Pool,
  params: {
    process_type_id: string;
    from_state_id: string;
    to_state_id: string;
    label: string;
    required_role?: UserRole;
  }
): Promise<ProcessTransition> {
  const result = await db.query<ProcessTransition>(
    `INSERT INTO process_transitions (process_type_id, from_state_id, to_state_id, label, required_role)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      params.process_type_id,
      params.from_state_id,
      params.to_state_id,
      params.label,
      params.required_role ?? null,
    ]
  );
  return result.rows[0];
}

export async function deleteProcessTransition(db: Pool, id: string): Promise<void> {
  await db.query("DELETE FROM process_transitions WHERE id = $1", [id]);
}

// ── Document: assign process type ────────────────────────────────────────────

export async function assignProcessType(
  db: Pool,
  documentId: string,
  processTypeId: string
): Promise<{ process_type_id: string; current_state_id: string }> {
  const initialState = await db.query<ProcessState>(
    `SELECT * FROM process_states WHERE process_type_id = $1 AND is_initial = TRUE LIMIT 1`,
    [processTypeId]
  );
  if (!initialState.rows[0]) {
    throw new Error("NO_INITIAL_STATE");
  }
  const state = initialState.rows[0];

  await db.query(
    `UPDATE documents SET process_type_id = $1, current_state_id = $2, updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL`,
    [processTypeId, state.id, documentId]
  );

  await db.query(
    `INSERT INTO process_history (document_id, from_state_id, to_state_id, changed_by, comment)
     VALUES ($1, NULL, $2, NULL, 'Process type assigned')`,
    [documentId, state.id]
  );

  return { process_type_id: processTypeId, current_state_id: state.id };
}

// ── Document: state transition ───────────────────────────────────────────────

export async function transitionDocumentState(
  db: Pool,
  documentId: string,
  toStateId: string,
  userId: string,
  userRole: UserRole,
  comment?: string
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const docResult = await client.query<{ current_state_id: string; process_type_id: string }>(
      `SELECT current_state_id, process_type_id FROM documents WHERE id = $1 AND deleted_at IS NULL`,
      [documentId]
    );
    const doc = docResult.rows[0];
    if (!doc) throw new Error("DOCUMENT_NOT_FOUND");
    if (!doc.current_state_id || !doc.process_type_id) throw new Error("NO_PROCESS_TYPE");

    // Verify transition exists
    const transResult = await client.query<ProcessTransition>(
      `SELECT * FROM process_transitions
       WHERE from_state_id = $1 AND to_state_id = $2 AND process_type_id = $3`,
      [doc.current_state_id, toStateId, doc.process_type_id]
    );
    const transition = transResult.rows[0];
    if (!transition) throw new Error("TRANSITION_NOT_ALLOWED");

    // Role check
    if (transition.required_role && transition.required_role !== userRole && userRole !== "admin") {
      throw new Error("ROLE_INSUFFICIENT");
    }

    // Update document state
    await client.query(
      `UPDATE documents SET current_state_id = $1, updated_at = NOW() WHERE id = $2`,
      [toStateId, documentId]
    );

    // Record history
    await client.query(
      `INSERT INTO process_history (document_id, from_state_id, to_state_id, changed_by, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [documentId, doc.current_state_id, toStateId, userId, comment ?? null]
    );

    // Mark matching pending deadlines as met
    await client.query(
      `UPDATE process_deadlines
       SET status = 'met', updated_at = NOW()
       WHERE document_id = $1 AND target_state_id = $2 AND status = 'pending'`,
      [documentId, toStateId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Process History ──────────────────────────────────────────────────────────

export async function getProcessHistory(
  db: Pool,
  documentId: string
): Promise<ProcessHistory[]> {
  const result = await db.query<ProcessHistory>(
    `SELECT ph.*,
            fs.label AS from_state_label,
            ts.label AS to_state_label,
            u.name   AS changed_by_name
     FROM process_history ph
     LEFT JOIN process_states fs ON fs.id = ph.from_state_id
     LEFT JOIN process_states ts ON ts.id = ph.to_state_id
     LEFT JOIN users u ON u.id = ph.changed_by
     WHERE ph.document_id = $1
     ORDER BY ph.changed_at DESC`,
    [documentId]
  );
  return result.rows;
}

// ── Metadata Schemas ─────────────────────────────────────────────────────────

export async function getSchema(
  db: Pool,
  processTypeId: string
): Promise<MetadataSchema | null> {
  const result = await db.query<MetadataSchema>(
    "SELECT * FROM metadata_schemas WHERE process_type_id = $1",
    [processTypeId]
  );
  return result.rows[0] ?? null;
}

export async function upsertSchema(
  db: Pool,
  processTypeId: string,
  fields: SchemaField[]
): Promise<MetadataSchema> {
  const result = await db.query<MetadataSchema>(
    `INSERT INTO metadata_schemas (process_type_id, fields)
     VALUES ($1, $2)
     ON CONFLICT (process_type_id)
     DO UPDATE SET fields = EXCLUDED.fields, updated_at = NOW()
     RETURNING *`,
    [processTypeId, JSON.stringify(fields)]
  );
  return result.rows[0];
}

export async function deleteSchema(db: Pool, processTypeId: string): Promise<void> {
  await db.query("DELETE FROM metadata_schemas WHERE process_type_id = $1", [processTypeId]);
}

export async function validateDocumentSchema(
  db: Pool,
  documentId: string
): Promise<{ valid: boolean; missing: string[]; invalid: string[] }> {
  // Get document's process type schema
  const schemaResult = await db.query<{ fields: SchemaField[] }>(
    `SELECT ms.fields FROM metadata_schemas ms
     JOIN documents d ON d.process_type_id = ms.process_type_id
     WHERE d.id = $1`,
    [documentId]
  );
  if (!schemaResult.rows[0]) {
    return { valid: true, missing: [], invalid: [] };
  }
  const fields: SchemaField[] = schemaResult.rows[0].fields;

  // Get document metadata
  const metaResult = await db.query<{ key: string; value: string }>(
    "SELECT key, value FROM document_metadata WHERE document_id = $1",
    [documentId]
  );
  const metaMap = new Map<string, string>(
    metaResult.rows.map((r: { key: string; value: string }) => [r.key, r.value] as [string, string])
  );

  const missing: string[] = [];
  const invalid: string[] = [];

  for (const field of fields) {
    const val: string | undefined = metaMap.get(field.key);
    if (field.required && (!val || val.trim() === "")) {
      missing.push(field.key);
      continue;
    }
    if (val && val.trim() !== "") {
      if (field.type === "number" && isNaN(Number(val))) invalid.push(field.key);
      if (field.type === "date" && isNaN(Date.parse(val))) invalid.push(field.key);
      if (field.type === "select" && field.options && !field.options.includes(val)) {
        invalid.push(field.key);
      }
    }
  }

  return { valid: missing.length === 0 && invalid.length === 0, missing, invalid };
}
