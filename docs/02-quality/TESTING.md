# Testing Strategy and Acceptance Criteria

## 1. Test layers

- Unit: money calculations, voucher eligibility, operational date, order number formatting, state transitions, variant/add-on pricing, template validation.
- Integration: database constraints/RPC, RLS, auth/role guards, Midtrans webhook idempotency, email send lock, session concurrency.
- E2E: complete customer order and Admin/Staff workflows on mobile/desktop.
- Contract: API request/response schemas and provider adapter behavior.

## 2. Critical acceptance scenarios

### Sessions
- Two devices scan same active table and join one session.
- Concurrent first scans create exactly one active session.
- Expired session cannot create order; QR scan creates new session.
- Table deactivation blocks new sessions while preserving history.

### Restaurant settings and tables
- Opening/closing uses the same daily schedule and handles overnight hours in Asia/Jakarta.
- Temporary close requires a reason, resets at the next opening time, and is audit logged.
- Table codes remain unchanged when the displayed table number changes; retired numbers cannot be reused.
- QR export contains active tables only and customer QR paths do not act as authorization tokens.

### Order/payment
- Order creation stores server-calculated snapshot and 15-minute deadline.
- Refresh does not create another order/payment attempt.
- Retry allowed only before expiry.
- Duplicate webhook creates one paid transition and one kitchen ticket.
- Delayed webhook success wins over cancellation/expiry when provider confirms paid.
- Payment attempt creation reuses its idempotency key; a second pending attempt cannot be opened concurrently.
- Webhook signature, transaction identifiers, and amount are verified; duplicate provider events do not repeat voucher consumption.
- Customer cancellation asks Midtrans to cancel a pending transaction and rechecks status; settlement wins if it races with cancellation.
- Unpaid/failed/expired orders never appear in kitchen queue.
- Paid orders cannot be edited/deleted/cancelled.

### Voucher
- Concurrent reservations cannot exceed quota.
- Paid consumes reservation; cancel/failure/expiry releases it.
- Category-scoped minimum and discount are calculated from eligible subtotal only.
- Historical order retains voucher snapshot after voucher edit/deactivation.
- Phase 4 SQL smoke test verifies server-side totals/snapshots, reservation/release/consumption idempotency, and quota exhaustion.

### Menu and cart
- Category inactive hides its menus without mutating menu status.
- Price change requires customer acceptance.
- Menu/option deactivation during cart selection is caught at checkout.
- Menu history snapshots remain unchanged after edit/delete/deactivation.

### Customer catalog search and pagination
- Search runs through the public catalog Route Handler and matches active menu names/descriptions case-insensitively.
- Query parameters are validated; category and search filters combine and preserve the default category/menu order.
- Pagination returns only the requested page and accurate result metadata.
- Inactive menu/category rows remain hidden by explicit filters and anonymous RLS.
- Retained cart/selected menu data does not enter the visible result count and remains subject to anonymous RLS.
- Search debounce, URL refresh, browser back/forward, error/retry, and page changes do not clear the cart.
- Checkout continues to validate current menu availability and prices server-side.

### Template
- Built-in templates are read-only.
- The built-in spice, sugar, and ice templates are optional single-select groups with zero price adjustment.
- A menu with more than one variant group containing override options is rejected; override price replaces base and other group adjustments are added.
- Applying template copies values; no relational coupling to template.
- Whole-config and by-type apply modes behave as specified.
- Concurrent template edits trigger optimistic-lock conflict.
- Deleting template/category does not alter copied menu config.

### Kitchen
- Queue FIFO by payment success time.
- A verified settlement creates exactly one ticket and one receipt record; unpaid orders create neither.
- Existing tickets load silently; newly arriving ticket sounds only after audio enabled.
- BARU is per Staff account and consistent across that account's devices.
- Connection loss shows status and reconnect performs reconciliation without duplicate/missing ticket.
- At close, tickets move to history and all read markers clear.

### Receipt email
- A checkout email receives one automatic webhook-triggered attempt; duplicate webhooks do not automatically retry it.
- Missing checkout email creates no email delivery offer; a failed automatic attempt can be retried manually to the original checkout address.
- A successful delivery is idempotent and cannot be repeated for the same order.

### Access control
- Staff cannot call Admin APIs even if UI route is manually entered.
- Anonymous catalog reads expose only active category/menu/configuration rows; session resolution and rate-limit RPCs are server-only.
- Catalog requests above 60 per minute per source IP or table code return `429` with a retry delay.
- Staff cannot access analytics endpoints/data.
- Inactive Staff loses access across active devices.
- Customer token for order A cannot access order B.

### Operations and reports
- Opening/closing and overnight operational date boundaries are correct.
- Temporary close blocks new order but does not invalidate existing payment window.
- Analytics include paid orders only and compute omzet after discount.
- Staff sees operational order detail but no aggregated revenue.
- Admin cancellation requires a valid structured reason and text for `OTHER`; provider-confirmed settlement wins a cancellation race, and a successful cancellation writes one atomic audit event.
- Staff invitation, role/status changes, and login/logout append audit entries. Self-demotion/deactivation and removal of the last active Admin are rejected.
- Admin and Staff transaction APIs enforce role-specific access; Staff cannot access Admin analytics or mutate orders.
- Analytics use inclusive `operational_date` filters, count paid orders only, calculate revenue from the post-discount paid total, and use hourly/daily/weekly buckets according to the selected range.

## 3. Definition of Done per feature

- Requirements and acceptance criteria implemented.
- Loading, empty, error, forbidden, and offline states handled.
- Server validation and authorization present.
- Database migration/constraints/indexes added when needed.
- Unit/integration/E2E tests appropriate to risk.
- Audit events added for administrative mutation.
- No secrets or sensitive data exposed in client bundle/logs.
- Documentation updated; lint/typecheck/test pass.
