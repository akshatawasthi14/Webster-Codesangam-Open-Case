# Open Case

**A grievance redressal platform where every case is traceable, every deadline is enforced, and every action leaves a verifiable record.**

*Webster 2026 · Team Strange Loop (ID 28) · Problem E3: The Vishanti Petition*

---

## Overview

Grievance handling in large institutions tends to fail in the gaps between systems. A complaint starts as an email, continues as a form, and is resolved or abandoned in a conversation nobody recorded. The person who raised it cannot see where it stands, the person responsible has no enforced deadline, and when a dispute arises there is no reliable account of what happened.

Open Case replaces that patchwork with a single platform built around three guarantees:

1. **Traceability.** Every grievance has its own case page, a defined lifecycle, and notifications at each step.
2. **Enforcement.** The workflow, permissions, and SLA deadlines are enforced by the server, not by convention or by the interface.
3. **Verifiability.** Every significant action is committed to a cryptographic audit chain that authorized users can check at any time.

It is designed with equal attention to the people who need to report safely. Students can file anonymously, and the system is built so that anonymity is a property of the data model rather than a promise in the policy text.

## Highlights

- **Anonymous reporting by construction.** Anonymous tickets have no link to a user account. Access is through a securely generated receipt token, of which only the SHA-256 hash is stored. No IP address or user-agent string is recorded for these submissions.
- **A workflow the client cannot bypass.** A server-side transition table and role guards decide every status change. A direct API call cannot move a ticket from `FILED` to `RESOLVED`.
- **History that cannot change silently.** Each ticket carries a SHA-256 hash chain. Editing, deleting, or reordering a recorded event breaks verification, and the verifier reports the first event that fails.
- **Deadlines that act on their own.** A scheduled job escalates overdue tickets through the same validated transition logic that human users go through, and records the escalation in the audit trail.
- **Consistency under pressure.** Ticket updates, audit events, and notifications commit in one transaction. Concurrent changes to the same ticket are serialized, and stale requests receive `409 Conflict`.
- **Public accountability without exposure.** A transparency dashboard publishes resolution times, SLA compliance, and category trends, with small counts suppressed so individual cases cannot be picked out.

## Roles

| Role | Capabilities |
| --- | --- |
| **Student (petitioner)** | File grievances (named or anonymous), track cases, comment, dispute a resolution within the dispute window |
| **Grievance Officer** | Review assigned cases, add comments and supporting information, resolve with a mandatory note |
| **Administrator** | Assign tickets, handle escalated cases, escalate with a recorded reason, verify audit chains |
| **Anonymous petitioner** | Access and track a single case with a receipt token; no account exists |

## Case Lifecycle

```
 FILED ──► ASSIGNED ──► IN_REVIEW ──► RESOLVED
   │           │            │             │
   └───────────┴────────────┘             │  petitioner disputes
        SLA breach or admin               │  (within window, with reason)
                 ▼                        ▼
              ESCALATED ◄─────────────────┘
                 │
                 └──► IN_REVIEW   (administrator takes responsibility)
```

| Transition | Permitted actor | Condition |
| --- | --- | --- |
| FILED → ASSIGNED | Grievance officer or administrator | |
| ASSIGNED → IN_REVIEW | Assigned officer | |
| IN_REVIEW → RESOLVED | Assigned officer | Resolution note required |
| RESOLVED → ESCALATED | Petitioner (account or receipt token) | Within dispute window, with a reason |
| FILED / ASSIGNED / IN_REVIEW → ESCALATED | System on SLA breach, or administrator | Administrator records a reason |
| ESCALATED → IN_REVIEW | Administrator | After taking responsibility |

Every other transition is rejected by the server. SLA deadlines are derived from ticket priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) through a configurable rule table.

## The Audit Trail

Each ticket has its own hash chain. Every event records the ticket, a sequence number, the actor type (`USER`, `ANON_PETITIONER`, or `SYSTEM`), an optional actor ID, the action, its payload, a UTC timestamp, the previous event's hash, and its own hash.

```
 Event 1                 Event 2                 Event 3
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ seq: 1       │        │ seq: 2       │        │ seq: 3       │
│ action: FILED│        │ action:      │        │ action:      │
│ prevHash: –  │   ┌───►│  ASSIGNED    │   ┌───►│  IN_REVIEW   │
│ eventHash: A │───┘    │ prevHash: A  │───┘    │ prevHash: B  │
└──────────────┘        │ eventHash: B │        │ eventHash: C │
                        └──────────────┘        └──────────────┘
```

Each event hash is a SHA-256 digest over the event's canonical fields, including the previous hash. Altering any retained event changes its hash and breaks every link after it.

**How verification works.** The verifier walks the chain in order. It checks that sequence numbers are continuous, recomputes each event hash from its stored fields, confirms each previous-hash link, and reports the first failing event. Attachment events include the file's SHA-256 hash, so uploaded evidence is covered as well.

**Engineering details that make it reliable:**

- **Canonical serialization.** The exact fields and order used to compute a hash are the same ones used to verify it. Timestamps are stored as millisecond UTC strings and payloads are serialized consistently, so formatting differences cannot cause false failures.
- **Per-ticket ordering.** Because the ticket row is locked during every change, events for one ticket are appended in a strict order, with a unique index on `(ticket_id, sequence_no)` as a backstop.
- **Append-only enforcement.** A database trigger rejects ordinary updates and deletes on the audit table.

**What this proves, and what it does not.**

| The audit chain can | The audit chain cannot |
| --- | --- |
| Detect a modified, deleted, or reordered event within a retained chain | Stop a database administrator with sufficient privileges from rewriting an entire chain and recomputing every hash |
| Pinpoint the first event where history diverges | Independently prove the absence of every possible database-level alteration |
| Cover attachments through recorded file hashes | Replace external anchoring such as signatures or published checkpoints |

Open Case claims **tamper-evidence, not tamper-proofing**. Digital signatures with an externally held key and published ledger checkpoints are the natural next step and are listed in the roadmap.

## Privacy Model

**Anonymous reporting**
- The ticket is created without a creator-account association.
- A securely generated receipt token is shown once to the petitioner. Only its hash is stored.
- No IP address or user-agent string is stored for anonymous submissions.
- Notifications are for signed-in users; anonymous petitioners follow their case through the receipt-token page.

**Public transparency**
- Statistics are aggregated in SQL and cached briefly in memory, so traffic spikes do not become database load.
- Small counts are suppressed so that a category with very few cases cannot identify an individual.

## Architecture

```
Browser (React app, built by Vite)
      │  HTTPS
      ▼
Web server / gateway
  static build with long-lived caching · compression · request-size limits
      │
      ▼
Express API (single instance)
  security headers → rate limiting → session → validation → permissions
      │
      ├──► PostgreSQL
      │      users · tickets · comments · audit events · notifications · sessions · SLA rules
      └──► File storage
             attachments, with SHA-256 recorded in the audit trail
```

There are no third-party services in the core flow: no external AI API, and no email dependency, because notifications are delivered in-app.

### Anatomy of a single action

An officer resolves a ticket:

1. The browser sends an authenticated request with the target status and the ticket version.
2. Middleware applies security headers, rate limits, session checks, and request validation.
3. The server checks permissions and validates the transition against the state machine.
4. A transaction locks the ticket row and confirms its current status, assignee, and version.
5. The ticket is updated, the hash-chained audit event is inserted, and notification records are stored, all in the same transaction.
6. The transaction commits, and only then is success returned. Any failure rolls everything back.
7. Connected users receive the update over Server-Sent Events. Offline users find it in their stored notifications.

### Concurrency and resilience

| Concern | Approach |
| --- | --- |
| Many users acting at once | Locks are per ticket. Different tickets proceed independently; the same ticket is serialized. |
| Stale or competing updates | Version check under a row lock; the loser receives `409 Conflict`. |
| Overload | Fixed connection pool with statement and lock timeouts. The API returns `503` rather than queueing indefinitely. |
| Abusive traffic | Rate limiting, payload caps, and schema validation reject requests before the database is touched. |
| Slow uploads | Files are saved to disk before the transaction starts, so an upload never holds a lock. |
| Network retries | An idempotency key with a unique constraint returns the original ticket instead of creating a duplicate. |
| Deadline job | Small batches, one short transaction per escalation, resumable after a restart, and safe to run repeatedly without double-escalating. |
| Failures | A health endpoint, a process supervisor, and a rule that database errors are never reported as success. |

### Design decisions

| Decision | Alternative | Reasoning |
| --- | --- | --- |
| PostgreSQL | MongoDB, MySQL | Relational data, transactions, row-level locking, constraints, and triggers match the consistency and audit requirements. |
| `pg` with parameterized SQL | Prisma, Sequelize | Direct control over transactions, row locks, and audit insertion without an abstraction layer. |
| Server-Sent Events | WebSockets, Socket.IO | Notifications are one-way, so continuous two-way communication is unnecessary. Stored notifications cover offline users. |
| React with Vite | Next.js | Server rendering is not needed for this application. |
| Express | NestJS | A minimal structure keeps backend logic explicit and easy to test. |
| Zod | Joi, express-validator | Schema-based validation that fits naturally into a JavaScript codebase. |
| Node.js `crypto` | Extra hashing library | Built in, and covers both SHA-256 hashing and secure random tokens. |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL, `pg` (node-postgres) |
| Security | Helmet, express-rate-limit, express-session, connect-pg-simple, bcrypt, Zod |
| Uploads | Multer |
| Cryptography | Node.js `crypto` |
| Realtime | Server-Sent Events |
| Testing | Vitest, Supertest |

## Project Structure

```
open-case/
├── client/                     # React + Vite frontend
│   ├── public/
│   └── src/
│       ├── api/                # API request helpers
│       ├── assets/
│       ├── components/         # Reusable UI components
│       ├── context/            # Auth and notification state
│       ├── hooks/
│       ├── pages/              # Route-level views
│       ├── styles/
│       ├── utils/
│       ├── App.jsx
│       └── main.jsx
│
├── server/                     # Express backend
│   ├── src/
│   │   ├── config/             # Environment and app configuration
│   │   ├── controllers/        # Request handlers
│   │   ├── db/                 # Connection pool, transactions, migrations
│   │   ├── jobs/               # Scheduled SLA escalation job
│   │   ├── middleware/         # Auth, roles, rate limiting, validation, uploads, errors
│   │   ├── routes/             # API route definitions
│   │   ├── services/           # Business logic: tickets, workflow, audit, notifications
│   │   ├── utils/
│   │   ├── validators/         # Zod schemas
│   │   ├── app.js
│   │   └── server.js
│   ├── uploads/                # Stored attachments (git-ignored)
│   └── tests/
│       ├── unit/
│       └── integration/
│
├── docs/                       # Abstract, class diagram, design notes
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

**Prerequisites:** Node.js (LTS) and PostgreSQL.

```bash
# Clone the repository
git clone <repository-url>
cd open-case

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment variables
cp .env.example server/.env

# Run the database migrations, then start the apps
cd ../server && npm run dev
cd ../client && npm run dev
```

## Testing

The test plan targets the properties the project claims, so each guarantee has a test that would fail if it stopped holding.

| Area | What is verified |
| --- | --- |
| State machine | Permitted and forbidden combinations of status, target, and role |
| Atomicity | A forced audit-insert failure rolls back the ticket update |
| Concurrency | Simultaneous transitions on one ticket; stale requests rejected; audit sequence remains valid |
| Idempotency | Repeated creation with one key produces one ticket |
| Tamper detection | Modified payloads, deleted events, and reordered events are detected |
| Anonymity | No creator-account link; receipt-token access works; no IP or user-agent stored |
| SLA and notifications | Deadlines just before and after due time; repeated job runs; notifications only for committed changes |
| Authorization and failures | Endpoint access per role; database failures return errors, never false success |
| Load | Controlled concurrent ticket creation and competing updates, with results reported alongside test conditions rather than as a claimed capacity |

```bash
npm test
```

## Scope and Limitations

- The audit trail is tamper-evident, not tamper-proof (see [The Audit Trail](#the-audit-trail)).
- Version 1 runs as a single API instance with one PostgreSQL database. High availability and specific throughput figures are not claimed; correctness under concurrency is demonstrated through the test suite.
- Authentication uses application-managed accounts restricted to college email addresses for the demonstration.

## Roadmap

- Digital signatures on audit events, with a key held outside the database
- Independently published ledger checkpoints
- Multi-level escalation
- Internal-only officer notes
- Semantic clustering of similar complaints
- Multi-instance API deployment

## Team Strange Loop

| Member | Roll No. | Branch |
| --- | --- | --- |
| Akshat Awasthi | 20255009 | Electrical Engineering |
| Sukrat Srivastava | 20255088 | Electrical Engineering |
| Krishna Agrawal | 20255050 | Electrical Engineering | 