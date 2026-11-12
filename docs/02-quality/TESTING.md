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
- Unpaid/failed/expired orders never appear in kitchen queue.
- Paid orders cannot be edited/deleted/cancelled.

### Voucher
- Concurrent reservations cannot exceed quota.
- Paid consumes reservation; cancel/failure/expiry releases it.
- Category-scoped minimum and discount are calculated from eligible subtotal only.
- Historical order retains voucher snapshot after voucher edit/deactivation.

### Menu and cart
- Category inactive hides its menus without mutating menu status.
- Price change requires customer acceptance.
- Menu/option deactivation during cart selection is caught at checkout.
- Menu history snapshots remain unchanged after edit/delete/deactivation.

### Template
- Built-in templates are read-only.
- Applying template copies values; no relational coupling to template.
- Whole-config and by-type apply modes behave as specified.
- Concurrent template edits trigger optimistic-lock conflict.
- Deleting template/category does not alter copied menu config.

### Kitchen
- Queue FIFO by payment success time.
- Existing tickets load silently; newly arriving ticket sounds only after audio enabled.
- BARU is per Staff account and consistent across that account's devices.
- Connection loss shows status and reconnect performs reconciliation without duplicate/missing ticket.
- At close, tickets move to history and all read markers clear.

### Access control
- Staff cannot call Admin APIs even if UI route is manually entered.
- Staff cannot access analytics endpoints/data.
- Inactive Staff loses access across active devices.
- Customer token for order A cannot access order B.

### Operations and reports
- Opening/closing and overnight operational date boundaries are correct.
- Temporary close blocks new order but does not invalidate existing payment window.
- Analytics include paid orders only and compute omzet after discount.
- Staff sees operational order detail but no aggregated revenue.

## 3. Definition of Done per feature

- Requirements and acceptance criteria implemented.
- Loading, empty, error, forbidden, and offline states handled.
- Server validation and authorization present.
- Database migration/constraints/indexes added when needed.
- Unit/integration/E2E tests appropriate to risk.
- Audit events added for administrative mutation.
- No secrets or sensitive data exposed in client bundle/logs.
- Documentation updated; lint/typecheck/test pass.
