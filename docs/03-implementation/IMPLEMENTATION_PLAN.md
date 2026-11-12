# Implementation Plan

Build in vertical slices. Do not ask the coding agent to implement all modules in one prompt.

## Phase 0 — Foundation
- Initialize Next.js App Router + TypeScript + Tailwind + shadcn/ui.
- Configure Supabase local/dev/prod environments and migration workflow.
- Add lint, typecheck, test runner, env validation, logging, error envelope.
- Create server/client Supabase clients; protect service role key.

## Phase 1 — Auth, roles, and shell
- Supabase Auth login/logout/reset.
- Staff profile and roles ADMIN/STAFF.
- Server-side authorization and RLS baseline.
- Admin/Staff layouts and navigation.
- Seed first Admin securely.

## Phase 2 — Restaurant settings, tables, sessions
- Restaurant hours and timezone utilities.
- Table CRUD, stable QR URL/code, PDF downloads.
- Session creation/join/expiry and concurrency constraints.
- Temporary close/reopen and customer-facing state.

## Phase 3 — Catalog and customer flow
- Categories/menus CRUD, image storage, active states, sorting.
- Variants/add-ons and menu configuration editor.
- Built-in/custom templates, categories, preview, apply, duplicate, save-from-menu, optimistic locking.
- Public catalog and guided customer UI.
- Local cart persistence, validation, item/order notes.

## Phase 4 — Voucher and order creation
- Voucher CRUD and validation.
- Atomic quota reservation.
- Operational order number generator.
- Server-side checkout validation and immutable snapshots.
- Customer order token generation/hash storage.

## Phase 5 — Payments
- Midtrans adapter and QRIS creation.
- Payment attempts/retry/expiry.
- Webhook verification, dedupe, delayed status verification, idempotent paid transition.
- Customer payment UI, realtime + polling fallback, cancellation race protection.

## Phase 6 — Confirmation, receipts, kitchen queue
- Receipt/confirmation page via token.
- PDF receipt generation.
- Optional one-time email send and retry.
- Kitchen ticket creation only after payment success.
- Staff queue, sound activation, per-account BARU, reconnect/resync.
- Operational closing and history archive.

## Phase 7 — Transactions, Admin operations, analytics
- Transaction list/detail and read-only Staff access.
- Admin cancel unpaid order with reason and audit.
- Staff account management/deactivation.
- Audit Log UI.
- Dashboard metrics, chart, top menus, payment method summary.

## Phase 8 — Hardening and release
- Full E2E suite, security/RLS review, load/concurrency tests.
- Midtrans sandbox acceptance and production checklist.
- Email domain verification, rate limiting, observability, backups.
- Deploy staging, UAT, then production.

## Release gates

Do not enable live payment until webhook signature verification, idempotency, delayed notification handling, and reconciliation tests pass. Do not launch customer ordering until session/closing rules and server-side checkout validation pass. Do not launch Staff queue until reconnect/resync and per-account read markers pass.
