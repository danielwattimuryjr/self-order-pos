# Business Rules — Final V1

Dokumen ini adalah sumber kebenaran aturan bisnis. Semua waktu menggunakan `Asia/Jakarta`.

## 1. Sesi meja dan QR

- Setiap meja memiliki stable ID dan QR URL permanen, misalnya `/order/TABLE-01`. QR tidak berubah ketika sesi berganti atau nomor meja diedit.
- Table code dibuat sebagai UUIDv4 acak, permanen dan tidak dapat diedit. Kode ini mengurangi tebakan kasual, tetapi bukan mekanisme otorisasi.
- Satu meja hanya boleh memiliki satu sesi aktif.
- Scan pertama membuat sesi jika belum ada; scan berikutnya bergabung ke sesi aktif yang sama.
- Satu sesi dapat memiliki banyak order independen. Setiap order memiliki pembayaran sendiri.
- Sesi timeout 60 menit. QR scan setelah sesi ditutup membuat sesi baru.
- Order lama dan struknya tetap dapat diakses setelah sesi berakhir.
- Backend memvalidasi sesi saat membuat order/checkout. Operasi create/close session harus atomic untuk mencegah dua sesi aktif.
- Keranjang tidak dibagikan antarperangkat. Keranjang lokal terikat pada device + meja + sesi.
- Jika sesi berakhir ketika pelanggan masih browsing, checkout ditolak dan pelanggan diminta scan ulang. Keranjang lama tidak dipindahkan ke sesi baru.
- Timer 60 menit menggunakan inactivity timeout yang diperbarui oleh aktivitas order/payment yang sah. Jangan perpanjang sesi hanya karena polling halaman.

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
- Email opsional ditawarkan saat checkout. Setelah webhook pembayaran terverifikasi, sistem otomatis mengirim struk ke alamat yang diberikan. Jika email tidak diberikan atau pengiriman otomatis gagal, pelanggan dapat meminta/mencoba ulang pengiriman dari halaman struk.
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
- Dalam satu menu, maksimal satu grup varian boleh memiliki opsi ber-mode `OVERRIDE`; grup lain dapat menggunakan `ADJUSTMENT`. Jika opsi `OVERRIDE` dipilih, nilainya menjadi harga dasar dan seluruh penyesuaian dari grup lain ditambahkan.
- Total item = harga dasar/hasil variant + total add-on, dikali quantity menu sesuai definisi kalkulasi server.
- Setiap perubahan config berlaku untuk order baru; order historis menyimpan snapshot.
- Konfigurasi varian/add-on dikelola dalam detail menu.
- Realtime memperbarui konfigurasi. Jika option dinonaktifkan ketika dipilih, hilangkan pilihan itu, beri notifikasi, hitung ulang, dan validasi ulang server-side.
- Perubahan harga variant/add-on memberi notifikasi; pelanggan harus menyetujui harga baru sebelum checkout.

## 8. Template varian/add-on

- Ada template bawaan (frontend config, read-only, tidak dapat diedit/dihapus) dan template custom (database).
- Template bawaan V1: `Level pedas` (Tidak pedas, Sedang, Pedas), `Tingkat gula` (Normal, Kurang manis, Tanpa gula), dan `Es batu` (Normal, Sedikit, Tanpa es). Ketiganya berupa grup varian opsional dengan harga penyesuaian Rp0. Tidak ada template add-on berbayar bawaan karena harga mengikuti menu.
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
- Operational hours: Admin mengatur satu jadwal jam buka/tutup yang sama setiap hari, mendukung overnight (mis. 10:00–02:00). Staff hanya melihat.
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
