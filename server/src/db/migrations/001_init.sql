-- Open Case schema. Applied by `npm run migrate` (see src/db/migrate.js).

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email         TEXT        NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL CHECK (role IN ('STUDENT', 'GRIEVANCE_OFFICER', 'ADMINISTRATOR')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------- SLA rules (priority -> hours)
CREATE TABLE escalation_rules (
  id        SMALLSERIAL PRIMARY KEY,
  priority  TEXT NOT NULL UNIQUE CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  sla_hours INTEGER NOT NULL CHECK (sla_hours > 0)
);

INSERT INTO escalation_rules (priority, sla_hours) VALUES
  ('LOW', 168), ('MEDIUM', 72), ('HIGH', 24), ('CRITICAL', 8);

-- ---------------------------------------------------------------- tickets
CREATE TABLE tickets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description        TEXT        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
  category           TEXT        NOT NULL,
  priority           TEXT        NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status             TEXT        NOT NULL CHECK (status IN ('FILED', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'ESCALATED')),
  version            INTEGER     NOT NULL DEFAULT 1,
  is_anonymous       BOOLEAN     NOT NULL DEFAULT FALSE,
  receipt_token_hash TEXT        UNIQUE,
  created_by         UUID        REFERENCES users (id),
  assigned_to        UUID        REFERENCES users (id),
  idempotency_key    TEXT,
  original_due_at    TIMESTAMPTZ NOT NULL, -- SLA deadline at filing; never changes (used for compliance stats)
  due_at             TIMESTAMPTZ NOT NULL, -- working deadline; renewed when an administrator takes an escalated case
  resolved_at        TIMESTAMPTZ,
  resolution_note    TEXT,
  escalated_at       TIMESTAMPTZ,
  escalation_reason  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Anonymity is a property of the data model: an anonymous ticket CANNOT carry a creator account.
  CONSTRAINT tickets_anonymity_chk CHECK (
    (is_anonymous AND created_by IS NULL AND receipt_token_hash IS NOT NULL)
    OR (NOT is_anonymous AND created_by IS NOT NULL AND receipt_token_hash IS NULL)
  )
);

-- Idempotent creation: one ticket per (requester, key). Anonymous requesters have no account, so the key is global for them.
CREATE UNIQUE INDEX tickets_idem_user_uq ON tickets (created_by, idempotency_key)
  WHERE created_by IS NOT NULL AND idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX tickets_idem_anon_uq ON tickets (idempotency_key)
  WHERE is_anonymous AND idempotency_key IS NOT NULL;

-- Deadline job: unresolved tickets past due.
CREATE INDEX tickets_status_due_idx ON tickets (status, due_at);
CREATE INDEX tickets_created_by_idx ON tickets (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX tickets_assigned_to_idx ON tickets (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX tickets_created_at_idx ON tickets (created_at);

-- ---------------------------------------------------------------- comments (immutable: no update/delete routes)
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES tickets (id),
  author_type TEXT        NOT NULL CHECK (author_type IN ('USER', 'ANON_PETITIONER')),
  author_id   UUID        REFERENCES users (id),
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comments_author_chk CHECK ((author_type = 'USER') = (author_id IS NOT NULL))
);
CREATE INDEX comments_ticket_idx ON comments (ticket_id, created_at);

-- ---------------------------------------------------------------- attachments (files live on disk, hashes here and in the audit trail)
CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES tickets (id),
  file_name   TEXT        NOT NULL,
  stored_name TEXT        NOT NULL UNIQUE,
  mime_type   TEXT        NOT NULL,
  size_bytes  BIGINT      NOT NULL CHECK (size_bytes >= 0),
  sha256      TEXT        NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX attachments_ticket_idx ON attachments (ticket_id);

-- ---------------------------------------------------------------- audit events (per-ticket SHA-256 hash chain)
CREATE TABLE audit_events (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   UUID    NOT NULL REFERENCES tickets (id),
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 1),
  actor_type  TEXT    NOT NULL CHECK (actor_type IN ('USER', 'ANON_PETITIONER', 'SYSTEM')),
  actor_id    UUID    REFERENCES users (id),
  action      TEXT    NOT NULL,
  payload     TEXT    NOT NULL, -- canonical JSON string, exactly as hashed
  occurred_at TEXT    NOT NULL, -- millisecond UTC string (ISO 8601), exactly as hashed
  prev_hash   TEXT,             -- NULL for the first event of a ticket
  event_hash  TEXT    NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT audit_actor_chk CHECK ((actor_type = 'USER') = (actor_id IS NOT NULL)),
  CONSTRAINT audit_prev_chk CHECK ((sequence_no = 1) = (prev_hash IS NULL)),
  -- Backstop: even if row locking were bypassed, two events can never share a position.
  CONSTRAINT audit_ticket_seq_uq UNIQUE (ticket_id, sequence_no)
);

-- Append-only: ordinary UPDATE / DELETE / TRUNCATE are rejected by the database itself.
CREATE FUNCTION audit_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (% rejected)', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();

-- ---------------------------------------------------------------- notifications (signed-in users only)
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users (id),
  ticket_id  UUID        NOT NULL REFERENCES tickets (id),
  message    TEXT        NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------- sessions (connect-pg-simple)
CREATE TABLE session (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_session_expire ON session (expire);
