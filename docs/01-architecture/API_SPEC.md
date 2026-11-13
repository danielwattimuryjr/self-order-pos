# API Specification (Logical Contract)

All routes are versioned under `/api/v1`. Exact DTOs should be typed and validated with Zod. Use consistent response envelope:

```json
{ "status": "success", "message": "...", "data": {} }
```

Errors use appropriate HTTP status and stable error codes; never leak provider secrets or stack traces.

## Public customer endpoints

- `GET /tables/{tableCode}/catalog` — resolve active table/session context and return categories, active menus, variant/add-on config, operating status. A `sessionId` query parameter validates the existing browsing session during catalog refresh; expired sessions return `409 SESSION_EXPIRED` and are not silently replaced. Do not expose internal staff data.
- `POST /sessions/{sessionId}/orders` — body: `tableCode`, customer-generated `idempotencyKey` and `accessToken`, `items` (`menuId`, `quantity`, `note`, `variantSelections`, `addonSelections`), optional `voucherCode`, `customerName`, `receiptEmail`, and `orderNotes`. Validate session, hours, menu/category state, current prices/configuration, and voucher; calculate immutable snapshots and create a `PENDING_PAYMENT` order with a 15-minute deadline atomically. Retrying the same key and token returns the existing order. Store only the access token's SHA-256 hash.
- `POST /orders/{orderId}/payment-attempts` — body: `tableCode`, `accessToken`, and client-generated `idempotencyKey`. Create/reuse a server-validated Midtrans QRIS attempt while the order remains payable. Return only the QR image URL, amount-derived order context, and safe status.
- `GET /orders/{orderId}/payment-status` — provide the order token in `Authorization: Bearer …`; return order/payment status and QR URL after constant-time token-hash comparison. The UUID alone never grants access, and the token is kept out of the URL.
- `POST /orders/{orderId}/cancel` — body: `tableCode` and `accessToken`. Verify current provider status, request provider cancellation while pending, verify again, then atomically cancel only if unpaid. A confirmed payment wins the race.
- `GET /receipt/{token}` — token-protected receipt/confirmation.
- `POST /receipt/{token}/email` — request one-time email send; enforce server-side one-success rule.
- `GET /receipt/{token}/pdf` — generate/download receipt PDF.
- `POST /vouchers/validate` — body: `tableCode`, `sessionId`, normalized `code`, and current cart `items`. Recompute current prices and eligible category subtotal; return `{ valid, reason?, eligibleSubtotal?, discountAmount?, totalAmount? }`. Authoritative revalidation occurs during atomic order creation.

## Provider webhook

- `POST /webhooks/midtrans` — verify notification signature, refetch authoritative provider status, deduplicate the event, verify amount and transaction IDs, then atomically update payment/order and consume/release voucher reservation. Kitchen ticket creation and receipt email dispatch belong to Phase 6.

## Staff endpoints

- `GET /staff/kitchen/queue` — active tickets FIFO, with per-account read state.
- `GET /staff/kitchen/history` — search/filter operational date/table/order number, server-side pagination 20.
- `GET /staff/kitchen/tickets/{ticketId}` — read-only detail.
- `POST /staff/kitchen/tickets/{ticketId}/read` — persist per-staff viewed marker; this changes read marker only, not order/ticket status.
- `GET /staff/orders` and `GET /staff/orders/{orderId}` — read-only operational transaction/order details.
- `GET /staff/profile` — current profile.
- `POST /staff/profile/password-reset` — initiate Supabase Auth reset flow if needed.

## Admin endpoints

- CRUD `/admin/categories`, `/admin/menus`, `/admin/tables`, `/admin/vouchers`, `/admin/staff`. Voucher fields: normalized code, name, discount type/value, minimum transaction, optional cap/quota, inclusive calendar dates, daily WIB times, active status, and category scopes. Voucher create/update/delete and audit entry are atomic.
- `PATCH /admin/categories/reorder` and `PATCH /admin/menus/reorder` persist manual ordering.
- `POST /admin/menus/image` validates and uploads a menu photo; menu endpoints include image path, sort order, active status, and variant/add-on config.
- Template endpoints: list/create/update/delete, duplicate, template category CRUD, save-from-menu, preview in Admin UI, and apply to a menu with `REPLACE_ALL` or `REPLACE_BY_TYPE`. Update uses `version` for optimistic locking.
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
- Customer payment state is broadcast on an order-token-derived Realtime topic; the payload is only a change notice. Clients refetch the token-protected status endpoint. Poll every 5 seconds when Realtime is unavailable and continue reconciliation at the order expiry deadline.
- Rate limit public table/catalog/order/receipt endpoints.
- Voucher validation and order creation are limited to 60 requests per minute by source IP and table code. They use separate counters from catalog reads.
- Catalog requests are limited to 60 requests per minute for both the source IP and table code; excess requests receive `429 RATE_LIMITED` with `Retry-After`.
- Return 401 unauthenticated, 403 unauthorized/inactive, 404 non-disclosing for inaccessible token resources, 409 business conflict, 422 validation failure, 429 rate limited.
- Realtime changes should not be implemented as unauthenticated write endpoints.
