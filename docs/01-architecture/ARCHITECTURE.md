# Architecture

## 1. Recommended architecture

- **Web app + backend:** Next.js App Router and Route Handlers (no separate Express service in V1).
- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui.
- **Database:** Supabase PostgreSQL.
- **Auth:** Supabase Auth email/password for Admin and Staff.
- **Realtime:** Supabase Realtime for menu, queue, restaurant status, and payment UI updates.
- **Storage:** Supabase Storage for menu images.
- **Payment:** Midtrans QRIS.
- **Email:** Resend transactional email. Customer-triggered and webhook-triggered receipt workflows are supported; verify account/domain configuration before release.
- **Hosting:** Vercel + Supabase.
- **Validation:** Zod schemas shared where appropriate between client and server.
- **Charts:** Recharts or equivalent.

## 2. Application boundaries

- Browser is untrusted. No totals, payment states, roles, or permissions are trusted from client payload.
- Route Handlers call domain services; domain services own rules and transaction boundaries.
- Database constraints/RPC protect concurrency-sensitive invariants.
- Provider integrations are isolated behind adapters (`payments`, `email`).
- Realtime events are notifications to refetch/patch UI, not authorization or proof of payment.

## 3. Suggested code organization

```text
src/
  app/
    (customer)/order/[tableCode]/...
    (auth)/login/...
    (admin)/dashboard/...
    (staff)/queue/...
    api/v1/...
  components/
    customer/ admin/ staff/ shared/
  lib/
    supabase/client.ts
    supabase/server.ts
    auth/authorization.ts
    validation/
    money/
    time/
    security/tokens.ts
    rate-limit/
  modules/
    orders/ payments/ sessions/ menu/ categories/
    variants/ templates/ vouchers/ kitchen/
    receipts/ tables/ staff/ analytics/ audit/
  services/
    midtrans/ email/
  types/
  tests/
supabase/
  migrations/
  seed.sql
```

## 4. Domain modules

Each module should expose typed service functions, schemas, and repository/data access. Route handlers should remain thin: authenticate/authorize, validate request, call service, map errors to HTTP responses.

## 5. Concurrency and transactions

Use database transactions or carefully designed Postgres RPC for:
- Create/join active table session.
- Generate operational order number.
- Create order with immutable item/price snapshots.
- Reserve voucher quota.
- Apply successful payment once and create one kitchen ticket.
- Cancel unpaid order after verifying payment state.
- Resolve/join an active table session under a row lock and partial unique constraint.
- Apply restaurant settings and table changes with their audit entries atomically.
- Move tickets to history and clear all read markers at closing.
- Template optimistic-lock update.

Never rely on a sequence of independent client requests for financial atomicity.

## 6. Operational reliability

- Webhook idempotency key/provider event identity.
- Retry transient email failures with bounded exponential backoff; preserve failed state and allow user retry.
- Realtime reconnect + queue resync.
- Poll payment status every 5 seconds only as fallback; stop when final.
- Rate limit public endpoints and token-based receipt access.
- Structured logs with correlation IDs; do not log secrets or full sensitive provider payloads unnecessarily.

## 7. Decisions and assumptions

- One outlet only.
- No separate Express backend.
- Vercel serverless constraints: no local printer connectivity in V1.
- No print agent or print job production path. Kitchen ticket is a digital database-backed view.
- Verify Midtrans account capabilities, production callback settings, email sender domain, and Supabase plan limits before release.
