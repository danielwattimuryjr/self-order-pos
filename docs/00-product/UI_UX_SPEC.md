# UI/UX Specification

## 1. Design principles

- Bahasa Indonesia only; responsive.
- Customer: mobile-first guided flow, no global navigation.
- Admin: desktop-first dashboard with responsive fallback.
- Staff: queue-first, high legibility, minimal interactions.
- Clear empty/loading/error/offline states.

## 2. Customer pages

### `/order/[tableCode]`
- Resolve table and session server-side.
- Catalog categories horizontal scroll; menus 2-column mobile grid.
- Sticky cart button.
- Closed state: catalog visible, add-to-cart disabled; show temporary close reason or next opening time.

### Menu selection bottom sheet
- Square image crop; name, description, base price.
- Variant group single-select; required indicator.
- Add-on group multi-select with min/max and per-option quantity.
- Quantity and optional note.
- Add button shows calculated line total.

### Cart
- Item rows with chosen variants/add-ons, notes, quantity controls.
- Price change notice and acceptance control.
- Voucher input and remove action.
- Subtotal, discount, total.
- Checkout collects optional customer name, order note, and receipt email; creating an order shows its order number, `PENDING_PAYMENT` status, total, and 15-minute payment deadline. QRIS/payment attempt UI is Phase 5.
- Empty cart confirmation; item removal confirmation at quantity zero.
- Checkout CTA disabled when restaurant closed, session invalid, or invalid cart items remain.

### Checkout/payment
- Customer name optional; order note optional.
- Optional email field at checkout; explain it is used to send the receipt after payment.
- QRIS large and scannable, amount, countdown, instructions, waiting indicator, cancel action.
- Payment status updated via Realtime; 5-second polling fallback.

### Confirmation/receipt
- Paid badge, order number, table, payment time/method, item snapshots, discount, total.
- Copy link and PDF download. Show email status and a retry action only when an address was supplied at checkout and delivery has not succeeded; never request or collect a new address on the receipt page.
- Pesan Lagi only if session active.

## 3. Admin pages

- Dashboard: KPI cards (omzet, paid orders, voucher discount, AOV), chart, top 10 menu, payment method summary, date filters. Date filters use `operational_date`; custom charts are daily through 31 days and weekly for longer ranges.
- Pesanan: all-payment-status order list/detail; Admin can cancel unpaid orders after provider verification and must choose a structured reason.
- Menu: category/menu list with drag/drop sorting; create/edit forms; image upload; active toggle.
- Menu detail: variant/add-on editor and templates.
- Template page: built-in/custom cards, search, category filter, sorting, preview, duplicate, save-from-menu, manual save, and apply modes.
- Voucher: list newest first, search code/name, create/edit, status and validity.
- Meja: list, add/edit/deactivate, download individual QR and all QR in PDF.
- Transaksi: read-only list and detail for all payment statuses; order number search/date filter using operational date. Staff has read-only access.
- Staf: invite by email, update role/status; invited users set their own password. No plaintext password reveal.
- Audit Log: immutable read-only history.
- Operating schedule: daily opening/closing time; temporary close/reopen.

## 4. Staff pages

- Queue: FIFO active tickets, visual NEW/BARU indicator, connection status, sound toggle/activation.
- Ticket detail: read-only; table, order number, paid time, customer name if supplied, item/qty/item note.
- History: grouped operational date; newest group/order first; search + table/date filters; 20/page.
- History detail: full read-only order and payment detail.
- Profile: name/email and password reset.

## 5. Interaction states

Every data-driven page must define loading, empty, error, forbidden, offline/reconnecting, and success feedback. Destructive actions require confirmation. Financial errors must not silently alter cart or order state.
