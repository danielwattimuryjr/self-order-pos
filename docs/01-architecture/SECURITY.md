# Security Requirements

## 1. Authentication and roles

- Supabase Auth email/password for Admin and Staff.
- Exactly two application roles: `ADMIN`, `STAFF`.
- Admin creates Staff accounts. Passwords are never stored/displayed by application tables; use Supabase Auth secure admin APIs/server-side.
- Password policy: minimum 8 characters, letters and numbers; no symbol requirement.
- Forgot/reset password through Supabase Auth email flow.
- Session duration target: 7 days. Logout ends current device session. Multiple simultaneous devices allowed.
- Deactivating an account must revoke/deny access across all sessions; every protected request checks active profile status, not just stale JWT role claims.
- Admin cannot change own role or deactivate own account.

## 2. Authorization

- Server-side role checks on every protected route and server action.
- Staff may read queue/history/order/transaction details but cannot access analytics, mutate catalog, vouchers, tables, staff, templates, settings, or cancel orders.
- Admin-only analytics and management routes.
- RLS enabled on Supabase tables. Do not rely on hidden UI as access control.
- Service role key only on server; never expose to browser.

## 3. Customer order access

- Generate cryptographically random per-order token (high entropy).
- Store only token hash; show raw token only to the customer once as URL path/query secret.
- Never use order number, table code, or session ID as authorization secret.
- Rate limit token routes; use constant-time hash comparison where applicable.
- Allow token revocation.
- Customer token grants access only to that single order/receipt, never other orders in same table session.

## 4. Payment security

- Verify Midtrans notification signature and transaction status.
- Never trust browser redirect as proof of payment.
- Verify delayed webhook/race states directly with provider before cancellation/expiry decisions.
- Deduplicate webhook event and provider transaction IDs.
- Idempotently transition order/payment and create ticket exactly once.
- Do not log secrets, full raw tokens, or unnecessary personal/payment payloads.

## 5. Database and input security

- Use parameterized queries/Supabase query builder; validate with Zod.
- Enforce constraints at DB layer for money, quantity, statuses, uniqueness, and session invariants.
- Use atomic transaction/RPC for voucher quota, sequence generation, and payment transitions.
- Sanitize rendered user text; defend against XSS.
- Validate upload MIME/type/size; do not trust filename extension.
- Public endpoint rate limits per IP and relevant table/order token.

## 6. Audit Log

Record important events: login/logout, menu/category changes, price changes, variant/add-on changes, template/category changes, voucher changes, table changes, hours/temporary closure, order cancellation, staff account changes. Include actor, action, timestamp, entity, before/after values where relevant. Audit Log is append-only from UI and visible only to Admin.
