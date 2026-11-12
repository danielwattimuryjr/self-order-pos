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
- Empty cart confirmation; item removal confirmation at quantity zero.
- Checkout CTA disabled when restaurant closed, session invalid, or invalid cart items remain.

### Checkout/payment
- Customer name optional; order note optional.
- Optional email field at checkout; explain it is used to send the receipt after payment.
- QRIS large and scannable, amount, countdown, instructions, waiting indicator, cancel action.
- Payment status updated via Realtime; 5-second polling fallback.

### Confirmation/receipt
- Paid badge, order number, table, payment time/method, item snapshots, discount, total.
- Copy link, PDF download, and email retry/request when no automatic send succeeded.
- Pesan Lagi only if session active.

## 3. Admin pages

- Dashboard: KPI cards (omzet, paid orders, voucher discount, AOV), chart, top 10 menu, payment method summary, date filters.
- Pesanan: order list/detail, operational controls where authorized.
- Menu: category/menu list with drag/drop sorting; create/edit forms; image upload; active toggle.
- Menu detail: variant/add-on editor and templates.
- Voucher: list newest first, search code/name, create/edit, status and validity.
- Meja: list, add/edit/deactivate, download individual QR and all QR in PDF.
- Transaksi: read-only list and detail; order number search/date filter.
- Staf: create/update role/status; no plaintext password reveal after creation.
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
