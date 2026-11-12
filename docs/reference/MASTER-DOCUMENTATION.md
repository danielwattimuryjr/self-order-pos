# QR Restaurant Ordering System — Master Documentation

**Versi:** V1 | **Tanggal:** 11 November 2026 | **Zona waktu:** Asia/Jakarta



---

# Product Requirements Document (PRD)

## 1. Ringkasan

Sistem QR Restaurant Ordering System V1 memungkinkan pelanggan memesan dan membayar secara mandiri dari ponsel dengan memindai QR meja. Sistem mengurangi interaksi kasir, mengurangi kesalahan input, mengirim pesanan berbayar ke kitchen secara otomatis, dan memberi Admin kontrol atas menu, meja, voucher, staf, transaksi, serta performa penjualan.

**Target deployment:** satu outlet restoran di Jakarta. **Zona waktu:** Asia/Jakarta.

## 2. Tujuan produk

- Menghilangkan proses input pesanan dan pembayaran manual oleh kasir.
- Membuat pesanan masuk ke kitchen hanya setelah pembayaran terkonfirmasi.
- Meminimalkan interaksi Staff dengan aplikasi.
- Memberi pelanggan alur pemesanan yang sederhana tanpa login.
- Menyediakan data transaksi dan laporan yang konsisten serta dapat diaudit.

## 3. Aktor dan hak akses

### Pelanggan
Tanpa akun. Mengakses menu melalui QR meja dan halaman pesanan melalui token akses unik per order. Tidak dapat melihat pesanan pelanggan lain meskipun berada pada sesi meja yang sama.

### Admin
Login melalui Supabase Auth. Mengelola dashboard, menu, kategori, varian, add-on, template, voucher, meja, jam operasional, penutupan sementara, transaksi, pembatalan order unpaid, staf, laporan, dan Audit Log.

### Staff
Login melalui Supabase Auth. Melihat antrean kitchen, detail tiket, transaksi/order read-only, riwayat pesanan, serta profil akun. Tidak dapat mengubah transaksi, membatalkan pesanan, mengelola konfigurasi, atau melihat analitik penjualan.

Tidak ada role kasir atau kitchen terpisah. `STAFF` mencakup pekerjaan operasional yang sebelumnya disebut kasir/kitchen.

## 4. Scope V1

### Termasuk
- QR meja permanen dan pengelolaan meja.
- Sesi meja bersama lintas perangkat dan beberapa order independen.
- Katalog pelanggan berbentuk guided flow.
- Keranjang lokal per perangkat.
- Varian, add-on, catatan item, dan catatan order.
- Voucher dengan kuota/reservasi.
- Pembayaran QRIS melalui Midtrans.
- Konfirmasi order dan struk digital berbasis token.
- Pengiriman email struk secara opsional dan sekali sukses.
- Kitchen ticket digital, realtime, read-only.
- Riwayat order dan transaksi.
- Pengelolaan menu, kategori, template varian/add-on, staf, dan jam operasional.
- Dashboard omzet, transaksi, diskon, AOV, grafik, menu terlaris, metode pembayaran.
- Audit Log.

### Tidak termasuk
- Printer thermal fisik, print agent, cloud print, dan print job produksi.
- Refund otomatis atau integrasi refund Midtrans.
- Pelacakan stok bahan baku atau stok kuantitatif menu.
- Membership pelanggan atau customer account.
- Multi-outlet.
- Aplikasi native Android/iOS.
- Workflow kitchen untuk menandai preparing/ready/completed.
- Kasir manual atau pembayaran tunai di dalam aplikasi.

## 5. Alur utama

1. Pelanggan scan QR meja.
2. Server memvalidasi meja dan bergabung/membuat sesi meja aktif.
3. Pelanggan melihat katalog; keranjang disimpan lokal di perangkat.
4. Pelanggan memilih menu, varian, add-on, catatan, dan voucher.
5. Checkout memvalidasi ulang sesi, jam operasional, menu/kategori, harga, konfigurasi, dan voucher.
6. Server membuat order snapshot dan batas pembayaran 15 menit.
7. Server membuat transaksi QRIS Midtrans.
8. Pelanggan membayar. Webhook diverifikasi dan diproses idempotent.
9. Jika pembayaran sukses, order masuk ke antrean kitchen digital dan halaman konfirmasi tersedia.
10. Pelanggan dapat membuka struk/konfirmasi melalui token akses unik.

## 6. Kebutuhan non-fungsional

- Mobile-first pada alur pelanggan; desktop-friendly pada dashboard.
- Bahasa Indonesia.
- Otorisasi server-side untuk semua aksi sensitif.
- RLS Supabase sebagai defense-in-depth.
- Harga menggunakan integer rupiah atau `NUMERIC(precision,0)`; jangan gunakan floating point.
- Semua operasi finansial dan kuota menggunakan transaksi database/atomic RPC.
- Webhook, pembuatan order, dan efek samping harus idempotent.
- Realtime hanya mekanisme penyegaran UI; backend tetap sumber kebenaran.
- Audit trail untuk tindakan administratif penting.
- Server-side pagination/filtering untuk riwayat dan transaksi.

## 7. Kriteria sukses V1

- Order unpaid tidak pernah muncul di kitchen queue.
- Callback pembayaran duplikat tidak menggandakan order/tiket/kuota.
- Total yang dibayar selalu dihitung server-side.
- Pelanggan hanya dapat membuka order miliknya menggunakan token acak.
- Staff tidak dapat melihat laporan penjualan atau menjalankan aksi Admin.
- Perubahan menu tidak mengubah snapshot order historis.
- Staff dapat melihat tiket baru secara realtime tanpa refresh manual.
- Sesi meja, jam operasional, dan batas pembayaran konsisten di seluruh perangkat.



---

# Business Rules — Final V1

Dokumen ini adalah sumber kebenaran aturan bisnis. Semua waktu menggunakan `Asia/Jakarta`.

## 1. Sesi meja dan QR

- Setiap meja memiliki stable ID dan QR URL permanen, misalnya `/order/TABLE-01`. QR tidak berubah ketika sesi berganti atau nomor meja diedit.
- Satu meja hanya boleh memiliki satu sesi aktif.
- Scan pertama membuat sesi jika belum ada; scan berikutnya bergabung ke sesi aktif yang sama.
- Satu sesi dapat memiliki banyak order independen. Setiap order memiliki pembayaran sendiri.
- Sesi timeout 60 menit. QR scan setelah sesi ditutup membuat sesi baru.
- Order lama dan struknya tetap dapat diakses setelah sesi berakhir.
- Backend memvalidasi sesi saat membuat order/checkout. Operasi create/close session harus atomic untuk mencegah dua sesi aktif.
- Keranjang tidak dibagikan antarperangkat. Keranjang lokal terikat pada device + meja + sesi.
- Jika sesi berakhir ketika pelanggan masih browsing, checkout ditolak dan pelanggan diminta scan ulang. Keranjang lama tidak dipindahkan ke sesi baru.
- Catatan implementasi: aturan tepat kapan timer 60 menit di-reset perlu dipastikan konsisten di service; implementasi default adalah inactivity timeout yang diperbarui oleh aktivitas order/payment yang sah. Jangan perpanjang sesi hanya karena polling halaman.

## 2. Order dan pembayaran

- Order dibuat dengan status `PENDING_PAYMENT`; batas pembayaran 15 menit sejak order dibuat.
- Pelanggan dapat mencoba ulang pembayaran pada order yang sama selama masih valid; setiap percobaan merupakan payment attempt terpisah.
- Refresh halaman pembayaran tidak membuat order atau payment attempt baru.
- Setelah 15 menit, order expired setelah backend memeriksa status Midtrans untuk menghindari race/delayed webhook.
- Jika pembayaran sukses, order tidak boleh dibatalkan meskipun webhook datang terlambat. Server memverifikasi status ke Midtrans sebelum menerima cancel.
- Order hanya masuk kitchen queue setelah pembayaran sukses.
- Status pembayaran dan status order adalah dua konsep terpisah. Gunakan state machine yang eksplisit, jangan menggabungkannya.
- Webhook Midtrans diverifikasi, disimpan/deduplicated, dan diproses idempotent.
- Tombol “Saya sudah bayar” tidak disediakan.
- Payment page menampilkan QRIS, total, countdown, status menunggu, dan tombol batal. Countdown frontend hanya tampilan; server adalah sumber waktu.
- Realtime adalah jalur utama pembaruan status; polling fallback 5 detik jika Realtime tidak tersedia, berhenti pada state final.

## 3. Pembatalan

- Pelanggan dapat membatalkan order hanya sebelum pembayaran berhasil. Order dengan QR aktif tetapi belum dibayar boleh dibatalkan.
- Pembatalan pelanggan meminta konfirmasi. Jika pembayaran ternyata sukses, cancel ditolak dan pelanggan diarahkan ke halaman konfirmasi.
- Admin adalah satu-satunya role yang dapat membatalkan order unpaid.
- Admin wajib memilih alasan pembatalan: alasan terstruktur termasuk `Lainnya`; jika `Lainnya`, teks alasan wajib diisi.
- Catat actor, waktu, reason, dan perubahan pada Audit Log.
- Refund tidak tersedia di V1; penanganan refund dilakukan di luar aplikasi dan transaksi asli tidak diubah.

## 4. Konfirmasi dan struk

- Setiap order memiliki halaman konfirmasi/struk sendiri.
- Akses tanpa login menggunakan token acak kriptografis per order; jangan gunakan order number atau session token sebagai rahasia.
- Token dapat dicabut jika ada penyalahgunaan. Akses berlaku selama data order dipertahankan.
- Halaman menampilkan nomor order, meja, rincian item, qty, catatan, subtotal, diskon, total, metode dan waktu pembayaran.
- Tidak ada customer dashboard atau order history lintas order.
- Tombol “Pesan Lagi” kembali ke katalog pada sesi aktif; jika sesi habis, pelanggan diminta scan ulang QR.
- Struk dapat diunduh sebagai PDF tanpa email.
- Email opsional, hanya diminta ketika pelanggan memilih kirim struk.
- Email hanya boleh memiliki satu pengiriman sukses per order. Jika gagal, pelanggan dapat retry. Setelah sukses, tombol dinonaktifkan dan alamat email tidak dapat diganti.
- Email failure tidak mengubah status pembayaran.

## 5. Kitchen queue dan history

- Hanya pembayaran sukses menghasilkan kitchen ticket.
- Kitchen/Staff hanya melihat tiket; tidak ada aksi status preparing/ready/completed.
- Ticket diurutkan FIFO berdasarkan waktu pembayaran sukses.
- Ticket aktif tetap terlihat sampai waktu tutup operasional, lalu pindah ke history.
- History dikelompokkan berdasarkan operational date terbaru dahulu; order dalam kelompok terbaru dahulu.
- Ticket menampilkan nomor order, meja, waktu pembayaran, item, qty, catatan item, dan nama pelanggan jika tersedia. Tidak menampilkan harga, diskon, atau detail pembayaran pada active kitchen ticket.
- Detail tiket read-only. Membuka detail tidak mengubah ticket atau status.
- Label `BARU` per akun Staff, persisten lintas perangkat. Membuka ticket menghilangkan label hanya untuk akun itu.
- Saat ticket dipindah ke history, semua marker `BARU` dibersihkan.
- Saat halaman antrean pertama kali dibuka, ticket yang sudah ada dimuat tanpa suara. Suara hanya untuk ticket baru setelah halaman dibuka dan audio diaktifkan lewat interaksi pengguna.
- Audio dapat diaktifkan/dinonaktifkan. Visual indicator dan realtime tetap bekerja ketika audio mati.
- Jika koneksi putus, tampilkan “Koneksi Terputus”, lakukan reconnect, lalu sinkronisasi ulang antrean agar tidak ada ticket hilang/duplikat.
- History search mendukung exact/partial order number, filter meja, rentang tanggal; kombinasi filter boleh. Pagination server-side 20 order per halaman.
- History detail read-only dan menyimpan snapshot historis.

## 6. Menu, kategori, harga, dan foto

- Status menu hanya Active/Nonaktif; tidak ada stok angka.
- Kategori memiliki Active/Nonaktif. Kategori nonaktif menyembunyikan semua menu di dalamnya tanpa mengubah status menu. Mengaktifkan kategori kembali menampilkan menu yang masih aktif.
- Pelanggan hanya dapat menambahkan menu jika menu dan kategori aktif.
- Admin dapat mengurutkan kategori dan menu manual (drag/drop); simpan `sort_order`; urutan dibagikan ke semua pelanggan dan realtime.
- Kategori yang masih memiliki menu tidak dapat dihapus; pindahkan menu terlebih dahulu. Kategori dengan historical dependency hanya dapat dinonaktifkan. Rename tidak mengubah snapshot historis.
- Menu dapat dipindah kategori; status tetap. Default posisi di bagian bawah kategori target.
- Menu tanpa transaksi dapat dihapus. Menu yang memiliki transaksi historis hanya dapat dinonaktifkan.
- Menu order item menyimpan snapshot nama, kategori, harga, deskripsi relevan, varian/add-on, dan catatan.
- Perubahan harga berlaku langsung ke katalog. Jika harga berubah ketika item ada di cart, beri notifikasi dan wajibkan persetujuan harga baru. Backend validasi ulang saat checkout.
- Jika menu menjadi nonaktif saat ada di cart, item tersebut harus dihapus sebelum checkout; item valid lain tetap dipertahankan.
- Foto opsional; placeholder jika kosong. Supabase Storage; max 2 MB; JPG/JPEG/PNG/WebP; tampilan 1:1 object-fit cover. Ketika mengganti foto, hapus foto lama hanya setelah upload baru berhasil.

## 7. Varian dan add-on

- V1 mendukung variant groups, add-on groups, dan free-form item note.
- Variant group single-select; dapat required/optional. Menu dapat memiliki beberapa group.
- Add-on group multi-select; required/optional dengan min/max selection.
- Add-on option dapat memiliki quantity; harga = unit price × quantity.
- Variant pricing mendukung adjustment/additive atau override/base-price replacement. Add-on selalu menambah harga.
- Total item = harga dasar/hasil variant + total add-on, dikali quantity menu sesuai definisi kalkulasi server.
- Setiap perubahan config berlaku untuk order baru; order historis menyimpan snapshot.
- Konfigurasi varian/add-on dikelola dalam detail menu.
- Realtime memperbarui konfigurasi. Jika option dinonaktifkan ketika dipilih, hilangkan pilihan itu, beri notifikasi, hitung ulang, dan validasi ulang server-side.
- Perubahan harga variant/add-on memberi notifikasi; pelanggan harus menyetujui harga baru sebelum checkout.

## 8. Template varian/add-on

- Ada template bawaan (frontend config, read-only, tidak dapat diedit/dihapus) dan template custom (database).
- Template adalah preset; tidak ada relasi database antara template dan menu.
- Menerapkan template menyalin konfigurasi ke menu. Setelah disalin, konfigurasi menu independen.
- Template custom dapat dibuat dari awal atau dari konfigurasi menu yang ada; template menjadi salinan independen.
- Template dapat berisi varian saja, add-on saja, atau keduanya.
- Kategori template opsional dan terpisah dari kategori menu. Jika kategori dihapus, template menjadi Tanpa Kategori.
- Semua Admin dapat melihat, memakai, mengedit, dan menghapus semua template custom. Simpan created_by dan updated_by.
- Admin dapat menduplikasi template; nama baru wajib, tidak harus unik; kategori dapat dipilih ulang.
- Admin dapat preview sebelum apply.
- Apply menawarkan dua mode: (1) Ganti Seluruh Konfigurasi; (2) Ganti Berdasarkan Jenis, yaitu hanya jenis yang ada di template yang diganti.
- Apply ke menu dengan konfigurasi existing memerlukan konfirmasi.
- Menghapus template tidak mengubah menu yang sebelumnya menggunakannya.
- Validasi template: minimal satu group; setiap group minimal satu option; nama group/option wajib; harga >= 0; invalid template tidak bisa disimpan.
- Simpan manual. Navigasi keluar saat dirty meminta konfirmasi. Gagal simpan tidak boleh menimpa versi sebelumnya.
- Optimistic locking: jika template berubah oleh Admin lain, save ditolak dan Admin diminta reload.
- Template custom dan kategori template dicatat di Audit Log.
- Template yang sama boleh diterapkan ke banyak menu tanpa batas; setiap salinan independen.

## 9. Voucher

- Satu voucher maksimum per order.
- Discount type: percentage atau fixed amount.
- Dukung minimum transaction dan max discount cap.
- Validity mencakup start/end date dan start/end time WIB.
- Admin status Active/Nonaktif; Active tidak berarti selalu eligible.
- Pelanggan memasukkan kode manual pada cart/checkout; backend validasi dan mengembalikan alasan gagal.
- Voucher dapat dibatasi ke satu/lebih kategori. Jika kategori dipilih, diskon dan minimum transaksi dihitung hanya dari subtotal item kategori eligible. Jika tidak ada kategori dipilih, berlaku ke semua kategori.
- Max cap berlaku pada hasil diskon.
- Admin dapat edit voucher meskipun pernah digunakan; perubahan hanya berlaku untuk order baru. Historical order menyimpan snapshot.
- Voucher dengan usage history tidak dapat dihapus permanen; hanya dinonaktifkan. Tanpa history boleh dihapus.
- Saat order dibuat, satu quota reservation dipegang 15 menit. Jika paid, konsumsi quota; jika gagal/cancel/expired, release. Operasi harus atomic.

## 10. Transaksi, laporan, dan waktu operasional

- Omzet = jumlah aktual yang dibayar setelah diskon; hanya paid order.
- Metrics: omzet, jumlah paid order, total voucher discount, average order value.
- Filter: hari ini, kemarin, 7 hari, 30 hari, custom range.
- Chart per jam untuk hari ini/kemarin; per hari untuk rentang 7/30 hari; custom range menyesuaikan durasi.
- Top 10 menu berdasarkan quantity terjual, paid order saja, memakai snapshot name.
- Ringkasan metode pembayaran: revenue dan jumlah transaksi per metode yang benar-benar digunakan.
- Transaction history menampilkan order number, waktu bayar, meja, total paid, diskon voucher, payment method, payment status. Search order number dan date filter.
- Transaction detail read-only setelah paid.
- Staff boleh melihat order/transaction detail untuk operasi, tetapi tidak boleh melihat agregat/analytics/revenue dashboard.
- Operational hours: Admin mengatur jam buka/tutup sama setiap hari, daily schedule, mendukung overnight (mis. 10:00–02:00). Staff hanya melihat.
- Sebelum buka/setelah tutup, order baru tidak dapat dibuat. Order yang dibuat sebelum closing tetap mendapat payment window 15 menit.
- Operational date dimulai saat restoran buka. Order setelah midnight sebelum close tetap milik operational date sebelumnya.
- Order number format `ORD-DDMMYYNNN`, tanggal berdasarkan operational date, sequence atomic; minimum 3 digit dan melebar di atas 999.
- Admin dapat Tutup Restoran Sementara dengan reason: stok habis, gangguan operasional, darurat, lainnya (teks wajib untuk lainnya). Order baru diblokir; order existing tetap dapat dibayar.
- Reopen perlu konfirmasi, tanpa reason. Order baru hanya dapat dibuat jika masih dalam jam reguler. Temporary close auto-reset pada opening time berikutnya.
- Perubahan jam berlaku segera dan dicatat Audit Log.
- Dashboard status: Buka, Tutup Sementara, Di luar Jam Operasional.
- Catalog tetap terlihat saat tutup, tetapi tidak dapat menambah item/checkout. Temporary close menampilkan alasan; outside hours menampilkan next opening time.

## 11. Format tampilan

- Bahasa Indonesia.
- IDR tanpa desimal, contoh `Rp10.000`.
- Tanggal `DD/MM/YYYY`, waktu 24 jam.
- Meja tampil `Meja 01`, `Meja 02`, dst.
- Nama pelanggan opsional; email hanya jika memilih email struk.



---

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
- Email not asked unless customer selects email receipt.
- Server revalidates session, hours, menu/category, prices, variants, add-ons, voucher, quantities.
- Payment deadline 15 minutes from order creation.
- Refresh resumes same order/payment state.
- Cancel before paid only; server checks Midtrans before cancel.

### Confirmation
- Order number, table, item snapshots, subtotal, discount, total, method, payment time.
- Unique order token access; no login.
- Download PDF receipt; optional one-time successful email send.
- Copy order link; Pesan Lagi if session remains active.

## 2. Admin flow

- Login → Sales Dashboard.
- Sidebar: Dashboard, Pesanan, Menu, Voucher, Meja, Transaksi, Staf, Audit Log.
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



---

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
- Email collected only after explicit email receipt choice.
- QRIS large and scannable, amount, countdown, instructions, waiting indicator, cancel action.
- Payment status updated via Realtime; 5-second polling fallback.

### Confirmation/receipt
- Paid badge, order number, table, payment time/method, item snapshots, discount, total.
- Copy link, PDF download, optional email send once.
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



---

# Architecture

## 1. Recommended architecture

- **Web app + backend:** Next.js App Router and Route Handlers (no separate Express service in V1).
- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui.
- **Database:** Supabase PostgreSQL.
- **Auth:** Supabase Auth email/password for Admin and Staff.
- **Realtime:** Supabase Realtime for menu, queue, restaurant status, and payment UI updates.
- **Storage:** Supabase Storage for menu images.
- **Payment:** Midtrans QRIS.
- **Email:** transactional email provider (Resend recommended; verify account/domain configuration).
- **Hosting:** Vercel + Supabase.
- **Validation:** Zod schemas shared where appropriate between client and server.
- **Charts:** Recharts or equivalent.

## 2. Application boundaries

- Browser is untrusted. No totals, payment states, roles, or permissions are trusted from client payload.
- Route Handlers call domain services; domain services own rules and transaction boundaries.
- Database constraints/RPC protect concurrency-sensitive invariants.
- Provider integrations are isolated behind adapters (`payments`, `email`).
- Realtime events are notifications to refetch/patch UI, not authorization or proof of payment.

## 3. Suggested code organization

```text
src/
  app/
    (customer)/order/[tableCode]/...
    (auth)/login/...
    (admin)/dashboard/...
    (staff)/queue/...
    api/v1/...
  components/
    customer/ admin/ staff/ shared/
  lib/
    supabase/client.ts
    supabase/server.ts
    auth/authorization.ts
    validation/
    money/
    time/
    security/tokens.ts
    rate-limit/
  modules/
    orders/ payments/ sessions/ menu/ categories/
    variants/ templates/ vouchers/ kitchen/
    receipts/ tables/ staff/ analytics/ audit/
  services/
    midtrans/ email/
  types/
  tests/
supabase/
  migrations/
  seed.sql
```

## 4. Domain modules

Each module should expose typed service functions, schemas, and repository/data access. Route handlers should remain thin: authenticate/authorize, validate request, call service, map errors to HTTP responses.

## 5. Concurrency and transactions

Use database transactions or carefully designed Postgres RPC for:
- Create/join active table session.
- Generate operational order number.
- Create order with immutable item/price snapshots.
- Reserve voucher quota.
- Apply successful payment once and create one kitchen ticket.
- Cancel unpaid order after verifying payment state.
- Move tickets to history and clear all read markers at closing.
- Template optimistic-lock update.

Never rely on a sequence of independent client requests for financial atomicity.

## 6. Operational reliability

- Webhook idempotency key/provider event identity.
- Retry transient email failures with bounded exponential backoff; preserve failed state and allow user retry.
- Realtime reconnect + queue resync.
- Poll payment status every 5 seconds only as fallback; stop when final.
- Rate limit public endpoints and token-based receipt access.
- Structured logs with correlation IDs; do not log secrets or full sensitive provider payloads unnecessarily.

## 7. Decisions and assumptions

- One outlet only.
- No separate Express backend.
- Vercel serverless constraints: no local printer connectivity in V1.
- No print agent or print job production path. Kitchen ticket is a digital database-backed view.
- Verify Midtrans account capabilities, production callback settings, email sender domain, and Supabase plan limits before release.



---

# Database Design

Use UUID primary keys, `timestamptz` for instants, `NUMERIC(precision,0)` or integer rupiah for money, and explicit check constraints. All timestamps are stored as UTC instants; operational calculations/display use `Asia/Jakarta`.

## 1. Core tables (recommended logical model)

### Identity
- `staff_profiles`: `id`, `auth_user_id` unique FK to `auth.users`, `name`, `email`, `role` (`ADMIN|STAFF`), `is_active`, timestamps.
- `audit_logs`: actor staff ID, action, entity type/id, before/after JSONB, metadata JSONB, created_at. Append-only from application UI.

### Restaurant configuration
- `dining_tables`: stable UUID, immutable `table_code`/QR identifier, `table_number`, active flag, timestamps. Number unique and never reused after retirement.
- `restaurant_settings`: singleton config with `timezone='Asia/Jakarta'`, opening time, closing time, temporary close state/reason, updated_by.
- `table_sessions`: table_id, started_at, expires_at, closed_at, status. Enforce at most one active session per table with partial unique index.

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



---

# API Specification (Logical Contract)

All routes are versioned under `/api/v1`. Exact DTOs should be typed and validated with Zod. Use consistent response envelope:

```json
{ "status": "success", "message": "...", "data": {} }
```

Errors use appropriate HTTP status and stable error codes; never leak provider secrets or stack traces.

## Public customer endpoints

- `GET /tables/{tableCode}/catalog` — resolve active table/session context and return categories, active menus, variant/add-on config, operating status. Do not expose internal staff data.
- `POST /sessions/{sessionId}/orders` — validate session, hours, cart snapshots, menu/category active state, current prices/configuration, and voucher; create order and payment deadline atomically.
- `POST /orders/{orderId}/payment-attempts` — create/retry Midtrans payment attempt while order remains valid.
- `GET /orders/{orderId}/payment-status` — public-safe payment state via access proof or protected opaque identifier; do not expose guessable IDs alone.
- `POST /orders/{orderId}/cancel` — customer cancel unpaid order after server-side provider verification.
- `GET /receipt/{token}` — token-protected receipt/confirmation.
- `POST /receipt/{token}/email` — request one-time email send; enforce server-side one-success rule.
- `GET /receipt/{token}/pdf` — generate/download receipt PDF.
- `POST /vouchers/validate` — validate code against current cart; authoritative revalidation occurs during order creation.

## Provider webhook

- `POST /webhooks/midtrans` — verify authenticity/signature and provider status, deduplicate event, verify transaction status when necessary, atomically update payment/order, consume/release voucher reservation, create one kitchen ticket, and trigger receipt email workflow.

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



---

# Security Requirements

## 1. Authentication and roles

- Supabase Auth email/password for Admin and Staff.
- Exactly two application roles: `ADMIN`, `STAFF`.
- Admin creates Staff accounts. Passwords are never stored/displayed by application tables; use Supabase Auth secure admin APIs/server-side.
- Password policy: minimum 8 characters, letters and numbers; no symbol requirement.
- Forgot/reset password through Supabase Auth email flow.
- Session duration target: 7 days. Logout ends current device session. Multiple simultaneous devices allowed.
- Deactivating an account must revoke/deny access across all sessions; every protected request checks active profile status, not just stale JWT role claims.
- Admin cannot change own role or deactivate own account.

## 2. Authorization

- Server-side role checks on every protected route and server action.
- Staff may read queue/history/order/transaction details but cannot access analytics, mutate catalog, vouchers, tables, staff, templates, settings, or cancel orders.
- Admin-only analytics and management routes.
- RLS enabled on Supabase tables. Do not rely on hidden UI as access control.
- Service role key only on server; never expose to browser.

## 3. Customer order access

- Generate cryptographically random per-order token (high entropy).
- Store only token hash; show raw token only to the customer once as URL path/query secret.
- Never use order number, table code, or session ID as authorization secret.
- Rate limit token routes; use constant-time hash comparison where applicable.
- Allow token revocation.
- Customer token grants access only to that single order/receipt, never other orders in same table session.

## 4. Payment security

- Verify Midtrans notification signature and transaction status.
- Never trust browser redirect as proof of payment.
- Verify delayed webhook/race states directly with provider before cancellation/expiry decisions.
- Deduplicate webhook event and provider transaction IDs.
- Idempotently transition order/payment and create ticket exactly once.
- Do not log secrets, full raw tokens, or unnecessary personal/payment payloads.

## 5. Database and input security

- Use parameterized queries/Supabase query builder; validate with Zod.
- Enforce constraints at DB layer for money, quantity, statuses, uniqueness, and session invariants.
- Use atomic transaction/RPC for voucher quota, sequence generation, and payment transitions.
- Sanitize rendered user text; defend against XSS.
- Validate upload MIME/type/size; do not trust filename extension.
- Public endpoint rate limits per IP and relevant table/order token.

## 6. Audit Log

Record important events: login/logout, menu/category changes, price changes, variant/add-on changes, template/category changes, voucher changes, table changes, hours/temporary closure, order cancellation, staff account changes. Include actor, action, timestamp, entity, before/after values where relevant. Audit Log is append-only from UI and visible only to Admin.



---

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

- Recommended default: Resend or equivalent transactional email provider.
- Verify sender domain and DNS before production.
- Email is optional and user-triggered from receipt page.
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



---

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



---

# Implementation Plan

Build in vertical slices. Do not ask the coding agent to implement all modules in one prompt.

## Phase 0 — Foundation
- Initialize Next.js App Router + TypeScript + Tailwind + shadcn/ui.
- Configure Supabase local/dev/prod environments and migration workflow.
- Add lint, typecheck, test runner, env validation, logging, error envelope.
- Create server/client Supabase clients; protect service role key.

## Phase 1 — Auth, roles, and shell
- Supabase Auth login/logout/reset.
- Staff profile and roles ADMIN/STAFF.
- Server-side authorization and RLS baseline.
- Admin/Staff layouts and navigation.
- Seed first Admin securely.

## Phase 2 — Restaurant settings, tables, sessions
- Restaurant hours and timezone utilities.
- Table CRUD, stable QR URL/code, PDF downloads.
- Session creation/join/expiry and concurrency constraints.
- Temporary close/reopen and customer-facing state.

## Phase 3 — Catalog and customer flow
- Categories/menus CRUD, image storage, active states, sorting.
- Variants/add-ons and menu configuration editor.
- Built-in/custom templates, categories, preview, apply, duplicate, save-from-menu, optimistic locking.
- Public catalog and guided customer UI.
- Local cart persistence, validation, item/order notes.

## Phase 4 — Voucher and order creation
- Voucher CRUD and validation.
- Atomic quota reservation.
- Operational order number generator.
- Server-side checkout validation and immutable snapshots.
- Customer order token generation/hash storage.

## Phase 5 — Payments
- Midtrans adapter and QRIS creation.
- Payment attempts/retry/expiry.
- Webhook verification, dedupe, delayed status verification, idempotent paid transition.
- Customer payment UI, realtime + polling fallback, cancellation race protection.

## Phase 6 — Confirmation, receipts, kitchen queue
- Receipt/confirmation page via token.
- PDF receipt generation.
- Optional one-time email send and retry.
- Kitchen ticket creation only after payment success.
- Staff queue, sound activation, per-account BARU, reconnect/resync.
- Operational closing and history archive.

## Phase 7 — Transactions, Admin operations, analytics
- Transaction list/detail and read-only Staff access.
- Admin cancel unpaid order with reason and audit.
- Staff account management/deactivation.
- Audit Log UI.
- Dashboard metrics, chart, top menus, payment method summary.

## Phase 8 — Hardening and release
- Full E2E suite, security/RLS review, load/concurrency tests.
- Midtrans sandbox acceptance and production checklist.
- Email domain verification, rate limiting, observability, backups.
- Deploy staging, UAT, then production.

## Release gates

Do not enable live payment until webhook signature verification, idempotency, delayed notification handling, and reconciliation tests pass. Do not launch customer ordering until session/closing rules and server-side checkout validation pass. Do not launch Staff queue until reconnect/resync and per-account read markers pass.



---

# AI Coding Agent Instructions

You are implementing QR Restaurant Ordering System V1. Read all project documents before coding. `BUSINESS_RULES.md` is the authoritative source for business behavior.

## Non-negotiable rules

1. Do not invent product behavior. If a requirement is ambiguous, state the ambiguity and propose a default; do not silently implement a guess.
2. Do not contradict approved business rules. If legacy code/docs conflict, follow current docs and explain the reconciliation.
3. Do not build the entire application in one pass. Follow `IMPLEMENTATION_PLAN.md` phase by phase and work in small, reviewable vertical slices.
4. Before editing, inspect the existing repository, package manager, conventions, and current implementation. Do not overwrite working patterns without reason.
5. Use Next.js App Router + Route Handlers. Do not create a separate Express backend.
6. Use TypeScript strict typing, Zod validation, server-side authorization, Supabase RLS, and migrations in version control.
7. Backend/database are the source of truth for money, order state, payment state, voucher quota, session validity, and access control.
8. Never trust client-submitted price, discount, role, payment success, or order totals.
9. Use integer rupiah or NUMERIC with zero scale; never use floating point for money.
10. Use atomic database operations for session uniqueness, order sequence, voucher reservation, payment transitions, and ticket creation.
11. Payment webhook must be verified, deduplicated, and idempotent. A successful payment creates exactly one kitchen ticket.
12. Do not expose Supabase service role or provider secrets to the browser.
13. Customer order access uses a cryptographically random per-order token; store token hash, not raw token.
14. Historical orders use snapshots and must not change when catalog/templates/vouchers are edited.
15. Staff has read-only operational access; no kitchen status workflow, no Admin analytics.
16. No physical printer, print agent, print jobs, or fake print success in V1.
17. All operational date/time logic uses `Asia/Jakarta`.
18. Add tests for concurrency, money, payment, authorization, and state transitions.

## Working protocol for each task

1. Summarize the requested slice and relevant acceptance criteria.
2. Inspect relevant files and dependencies.
3. Propose a concise implementation plan.
4. Implement only the agreed slice.
5. Add/update migrations and tests.
6. Run lint, typecheck, and relevant tests.
7. Report changed files, behavior, commands run, results, and remaining risks.
8. Do not claim a command/test passed unless it was actually run.

## Code quality

- Keep route handlers thin; put business logic in domain services.
- Prefer explicit state machines and discriminated unions.
- Use stable error codes and consistent response envelopes.
- Handle loading/empty/error/forbidden/offline states.
- Avoid duplicate sources of truth.
- Keep components accessible and responsive.
- Avoid unnecessary abstraction and speculative dependencies.
- Keep environment variables documented in `.env.example`; never commit secrets.

## First task

Start with Phase 0 only. Inspect the repository and produce a proposed foundation plan. Do not begin Phase 1 until the foundation is reviewed and verified.
