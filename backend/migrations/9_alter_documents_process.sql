-- Migration 9: Add process columns to documents + process_history

ALTER TABLE documents
  ADD COLUMN process_type_id  UUID REFERENCES process_types(id) ON DELETE SET NULL,
  ADD COLUMN current_state_id UUID REFERENCES process_states(id) ON DELETE SET NULL,
  ADD COLUMN assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_process_type ON documents(process_type_id) WHERE process_type_id IS NOT NULL;
CREATE INDEX idx_documents_assigned_to  ON documents(assigned_to)      WHERE assigned_to      IS NOT NULL;

CREATE TABLE process_history (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID        NOT NULL REFERENCES documents(id)       ON DELETE CASCADE,
  from_state_id UUID        REFERENCES process_states(id) ON DELETE SET NULL,
  to_state_id   UUID        NOT NULL REFERENCES process_states(id)  ON DELETE SET NULL,
  changed_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  comment       TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_process_history_document ON process_history(document_id);
