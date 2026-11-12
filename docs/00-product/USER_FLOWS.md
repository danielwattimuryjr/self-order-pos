# User Flows

## 1. Customer flow

`Scan QR → Resolve table/session → Catalog → Menu detail sheet → Cart → Checkout validation → Create order → QRIS payment → Confirmation/receipt`

### Scan QR and session
- Resolve stable table ID from permanent QR.
- Reject inactive table with unavailable message.
- Join active session or create one atomically.
- Customer flow has no navbar/sidebar or free navigation between modules.

### Catalog
- Horizontal scroll category tabs.
- Mobile menu grid two columns.
- Sticky cart CTA at bottom.
- Category/menu order follows Admin `sort_order`.
- Realtime updates menu, price, availability, and restaurant status.
- Catalog remains visible when restaurant is closed; adding items is disabled.

### Menu detail
- Bottom sheet: image, name, description, price, variants, add-ons, quantity, per-item note, add button.
- Required variant/add-on constraints enforced in UI and server.
- Same menu + same note/config merges; different notes/configs remain separate lines.

### Cart
- Local per device and tied to table + session.
- Persist in localStorage; clear after successful checkout.
- Manual remove/empty cart with confirmation.
- Decrementing quantity from 1 to 0 asks confirmation.
- Voucher entry/removal and recalculated total.
- Price change requires explicit acceptance; unavailable items must be removed.

### Checkout and payment
- Optional customer name; optional order note.
- Optional email address is collected at checkout for automatic receipt delivery after verified payment; the customer may leave it blank.
- Server revalidates session, hours, menu/category, prices, variants, add-ons, voucher, quantities.
- Payment deadline 15 minutes from order creation.
- Refresh resumes same order/payment state.
- Cancel before paid only; server checks Midtrans before cancel.

### Confirmation
- Order number, table, item snapshots, subtotal, discount, total, method, payment time.
- Unique order token access; no login.
- Download PDF receipt; automatic email after payment when checkout email is provided, with customer retry/request available from the receipt page.
- Copy order link; Pesan Lagi if session remains active.

## 2. Admin flow

- Login → Sales Dashboard.
- Sidebar: Dashboard, Pesanan, Menu, Voucher, Meja, Transaksi, Staf, Audit Log.
- Meja: tambah, ubah nomor, aktif/nonaktif, dan unduh QR individual atau PDF semua meja. QR memakai UUIDv4 stabil.
- Pengaturan restoran: satu jadwal buka/tutup harian, tutup sementara dengan alasan, dan reopen dengan konfirmasi.
- Menu detail includes variant/add-on editor and template tools.
- Template management supports built-in/custom, categories, search/filter/sort, preview, apply modes, duplicate, save from menu, manual save, optimistic locking.
- Admin can configure operating hours and temporary close/reopen.
- Admin can cancel unpaid order with mandatory reason.
- Admin can manage staff accounts, but cannot change own role or deactivate own account.

## 3. Staff flow

- Login → Kitchen Queue.
- Navigation: Antrean Pesanan, Riwayat Pesanan, Profil Akun.
- Queue is read-only, FIFO by successful payment time.
- New tickets update through Realtime; sound requires explicit activation.
- Each Staff account has independent BARU markers.
- History supports search/filter/pagination and read-only details.
- Staff profile shows name/email; cannot edit name/email/role. Password reset via Supabase Auth.
