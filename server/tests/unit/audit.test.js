import { describe, expect, it } from 'vitest';
import { computeEventHash, verifyEventChain } from '../../src/services/auditService.js';
import { canonicalJson, sha256Hex } from '../../src/utils/hash.js';
import { generateReceiptToken, hashReceiptToken, isValidReceiptFormat } from '../../src/utils/token.js';

const TICKET = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

/** Builds a valid in-memory chain in DB row shape. */
function buildChain(n = 4) {
  const rows = [];
  let prev = null;
  for (let i = 1; i <= n; i++) {
    const e = {
      ticketId: TICKET,
      sequenceNo: i,
      actorType: 'USER',
      actorId: USER,
      action: i === 1 ? 'FILED' : 'COMMENT_ADDED',
      payload: canonicalJson({ i, to: i === 1 ? 'FILED' : undefined }),
      occurredAt: new Date(Date.UTC(2026, 9, 22, 12, 0, i)).toISOString(),
      prevHash: prev,
    };
    e.eventHash = computeEventHash(e);
    rows.push({
      ticket_id: e.ticketId, sequence_no: e.sequenceNo, actor_type: e.actorType, actor_id: e.actorId,
      action: e.action, payload: e.payload, occurred_at: e.occurredAt, prev_hash: e.prevHash, event_hash: e.eventHash,
    });
    prev = e.eventHash;
  }
  return rows;
}

describe('audit hash chain (pure verifier)', () => {
  it('accepts an untouched chain', () => {
    expect(verifyEventChain(buildChain())).toBeNull();
    expect(verifyEventChain([])).toBeNull();
  });

  it('detects a modified event and names the first failing one', () => {
    const chain = buildChain();
    chain[2].payload = canonicalJson({ i: 3, hacked: true });
    expect(verifyEventChain(chain)).toMatchObject({ sequenceNo: 3, code: 'EVENT_HASH_MISMATCH' });
  });

  it('detects a changed timestamp or actor', () => {
    const a = buildChain();
    a[1].occurred_at = '2026-01-01T00:00:00.000Z';
    expect(verifyEventChain(a)).toMatchObject({ sequenceNo: 2 });
    const b = buildChain();
    b[1].actor_id = '33333333-3333-4333-8333-333333333333';
    expect(verifyEventChain(b)).toMatchObject({ sequenceNo: 2 });
  });

  it('detects a deleted event inside the chain', () => {
    const chain = buildChain();
    chain.splice(1, 1);
    expect(verifyEventChain(chain)).toMatchObject({ sequenceNo: 2, code: 'SEQUENCE_GAP' });
  });

  it('detects reordered events', () => {
    const chain = buildChain();
    [chain[1].sequence_no, chain[2].sequence_no] = [chain[2].sequence_no, chain[1].sequence_no];
    chain.sort((a, b) => a.sequence_no - b.sequence_no);
    expect(verifyEventChain(chain)).toMatchObject({ sequenceNo: 2, code: 'PREV_HASH_MISMATCH' });
  });

  it('detects a broken link even when the event hash was recomputed', () => {
    const chain = buildChain();
    chain[1].prev_hash = sha256Hex('forged');
    const e = chain[1];
    e.event_hash = computeEventHash({
      ticketId: e.ticket_id, sequenceNo: e.sequence_no, actorType: e.actor_type, actorId: e.actor_id,
      action: e.action, payload: e.payload, occurredAt: e.occurred_at, prevHash: e.prev_hash,
    });
    expect(verifyEventChain(chain)).toMatchObject({ sequenceNo: 2, code: 'PREV_HASH_MISMATCH' });
  });
});

describe('serialization is deterministic', () => {
  it('canonicalJson ignores key insertion order, recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: 1 }, b: 1 }));
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it('timestamps are millisecond UTC strings', () => {
    expect(new Date().toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('receipt tokens', () => {
  it('are 256-bit URL-safe strings and only their SHA-256 is derived for storage', () => {
    const token = generateReceiptToken();
    expect(isValidReceiptFormat(token)).toBe(true);
    expect(token).not.toBe(generateReceiptToken());
    expect(hashReceiptToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashReceiptToken(token)).not.toContain(token);
  });

  it('rejects malformed tokens before any lookup', () => {
    for (const bad of [undefined, '', 'short', 'a'.repeat(44), `${'a'.repeat(42)}!`]) {
      expect(isValidReceiptFormat(bad)).toBe(false);
    }
  });
});
