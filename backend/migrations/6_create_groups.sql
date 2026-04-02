-- Migration 6: Group RBAC — groups, group_members, document_groups

CREATE TABLE groups (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE document_groups (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES groups(id)    ON DELETE CASCADE,
  PRIMARY KEY (document_id, group_id)
);

CREATE INDEX idx_group_members_user    ON group_members(user_id);
CREATE INDEX idx_document_groups_group ON document_groups(group_id);
