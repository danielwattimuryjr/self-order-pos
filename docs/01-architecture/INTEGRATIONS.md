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
- Configure notification URL to webhook endpoint.
- Verify signature and transaction status server-side.
- Store provider transaction identifiers and safe metadata.
- Handle pending, settlement/capture success, deny/failure, expire, cancel, and delayed/duplicate notifications.
- Verify exact QRIS product/notification behavior and production credentials with merchant account before release.

## 3. Email provider

- Provider: Resend, selected for V1.
- Verify sender domain and DNS before production.
- The customer may provide an optional receipt email at checkout. A verified payment webhook triggers automatic delivery when an address exists; the receipt page supports customer request/retry if there is no successful send.
- Enforce one successful send per order; failed attempts can retry.
- Retry transient failures with bounded exponential backoff (up to 3 automated attempts is a recommended default); preserve failed state and allow customer retry.
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
- Use signed URLs or public read policy according to intended public catalog exposure; upload/delete Admin-only.

## 6. Printer

No physical printer integration in V1. Do not create print agent, print queue, thermal printer dependency, or pretend a print succeeded. Kitchen ticket is a digital view. Printer support is future scope and requires separate hardware/network decision.
