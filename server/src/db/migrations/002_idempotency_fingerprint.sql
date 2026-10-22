-- An idempotency key may only replay the submission it was first used for.
-- The fingerprint is SHA-256 over the filing content (title, description, category, priority, attachment hashes).
-- Reusing a key with a different submission is rejected (409) instead of silently dropping the new complaint
-- or revealing the existing ticket. Rows created before this migration have NULL; their keys fail closed
-- (any reuse is rejected with 409) because their original content cannot be reconstructed reliably.
ALTER TABLE tickets ADD COLUMN idempotency_fingerprint TEXT;
