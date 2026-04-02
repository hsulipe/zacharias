-- Migration 8: Process transitions

CREATE TABLE process_transitions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_type_id UUID        NOT NULL REFERENCES process_types(id) ON DELETE CASCADE,
  from_state_id   UUID        NOT NULL REFERENCES process_states(id) ON DELETE CASCADE,
  to_state_id     UUID        NOT NULL REFERENCES process_states(id) ON DELETE CASCADE,
  label           VARCHAR(200) NOT NULL,
  required_role   VARCHAR(50),
  UNIQUE (from_state_id, to_state_id)
);

CREATE INDEX idx_transitions_type      ON process_transitions(process_type_id);
CREATE INDEX idx_transitions_from      ON process_transitions(from_state_id);
