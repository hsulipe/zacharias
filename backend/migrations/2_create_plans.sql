-- Migration: Create plans table

CREATE TABLE plans (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  max_docs        INTEGER,          -- NULL = unlimited
  max_storage_gb  INTEGER,          -- NULL = unlimited
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (name, max_docs, max_storage_gb, price) VALUES
  ('Free',       100,  5,    0.00),
  ('Pro',        5000, 50,   49.90),
  ('Enterprise', NULL, NULL, 299.90);

-- Link users to plans (FK added after plans table exists)
ALTER TABLE users ADD CONSTRAINT fk_users_plan
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
