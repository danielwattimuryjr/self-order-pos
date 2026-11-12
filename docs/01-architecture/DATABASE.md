# Database Design

Use UUID primary keys, `timestamptz` for instants, `NUMERIC(precision,0)` or integer rupiah for money, and explicit check constraints. All timestamps are stored as UTC instants; operational calculations/display use `Asia/Jakarta`.

## 1. Core tables (recommended logical model)

### Identity
- `staff_profiles`: `id`, `auth_user_id` unique FK to `auth.users`, `name`, `email`, `role` (`ADMIN|STAFF`), `is_active`, timestamps.
- `audit_logs`: actor staff ID, action, entity type/id, before/after JSONB, metadata JSONB, created_at. Append-only from application UI.

### Restaurant configuration
- `dining_tables`: stable UUID, immutable random UUIDv4 `table_code`/QR identifier, `table_number`, active flag, timestamps. Number unique and never reused after retirement.
- `restaurant_settings`: singleton config with `timezone='Asia/Jakarta'`, one opening/closing time used every day, temporary close state/reason, updated_by. Null hours mean the schedule is not configured yet.
- `table_sessions`: table_id, started_at, expires_at, closed_at, status. Enforce at most one active session per table with partial unique index. Initial expiry is 60 minutes; only valid order/payment activity may extend it.
- `audit_logs`: append-only administrative event records; Phase 2 writes settings and table mutations, while the UI is planned for Phase 7.

### Catalog
- `categories`: name, sort_order, is_active, timestamps.
- `menus`: category_id, name, description, price, image_path, is_active, sort_order, timestamps.
- `menu_variant_groups`: menu_id, name, required, selection_type (single), sort_order.
- `menu_variant_options`: group_id, name, pricing_mode (`ADJUSTMENT|OVERRIDE`), price_value, is_active, sort_order.
- `menu_addon_groups`: menu_id, name, required, min_select, max_select, sort_order.
- `menu_addon_options`: group_id, name, unit_price, is_active, sort_order.

### Templates
- `template_categories`: name, sort_order, created_by, updated_by, timestamps.
- `option_templates`: name, nullable category_id, configuration JSONB with schema version, created_by, updated_by, version integer, timestamps.
- Built-in templates live in frontend configuration and are immutable.
- No FK from menu configuration to template. Applying a template copies values into menu-owned groups/options.

### Vouchers
- `vouchers`: code unique normalized, name, discount_type (`PERCENT|FIXED`), discount_value, min_transaction, max_discount nullable, quota nullable, used_count, starts_at, ends_at, starts_time/ends_time or equivalent WIB schedule fields, is_active, timestamps.
- `voucher_category_scopes`: voucher_id/category_id.
- `voucher_reservations`: voucher_id/order_id unique, reserved_until, status (`RESERVED|CONSUMED|RELEASED`), timestamps.
- `voucher_redemptions`: voucher_id/order_id unique, redeemed_at, discount_snapshot.

### Orders and payments
- `operational_sequences`: operational_date primary key, last_sequence.
- `orders`: order_number unique, table_id, table_number_snapshot, session_id, customer_name nullable, order_notes nullable, order_status, payment_status, subtotal, discount_amount, total_amount, voucher_id nullable, voucher_snapshot JSONB, access_token_hash unique, created_at, expires_at, paid_at, cancelled_at, cancellation_reason, operational_date.
- `order_items`: order_id, menu_id nullable, menu_name_snapshot, category_name_snapshot, base_price_snapshot, unit_price_snapshot, quantity, item_note, variant_snapshot JSONB, addon_snapshot JSONB, line_total.
- `payments`: order_id, attempt_number, provider, provider_order_id, provider_transaction_id, method, status, amount, qr_payload/qr_url, expires_at, paid_at, provider_response_safe JSONB, idempotency_key, timestamps. Unique provider transaction/event constraints as appropriate.
- `payment_webhook_events`: provider, event_key unique, payload_hash, received_at, processed_at, processing_status, safe_error.

### Kitchen and receipt
- `kitchen_tickets`: order_id unique, paid_at, operational_date, ticket_payload_snapshot JSONB, created_at. Active/history determined by operational close/history archive state or explicit `archived_at`.
- `kitchen_ticket_reads`: ticket_id, staff_profile_id, first_viewed_at; unique(ticket_id, staff_profile_id). Per-account BARU marker.
- `receipts`: order_id unique, receipt_token_hash unique, email_status, email_address nullable, email_attempt_count, email_sent_at, last_email_error, token_revoked_at, created_at.
- No production `print_jobs` in V1. Do not implement physical printer pipeline.

## 2. Status model

Keep order and payment status separate.

Suggested order status:
- `PENDING_PAYMENT`
- `PAID`
- `CANCELLED`
- `EXPIRED`

Suggested payment attempt status:
- `PENDING`
- `PAID`
- `FAILED`
- `EXPIRED`
- `CANCELLED`

Do not introduce kitchen preparation statuses in V1. A kitchen ticket exists only after successful payment.

## 3. Snapshot requirements

Order item snapshots must preserve menu name, category name, base/unit price, chosen variants, chosen add-ons, quantity, item note, and calculated line total. Order snapshot also preserves table number, voucher code/name/rule/discount, order note, totals, payment method and payment details. Historical views must not depend on current menu/category/template records.

## 4. Critical constraints and indexes

- Unique order number.
- Unique stable table code; table number unique and retired numbers never reused by service rule.
- Partial unique active session per table.
- Unique receipt/order; unique access token hash.
- Unique voucher reservation per order; unique redemption per order.
- Unique kitchen ticket per order.
- Unique staff read marker per ticket/account.
- Index orders by `operational_date`, `created_at`, `paid_at`, `order_number`, `table_id`.
- Index tickets by `operational_date`, `paid_at`.
- Index menus by `category_id`, `is_active`, `sort_order`.
- Index voucher code and validity.
- Index audit log by created_at and entity.

## 5. Implementation notes

This is a logical target model, not a substitute for reviewed SQL migrations. Choose exact enum/check constraints, delete behavior, generated columns, and RPC signatures during migration authoring. Prefer restrictive FK behavior for historical entities; use soft deactivation where history exists. Store token hashes, not raw customer access tokens.
