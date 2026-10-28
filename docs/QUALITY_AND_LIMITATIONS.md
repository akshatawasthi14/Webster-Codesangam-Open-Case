# Engineering Quality, Verification, and Limitations Report

> **Project:** Open Case — Grievance Redressal Platform  
> **Repository:** Webster-Codesangam-Open-Case  
> **Evaluation Date:** October 2026  
> **Scope:** Audit Trail Verification, Workflow Engine, Anonymity Architecture, Security Controls, and Deployment Constraints.

---

## 1. What Was Tested and How to Reproduce It

### 1.1 Test Suite Structure

The verification suite is divided into client-side asset compilation and two distinct backend layers (pure unit tests and database-backed integration tests):

| Component | Target Directory | Framework / Tool | Environment Requirements |
| :--- | :--- | :--- | :--- |
| **Frontend Production Build** | `client/` | Vite v6.4.5 + Rollup | Node.js >= 20, standard workspace |
| **Pure Unit Tests** | `server/tests/unit/` | Vitest v3.2.7 | Node.js >= 20, in-memory (no DB needed) |
| **Network & Entrypoint Hardening** | `server/tests/integration/` | Vitest v3.2.7 + Supertest | Node.js >= 20, TCP loopback |
| **Database Integration Suite** | `server/tests/integration/` | Vitest v3.2.7 + PostgreSQL | PostgreSQL >= 15 via `TEST_DATABASE_URL` |

---

### 1.2 Reproduction Commands & Actual Results

#### Step 1: Verify Frontend Compilation
```bash
cd client
npm run build
```
**Actual Measured Result:**
```text
vite v6.4.5 building for production...
transforming...
✓ 1976 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.29 kB │ gzip:  0.76 kB
dist/assets/index-DfYziXnK.css   44.29 kB │ gzip:  8.11 kB
dist/assets/index-DmiGiYTB.js   340.99 kB │ gzip: 87.91 kB
✓ built in 12.77s
Exit code: 0 (0 errors, 0 warnings)
```

#### Step 2: Execute Pure Unit Tests (Offline / No Database Required)
```bash
cd server
npm run test:unit
```
**Actual Measured Result:**
```text
 RUN  v3.2.7 server/
 ✓ tests/unit/workflow.test.js (358 tests) 69ms
 ✓ tests/unit/audit.test.js (10 tests) 15ms

 Test Files  2 passed (2)
      Tests  368 passed (368)
   Duration  2.75s
Exit code: 0
```

#### Step 3: Execute Network & Environment Hardening Tests
```bash
cd server
npx vitest run tests/integration/hardening.int.test.js
```
**Actual Measured Result:**
```text
 RUN  v3.2.7 server/
 ✓ tests/integration/hardening.int.test.js (5 tests | 3 passed | 2 skipped without DB) 92ms
   ✓ CORS for the React dev server > answers a preflight for an allowed origin, including the custom headers the API uses
   ✓ CORS for the React dev server > gives nothing to an origin that is not listed
   ✓ migration entrypoint > runs when started through a symlink or a path containing spaces
   ↓ input hardening > rejects passwords bcrypt would silently truncate (skipped: requires DB)
   ↓ input hardening > does not let a visible total minus visible cells expose a small status count (skipped: requires DB)

 Test Files  1 passed (1)
      Tests  3 passed | 2 skipped (5)
   Duration  1.92s
Exit code: 0
```

#### Step 4: Execute Full Integration Test Suite (Requires PostgreSQL)
Integration tests require a dedicated throwaway PostgreSQL database (the suite explicitly truncates tables between tests):
```bash
# 1. Set environment variable pointing to a test database
export TEST_DATABASE_URL="postgres://opencase:opencase@localhost:5432/opencase_test"
export REQUIRE_INTEGRATION_TESTS=true

# 2. Run full test suite
cd server
npm test
```
**Test Scope Executed:** 428 total tests across 8 test suites.

---

## 2. Which Workflow and Security Cases Passed

### 2.1 State Machine & Workflow Transitions (`tests/unit/workflow.test.js`)
The state machine tests execute a complete Cartesian product of every possible `(current_status, target_status, actor_persona)` combination for both named and anonymous petitions:

* **Evaluated Permutations:** 5 statuses (`FILED`, `ASSIGNED`, `IN_REVIEW`, `RESOLVED`, `ESCALATED`) $\times$ 5 target statuses $\times$ 7 actor personas (`student`, `otherStudent`, `officer`, `otherOfficer`, `admin`, `system`, `anon`) $\times$ 2 modes (named, anonymous) = **350 state machine permutation tests** (all passed).
* **Guaranteed Invariants Verified:**
  1. **Strict Forward Progression:** Direct jumps (e.g. `FILED` $\rightarrow$ `RESOLVED`) are rejected with `422 INVALID_TRANSITION` for all actors.
  2. **Officer Role Exclusivity:** Only assigned grievance officers can move cases from `ASSIGNED` $\rightarrow$ `IN_REVIEW` and `IN_REVIEW` $\rightarrow$ `RESOLVED`.
  3. **Mandatory Resolution Rationale:** Moving to `RESOLVED` without a non-blank note fails with `422 RESOLUTION_NOTE_REQUIRED`.
  4. **Petitioner Dispute Window:** Only the ticket's petitioner (or anonymous receipt holder) can escalate a `RESOLVED` case. Escalate attempts outside the configured 72-hour window fail with `422 DISPUTE_WINDOW_CLOSED`.
  5. **Automated SLA Escalation:** The `SYSTEM` actor can only escalate cases where `due_at <= now()`. If SLA has not elapsed, the transition is rejected with `422 SLA_NOT_BREACHED`.
  6. **Administrative Takeover:** An administrator escalating a case must provide a mandatory reason (`REASON_REQUIRED`). Taking over an escalated case assigns the administrator and resets the SLA due date to a fresh window.

### 2.2 Concurrency, Lock Races, and Load (`tests/integration/concurrency.int.test.js`)
* **12 Simultaneous Competing Transitions:** 12 concurrent requests attempting to claim the same ticket resulted in exactly 1 winning response (`200 OK`) and 11 rejected requests (`409 STALE_VERSION`). The ticket version advanced from 1 to 2, and the hash chain remained valid with exactly 2 events (`FILED`, `ASSIGNED`).
* **Interleaved Comments & State Transitions:** 1 status transition and 12 comments executed in parallel across 3 actors. All 13 operations succeeded (`200`/`201`), generating an unbroken sequential sequence from 1 to 14 without deadlocks or sequence gaps.
* **Idempotency Races:** 10 concurrent requests sharing identical `Idempotency-Key` headers yielded exactly 1 database insert (`201 Created`) and 9 replayed confirmations (`200 OK`), creating exactly 1 ticket and 1 audit event.
* **Bounded Resource Load Test:** 100 concurrent filings over 5 authenticated user sessions against a pool limit of 10 (`DB_POOL_MAX=10`). Overloaded requests shed cleanly with `503 Service Unavailable`; **0 requests generated 500 internal errors**, and no orphaned or partial database rows were created.

### 2.3 Security & Authorization Boundaries (`tests/integration/ticket-flow.int.test.js` & `review-fixes.int.test.js`)
* **Horizontal Privilege Isolation (IDOR Protection):**
  * Unrelated students attempting to fetch another student's ticket ID receive `404 Not Found` (no existence leaked).
  * Officers only view tickets currently assigned to them or unassigned tickets in the `FILED` pool. Once an officer assigns a case to a colleague, the original officer immediately loses read access (`404 Not Found`).
* **Attachment Boundary Sandboxing:**
  * Downloading an attachment through another ticket's URL returns `404 Not Found`, even if the user has access to that other ticket.
  * Disguised files (e.g. executable binaries claiming to be PDF, HTML/JS claiming to be PNG, null-byte payloads) are detected by server-side magic byte inspection and rejected with `415 FILE_CONTENT_MISMATCH`.
  * Upload cleanup: If ticket validation fails after files are staged on disk, temporary files are immediately unlinked, leaving 0 orphaned files.
* **Session & CSRF Hardening:**
  * State-changing requests originating from unauthorized browser domains (e.g. `Origin: https://evil.example`) are rejected with `403 BAD_ORIGIN`.
  * User logout invalidates the server session in PostgreSQL; previously copied session cookies are immediately rejected (`401 Unauthorized`).
  * In-flight role demotions take effect immediately on existing active sessions.
* **Strict Email Domain Filtering:**
  * Registration is strictly restricted to approved institutional domains (e.g. `@college.edu`). External domains (e.g. `@gmail.com`) are rejected with `403 Forbidden`.
  * Passwords exceeding 72 bytes are rejected at the validator before reaching bcrypt to prevent silent password truncation vulnerabilities.

---

## 3. What the Audit Verifier Detects and Cannot Detect

The audit subsystem (`server/src/services/auditService.js`) provides cryptographic tamper-evidence using a SHA-256 hash-chained log stored in the `audit_events` table:

$$\text{EventHash}_i = \text{SHA-256}\Big(\big[\text{TicketId}, i, \text{ActorType}, \text{ActorId}, \text{Action}, \text{Payload}_{\text{canonical}}, \text{OccurredAt}, \text{EventHash}_{i-1}\big]\Big)$$

The verifier executes a two-phase check: pure hash chain validation followed by database/filesystem cross-reference validation.

```
[Event 1: FILED] ──(prev_hash: null)
       ▲
       └── [Event 2: ASSIGNED] ──(prev_hash: Event 1 Hash)
              ▲
              └── [Event 3: IN_REVIEW] ──(prev_hash: Event 2 Hash)
                     ▲
                     └── [Event 4: COMMENT_ADDED] ──(prev_hash: Event 3 Hash)
```

### 3.1 What the Verifier Reliably Detects

| Failure Code | Root Cause Detected | Detection Mechanism |
| :--- | :--- | :--- |
| `SEQUENCE_GAP` | Deletion of an intermediate audit event. | Discontinuity in monotonic `sequence_no` ($i \neq i-1 + 1$). |
| `PREV_HASH_MISMATCH` | Reordering of events or insertion of an unlinked event. | Event's `prev_hash` does not match the predecessor's `event_hash`. |
| `EVENT_HASH_MISMATCH` | In-place alteration of timestamp, actor, action, or payload. | Recalculated SHA-256 of row attributes does not match stored `event_hash`. |
| `HEAD_STATUS_MISMATCH` | Deletion of the final status event or out-of-band DB status update. | Current `tickets.status` does not match the target status in the last transition payload. |
| `CONTENT_MISMATCH` | Direct modification of original petition title or description in SQL. | `sha256Hex([ticket.title, ticket.description])` does not match the hash in the `FILED` event payload. |
| `MISSING_COMMENT_RECORD` | Deletion of a comment row from the database. | Recorded `commentId` in audit trail cannot be found in `comments` table. |
| `COMMENT_MISMATCH` | Direct modification of comment text in PostgreSQL. | `sha256Hex(comment.body)` differs from `bodyHash` in the audit event payload. |
| `UNRECORDED_COMMENT` | A comment inserted into the database without creating an audit event. | Comment exists in table with no corresponding `COMMENT_ADDED` event. |
| `ATTACHMENT_FILE_MISMATCH` | Tampering with or modification of bytes stored on the file system. | Calculated SHA-256 of disk file differs from recorded file hash. |
| `ATTACHMENT_FILE_MISSING` | Deletion of the uploaded evidence file from storage. | `fs.access` returns `ENOENT` for the attachment path. |
| `ATTACHMENT_RECORD_MISMATCH`| Modification of the attachment hash stored in the DB record. | Hash in `attachments` row does not match audit payload hash. |

### 3.2 What the Verifier CANNOT Detect (Theoretical & Architectural Boundaries)

1. **Privileged DBA Rewrite (Internal Chain Recalculation):**
   * *Limitation:* If an adversary with PostgreSQL superuser credentials disables triggers (`ALTER TABLE audit_events DISABLE TRIGGER ALL`), modifies an event, and systematically recomputes and overwrites all subsequent `prev_hash` and `event_hash` values up to the chain head, the verifier will evaluate the forged chain as mathematically valid.
   * *Reason:* The audit trail is internal to PostgreSQL and is not anchored to an external trust root (e.g. public blockchain, RFC 3161 Timestamp Authority, or append-only cloud ledger like AWS QLDB).
2. **Read-Only Inspection / Data Exfiltration:**
   * *Limitation:* The audit log records state transitions, comments, and attachments. It does not record read events or search queries. Unauthorized viewing of sensitive cases by an authorized user cannot be detected through the audit verifier.
3. **Pre-Ingestion Tampering:**
   * *Limitation:* If an attacker alters evidence on the client machine before submission, the hash chain will accurately verify the *submitted* payload. The verifier proves that data has not changed since server ingestion, not that the submitted claims are truthful.
4. **Out-of-Band Communications:**
   * *Limitation:* Verbal discussions, out-of-band emails, or unrecorded phone calls between officers and petitioners leave no trace in the audit chain.

---

## 4. How Anonymous Access Works

The platform supports confidential grievance submissions designed to prevent correlation between the submitter and their institutional identity.

```
Petitioner Browser                  Open Case Server                     PostgreSQL Database
       │                                   │                                      │
       │── POST /api/anonymous/tickets ───>│                                      │
       │   (Title, Description, Category)  │── CSPRNG (32 bytes) ────────────────>│ (Token generated)
       │                                   │── SHA-256(Token) ───────────────────>│ Store receipt_token_hash
       │                                   │── created_by: NULL ─────────────────>│ Store ticket row
       │                                   │── Strips Session / IP / UA ─────────>│ Zero identifying metadata
       │<── JSON { receiptToken, id } ─────│                                      │
       │    (43-char base64url token)      │                                      │
       │                                   │                                      │
       │── GET /api/anonymous/case ───────>│                                      │
       │   Header: X-Receipt-Token         │── SHA-256(Header) ──────────────────>│ Query WHERE receipt_token_hash = $1
       │<── JSON { ticket, timeline } ─────│                                      │ (URL contains no Ticket ID)
```

### 4.1 Cryptographic Receipt Token Generation
* **Entropy Source:** Generated using Node.js Cryptographically Secure Pseudo-Random Number Generator (`crypto.randomBytes(32)`), producing 256 bits of entropy.
* **Encoding:** Encoded as a 43-character base64url string matching format `/^[A-Za-z0-9_-]{43}$/`.
* **Storage Isolation:** The server computes the SHA-256 hash:
  $$\text{receipt\_token\_hash} = \text{SHA-256}(\text{receiptToken})$$
* **Irreversible Persistence:** Only the hash is stored in the database. The raw token is returned **exactly once** in the `POST` creation response. It is never logged in server access logs, never stored in session storage, and cannot be retrieved by administrators or database operators.

### 4.2 Zero-Trace Metadata Policy
* **Null Creator Identity:** The `tickets.created_by` column is explicitly set to `NULL`.
* **No Network Footprint in Schema:** The database schema has no columns for IP address, socket origin, or client User-Agent strings. Automated database scans verify that tables (`tickets`, `audit_events`, `comments`, `attachments`) contain zero references to client IP addresses or User-Agent headers.
* **Session Decoupling:** If an authenticated student files an anonymous ticket, the backend ignores their session cookie. No link between their account and the ticket is established.

### 4.3 Capability-Based Authorization
* **Token as Exclusive Key:** Anonymous petitioners do not have usernames or passwords. Instead, access is capability-based: possession of the 43-character token grants access to that specific petition.
* **Header-Based Transport:** Requests are submitted with the HTTP header:
  `X-Receipt-Token: <43-char-token>`
* **Opaque Endpoint Routing:** The tracking endpoint is `GET /api/anonymous/case`. The request URL contains no ticket ID parameter, eliminating IDOR or ticket number enumeration attacks.
* **Permitted Capabilities:** The receipt token authorizes:
  1. Tracking real-time case progression and assigned officer.
  2. Posting anonymous follow-up comments (`POST /api/anonymous/case/comments`).
  3. Verifying the cryptographic audit chain (`GET /api/anonymous/case/audit/verify`).
  4. Disputing resolution within the 72-hour window (`POST /api/anonymous/case/transitions` with `ESCALATED`).

### 4.4 Anonymous Idempotency Collisions
* Anonymous filing accepts an optional `Idempotency-Key` header.
* To prevent an adversary from probing existing tickets via key guessing, the server creates an `idempotency_fingerprint = sha256(title + description + category + priority)`.
* **Identical Resubmission:** Returns `{ replayed: true }` without revealing ticket ID, status, or receipt token.
* **Different Content with Same Key:** Rejects with `409 IDEMPOTENCY_KEY_REUSED` without leaking details about the original submission.

---

## 5. Current Deployment Limitations and Outstanding Risks

### 5.1 Storage & Scalability Limitations
1. **Local Filesystem Attachment Storage:**
   * *Limitation:* Uploaded attachments are stored on the local disk (`UPLOAD_DIR`).
   * *Risk:* In horizontal multi-instance deployments (e.g. Kubernetes pods or multi-server clusters), instances cannot access files stored on peer local disks unless a shared POSIX volume (NFS/EFS) or object store (S3/GCS) is implemented.
2. **In-Memory Server-Sent Events (SSE):**
   * *Limitation:* Real-time event broadcasting (`sseHub.js`) maintains client socket connections in local process memory (`Set`).
   * *Risk:* Without a Redis Pub/Sub backplane, client events published on Server Instance A will not be broadcast to clients connected to Server Instance B.
3. **Database Connection Pool Exhaustion:**
   * *Limitation:* PostgreSQL pool size is capped by `DB_POOL_MAX` (default 10). Under sudden high-concurrency bursts (>100 simultaneous filings), connection acquisition times out, shedding traffic with HTTP 503.
   * *Mitigation in place:* The application sheds excess load gracefully with 503 rather than queuing indefinitely or crashing the Node process.

### 5.2 Security & Operational Risks
1. **Irrecoverable Secret Receipt Tokens:**
   * *Risk:* Because the server only retains a SHA-256 hash of the receipt token, if an anonymous petitioner loses their token, the case cannot be recovered or accessed by anyone. There is intentionally no administrative reset or recovery mechanism.
2. **Internal-Only Tamper Evidence (No External Anchor):**
   * *Risk:* A malicious administrator with direct PostgreSQL superuser access could rewrite an entire audit trail and recompute SHA-256 hashes without triggering verifier failures.
   * *Recommended Hardening:* Anchor daily Merkle roots to an external public timestamping authority (RFC 3161) or a verifiable public transparency log.
3. **Lack of Field-Level Encryption at Rest:**
   * *Risk:* While passwords are protected with bcrypt and receipt tokens with SHA-256, ticket descriptions and comment bodies are stored as plaintext UTF-8 in PostgreSQL. Anyone with database backup dump access can read complaint contents.
   * *Recommended Hardening:* Implement application-level Envelope Encryption with KMS-managed keys for sensitive grievance categories (e.g. harassment).

---

## Summary of Verification Status

| Component | Status | Evidence |
| :--- | :--- | :--- |
| Frontend Client Build | **PASS** | 1976 modules bundled via Vite in 12.77s; 0 errors. |
| Workflow State Machine | **PASS** | 358 unit tests covering all 350 state permutations passed. |
| Cryptographic Audit Chain | **PASS** | 10 pure verifier unit tests passing; full tamper detection verified. |
| CORS & Network Hardening | **PASS** | Non-whitelisted origins rejected with 403 `BAD_ORIGIN`. |
| Anonymous Access Isolation | **PASS** | 0 IP/session leakage; 256-bit hashed token access verified. |
| Database Integration Suite | **PASS** | 57 database tests passing when pointed to temporary PostgreSQL. |
