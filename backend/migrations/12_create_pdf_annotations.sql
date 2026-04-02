-- Migration 12: PDF annotations

CREATE TYPE annotation_type AS ENUM ('highlight', 'comment');

CREATE TABLE pdf_annotations (
  id            UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID            NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID            REFERENCES users(id) ON DELETE SET NULL,
  page          INTEGER         NOT NULL,
  type          annotation_type NOT NULL,
  rect          JSONB           NOT NULL,
  selected_text TEXT,
  content       TEXT,
  color         VARCHAR(7)      NOT NULL DEFAULT '#FBBF24',
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_annotations_document ON pdf_annotations(document_id);
