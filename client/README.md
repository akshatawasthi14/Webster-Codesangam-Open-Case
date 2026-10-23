# Open Case Client (Frontend)

The modern, accessible React frontend for **Open Case** · institutional grievance redressal platform.

## Color Palette

Designed specifically with the institutional, aesthetic palette:
- **Ice Silver (`#DDE3E8`)**: Crisp backgrounds, cards, subtle borders, chips, and muted status indicators.
- **Deep Aubergine (`#3A0F34`)**: Brand identity, primary headers, elevated navigation, dark contrast accents.
- **Flavour of Marigold (`#EAAA00`)**: Warm active accents, CTA buttons, notification badges, deadline indicators, and hash verification highlights.

## Features & Integration

1. **Seamless Backend Parity**:
   - **Cookie-backed sessions** with `credentials: 'include'` for registered students, officers, and administrators.
   - **Anonymous reporting** with generated `X-Receipt-Token` headers (shown once via a persistent receipt dialog).
   - **Idempotency** via unique `Idempotency-Key` headers on ticket submission.
   - **Real-time Server-Sent Events (SSE)** connected to `/api/notifications/stream`.
2. **Interactive Cryptographic Audit Trail Visualizer**:
   - Visual inspection of the SHA-256 hash chain ($H_i = \text{SHA256}(H_{i-1}, \dots)$).
   - One-click client-side trigger to verify chain integrity against database triggers.
3. **Role-Tailored Dashboards**:
   - **Student Dashboard**: Track submitted named grievances, check live SLA countdowns, and dispute resolutions within 72 hours.
   - **Officer Dashboard**: Claim unassigned grievances (`FILED`), manage assigned workload, and resolve cases with mandatory resolution notes.
   - **Admin Console**: Supervise escalations, re-assign tickets, provision officer accounts, and configure SLA rule hours.
4. **Public Transparency & Anonymity**:
   - High-level KPI summary, category distributions, and resolution times.
   - Visual indicators for small counts (<5) suppressed for petitioner privacy.

## Development & Build

```bash
# In the client directory:
npm install
npm run dev

# Or from project root:
npm run dev:client
npm run build:client
```

