# API Specification (Logical Contract)

All routes are versioned under `/api/v1`. Exact DTOs should be typed and validated with Zod. Use consistent response envelope:

```json
{ "status": "success", "message": "...", "data": {} }
```

Errors use appropriate HTTP status and stable error codes; never leak provider secrets or stack traces.

## Public customer endpoints

- `GET /tables/{tableCode}/catalog` — resolve active table/session context and return categories, active menus, variant/add-on config, operating status. Do not expose internal staff data.
- `POST /sessions/{sessionId}/orders` — validate session, hours, cart snapshots, menu/category active state, current prices/configuration, and voucher; accept optional receipt email and create order/payment deadline atomically.
- `POST /orders/{orderId}/payment-attempts` — create/retry Midtrans payment attempt while order remains valid.
- `GET /orders/{orderId}/payment-status` — public-safe payment state via access proof or protected opaque identifier; do not expose guessable IDs alone.
- `POST /orders/{orderId}/cancel` — customer cancel unpaid order after server-side provider verification.
- `GET /receipt/{token}` — token-protected receipt/confirmation.
- `POST /receipt/{token}/email` — request one-time email send; enforce server-side one-success rule.
- `GET /receipt/{token}/pdf` — generate/download receipt PDF.
- `POST /vouchers/validate` — validate code against current cart; authoritative revalidation occurs during order creation.

## Provider webhook

- `POST /webhooks/midtrans` — verify authenticity/signature and provider status, deduplicate event, verify transaction status when necessary, atomically update payment/order, consume/release voucher reservation, create one kitchen ticket, and enqueue receipt email when an address was provided at checkout.

## Staff endpoints

- `GET /staff/kitchen/queue` — active tickets FIFO, with per-account read state.
- `GET /staff/kitchen/history` — search/filter operational date/table/order number, server-side pagination 20.
- `GET /staff/kitchen/tickets/{ticketId}` — read-only detail.
- `POST /staff/kitchen/tickets/{ticketId}/read` — persist per-staff viewed marker; this changes read marker only, not order/ticket status.
- `GET /staff/orders` and `GET /staff/orders/{orderId}` — read-only operational transaction/order details.
- `GET /staff/profile` — current profile.
- `POST /staff/profile/password-reset` — initiate Supabase Auth reset flow if needed.

## Admin endpoints

- CRUD `/admin/categories`, `/admin/menus`, `/admin/tables`, `/admin/vouchers`, `/admin/staff`.
- Menu endpoints include image upload path, sort order, active status, variant/add-on config.
- Template endpoints: list/create/get/update/delete/duplicate, categories CRUD, save-from-menu, preview/apply. Update uses `version` for optimistic locking.
- `GET/PUT /admin/settings/operating-hours`.
- `POST /admin/restaurant/temporary-close`; `POST /admin/restaurant/reopen`.
- `GET /admin/transactions` and detail (read-only for paid orders).
- `POST /admin/orders/{id}/cancel` — unpaid only, reason required, provider verification.
- `GET /admin/analytics/summary`, `/sales-chart`, `/top-menus`, `/payment-methods`.
- `GET /admin/audit-logs`.
- `GET /admin/tables/qr-pdf` and individual QR download.

## API behavior

- Validate all request bodies, params, and query strings.
- Server computes all monetary totals.
- Use pagination cursors or page/limit with bounded max; history default 20.
- Use idempotency keys for order/payment creation where appropriate.
- Rate limit public table/catalog/order/receipt endpoints.
- Return 401 unauthenticated, 403 unauthorized/inactive, 404 non-disclosing for inaccessible token resources, 409 business conflict, 422 validation failure, 429 rate limited.
- Realtime changes should not be implemented as unauthenticated write endpoints.
