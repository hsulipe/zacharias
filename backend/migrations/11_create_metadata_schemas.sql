-- Migration 11: Metadata schemas per process type

CREATE TABLE metadata_schemas (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_type_id UUID        NOT NULL UNIQUE REFERENCES process_types(id) ON DELETE CASCADE,
  fields          JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
