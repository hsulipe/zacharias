-- Migration: Create audit_logs table

CREATE TABLE audit_logs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  UUID        REFERENCES documents(id) ON DELETE SET NULL,
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(60) NOT NULL,
  ip           INET,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_document  ON audit_logs(document_id);
CREATE INDEX idx_audit_user      ON audit_logs(user_id);
CREATE INDEX idx_audit_action    ON audit_logs(action);
CREATE INDEX idx_audit_created   ON audit_logs(created_at DESC);
