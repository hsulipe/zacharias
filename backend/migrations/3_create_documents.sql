-- Migration: Create documents table

CREATE TYPE ocr_status AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TABLE documents (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(500) NOT NULL,
  filename        VARCHAR(500) NOT NULL,
  storage_key     VARCHAR(1000) NOT NULL UNIQUE,
  mime_type       VARCHAR(100) NOT NULL,
  size            BIGINT       NOT NULL,
  uploader_id     UUID         NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  is_searchable   BOOLEAN      NOT NULL DEFAULT FALSE,
  ocr_status      ocr_status   NOT NULL DEFAULT 'pending',
  ocr_text        TEXT,
  ocr_text_vector TSVECTOR,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_documents_uploader  ON documents(uploader_id);
CREATE INDEX idx_documents_expires   ON documents(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documents_deleted   ON documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_ocr_vec   ON documents USING GIN(ocr_text_vector);
CREATE INDEX idx_documents_title_vec ON documents USING GIN(to_tsvector('portuguese', title));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
