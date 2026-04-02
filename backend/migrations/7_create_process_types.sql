-- Migration 7: Process types and states

CREATE TABLE process_types (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE process_states (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_type_id UUID        NOT NULL REFERENCES process_types(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  label           VARCHAR(200) NOT NULL,
  is_initial      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_terminal     BOOLEAN     NOT NULL DEFAULT FALSE,
  color           VARCHAR(7)  NOT NULL DEFAULT '#6B7280',
  position_order  INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (process_type_id, name)
);

CREATE INDEX idx_process_states_type ON process_states(process_type_id);
