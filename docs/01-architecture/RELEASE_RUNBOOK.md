# Phase 8 Release Runbook

This checklist prepares the V1 release. Staging must use an isolated Supabase project and sandbox provider credentials. Production deployment and production configuration changes require a separate explicit release authorization.

## 1. Automated release gates

- [ ] `npm test` passes.
- [ ] `npm run test:e2e` passes against localhost; record any skipped role tests and run them with dedicated local Admin/Staff identities.
- [ ] `npx supabase test db` passes after applying the reviewed migrations to local Supabase.
- [ ] `npm run test:load` confirms concurrent table scans resolve to one active session.
- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- [ ] Review the Git diff and dependency audit. No secrets, local data, traces, or test credentials are committed.

## 2. Staging isolation

- [ ] Create/use a dedicated staging Vercel deployment and a separate hosted Supabase staging project.
- [ ] Confirm staging Supabase project reference and URL before applying migrations; verify they do not identify production.
- [ ] Configure staging-only Supabase URL/anon/service-role keys, Midtrans sandbox keys, and Resend test sender credentials in the hosting provider's secret store.
- [ ] Set Auth site URL and callback allowlist to the staging hostname.
- [ ] Set the Midtrans sandbox notification URL to the staging webhook and verify the synthetic URL-test notification is acknowledged without creating a payment record.
- [ ] Confirm any Vercel protection or allowlist settings let the Midtrans sandbox reach the webhook.

## 3. UAT scenarios

- [ ] Scan active and inactive table QR codes; confirm session reuse, expiration, and restaurant-hours behavior.
- [ ] Search/filter catalog, customize a menu, create an order, and verify server-calculated order totals.
- [ ] Complete one Midtrans sandbox QRIS settlement; verify webhook processing, payment state, kitchen ticket, and optional receipt email.
- [ ] Send a duplicate/delayed sandbox notification and verify idempotency.
- [ ] Verify failed/expired/cancelled transactions and customer/Admin cancellation race handling.
- [ ] Verify Admin and Staff access boundaries, including direct API calls and inactive-account access.
- [ ] Confirm the Resend automatic attempt occurs at most once per order; verify manual retry only for the checkout address.
- [ ] Record UAT owner, date, deployment identifier, and failures without copying credentials or personal customer data.

## 4. Email sender readiness

- [ ] Verify the sender domain in Resend and publish the exact DNS records supplied by Resend.
- [ ] Confirm SPF/DKIM status in Resend; publish DMARC appropriate to the domain owner's policy.
- [ ] Send a staging test receipt to a controlled mailbox and confirm From, reply handling, rendering, and delivery.
- [ ] Confirm email failure remains non-blocking for payment and is visible through safe provider error codes.

The actual domain, DNS records, and sender identity are environment-specific. Do not put them in source control.

## 5. Rate limits and observability

- [ ] Confirm catalog and public order rate-limit SQL tests pass and that `429` responses include `Retry-After`.
- [ ] Confirm the Vercel forwarded client IP header reaches the application. If traffic passes through another proxy, configure a trusted-proxy mechanism before relying on IP limits.
- [ ] Review Vercel function logs and Supabase database/Auth logs during staging UAT. Search using platform request/deployment identifiers; do not log order tokens, credentials, raw provider payloads, or unnecessary personal data.
- [ ] Configure platform alerts for repeated function failures, database availability, and provider callback failures.
- [ ] Document the operator and escalation route for payment-webhook or email-provider incidents.

Vercel provides client IP in its forwarded request headers and overwrites `X-Forwarded-For` on direct deployments; proxy deployments require a trusted proxy configuration. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).

## 6. Backups and restore readiness

- [ ] Confirm the selected Supabase plan's backup/PITR features, retention period, and restore limitations in the Supabase dashboard.
- [ ] Assign a backup owner and record the applicable recovery point objective (RPO) and recovery time objective (RTO).
- [ ] Perform a restore drill into a separate non-production project, then verify schema, Auth users, Storage objects, and representative order/payment history.
- [ ] Keep restore credentials and exported database data outside this repository; never attach a production dump to a ticket or commit.

Backup availability and retention depend on the selected Supabase plan. RPO/RTO values require an owner decision before launch; this runbook does not assume them.

## 7. Production release gate

- [ ] Staging UAT is signed off and all release-blocking findings are closed.
- [ ] A separate production change window, rollback owner, and approval are recorded.
- [ ] Production Supabase migration plan, Midtrans production callback/credentials, Resend sender, backup status, and monitoring have been reviewed by the owner.
- [ ] Do not deploy or change production until explicit authorization is given.
