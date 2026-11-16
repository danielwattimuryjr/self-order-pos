# Integrations

## 1. Supabase

- PostgreSQL for domain data and transactional invariants.
- Auth for Admin/Staff.
- Realtime for catalog updates, restaurant status, payment state, kitchen queue.
- Storage for menu images.
- Apply migrations in version control; do not rely on manual dashboard-only schema edits.
- Enable RLS and test policies with anon/authenticated/service roles.

## 2. Midtrans QRIS

- Server creates payment transaction; browser only displays QRIS/deeplink response safe for customer.
- The current adapter uses Midtrans's server-side HTTP API. Keep `MIDTRANS_SERVER_KEY` and `MIDTRANS_SIGNATURE_SECRET_KEY` server-only. Use a Server Key for Midtrans API authorization and the separate Signature Secret Key to verify notification signatures. `MIDTRANS_IS_PRODUCTION=false` selects the sandbox endpoint; production must be explicitly configured for a later release.
- Configure notification URL to webhook endpoint.
- Verify signature and refetch transaction status server-side before applying a notification.
- Midtrans dashboard URL-test notifications use a synthetic `payment_notif_test_` order ID. Verify their signature, acknowledge them without querying transaction status, and never mutate payment/order state for these probes.
- Store provider transaction identifiers and safe metadata.
- Handle pending, settlement/capture success, deny/failure, expire, cancel, and delayed/duplicate notifications.
- Before customer cancellation or local expiry, verify the provider status; request provider cancellation if still pending, then verify again. A confirmed settlement wins.
- Verify exact QRIS product/notification behavior and production credentials with merchant account before release.

## 3. Email provider

- Provider: Resend, selected for V1.
- Verify sender domain and DNS before production.
- The customer may provide an optional receipt email at checkout. A verified payment webhook makes exactly one automatic delivery attempt when an address exists. With no checkout email, no email is attempted and the receipt page does not collect an address.
- If automatic delivery fails, the customer may manually retry to the same checkout address. Enforce one successful send per order.
- Use a stable Resend idempotency key for each persisted attempt so an ambiguous network result can be reconciled without sending the same attempt twice.
- Preserve failed state and allow manual customer retry. Do not automatically retry the email from duplicate webhooks.
- Email failure never rolls back payment.

## 4. Realtime and fallback

- Subscribe only to channels/data allowed for current role/order token.
- On reconnect, refetch authoritative state and reconcile by stable IDs/timestamps.
- Payment page polls every 5 seconds only when realtime is unavailable.
- Queue must avoid duplicate tickets using unique order_id and idempotent upsert/insert semantics.
- Browser audio requires a user gesture; show “Aktifkan Suara” control.

## 5. Storage

- Supabase Storage bucket for menu images.
- Limit 2 MB; JPG/JPEG/PNG/WebP.
- Replace old image only after successful new upload and DB update.
- Bucket `menu-images` is public-read for catalog images; upload, update, and delete policies require an active Admin.
- The bucket and upload handler enforce the 2 MB JPEG/PNG/WebP limit. The application validates file signatures as well as MIME type.

## 6. Printer

No physical printer integration in V1. Do not create print agent, print queue, thermal printer dependency, or pretend a print succeeded. Kitchen ticket is a digital view. Printer support is future scope and requires separate hardware/network decision.
