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
