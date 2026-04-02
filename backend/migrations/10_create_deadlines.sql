-- Migration 10: Process deadlines and alert log

CREATE TYPE deadline_status AS ENUM ('pending', 'met', 'missed');

CREATE TABLE process_deadlines (
  id               UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id      UUID            NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  label            VARCHAR(200)    NOT NULL,
  due_at           TIMESTAMPTZ     NOT NULL,
  target_state_id  UUID            REFERENCES process_states(id) ON DELETE SET NULL,
  alert_days_before INTEGER[]      NOT NULL DEFAULT '{}',
  status           deadline_status NOT NULL DEFAULT 'pending',
  created_by       UUID            REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE deadline_alert_log (
  deadline_id UUID    NOT NULL REFERENCES process_deadlines(id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (deadline_id, days_before)
);

CREATE INDEX idx_deadlines_document ON process_deadlines(document_id);
CREATE INDEX idx_deadlines_pending  ON process_deadlines(due_at) WHERE status = 'pending';
