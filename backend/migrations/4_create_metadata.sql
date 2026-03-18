-- Migration: Create document_metadata table

CREATE TABLE document_metadata (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  key          VARCHAR(100) NOT NULL,
  value        TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT   uq_doc_meta UNIQUE (document_id, key)
);

CREATE INDEX idx_metadata_document ON document_metadata(document_id);
CREATE INDEX idx_metadata_key      ON document_metadata(key);
CREATE INDEX idx_metadata_value_vec ON document_metadata USING GIN(to_tsvector('portuguese', value));
