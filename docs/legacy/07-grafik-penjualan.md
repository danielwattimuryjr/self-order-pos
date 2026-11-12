# Grafik Penjualan

Admin melihat tren penjualan dan menu terlaris lewat grafik sederhana.

## Spesifikasi

### Tujuan
Memberi admin/pemilik gambaran cepat performa penjualan restoran lewat grafik sederhana agar mudah memantau omzet dan menu favorit tanpa menghitung manual.

### Selesai bila
- Halaman grafik penjualan menampilkan total omzet dan jumlah pesanan pada periode yang sedang dipilih.
- Daftar menu terlaris tampil berurutan dari yang paling sering dipesan beserta jumlahnya.
- Admin dapat memilih rentang periode (hari/bulan) dan seluruh angka serta grafik ikut berubah sesuai pilihan.
- Nominal ditampilkan dalam format rupiah (mis. Rp1.250.000) dan jumlah pesanan berupa angka bulat.
- Bila belum ada data pada periode terpilih, halaman menampilkan pesan kosong yang jelas, bukan angka nol yang membingungkan.

## Sub-fitur: Ringkasan Penjualan Harian

Lihat total omzet dan jumlah pesanan pada hari itu.

### Tujuan
Menampilkan kondisi penjualan hari ini dalam sekali lihat agar admin langsung tahu performa harian.

### Selesai bila
- Kartu ringkasan menampilkan total omzet hari ini dalam format rupiah.
- Kartu ringkasan menampilkan jumlah pesanan hari ini sebagai angka bulat.
- Angka hanya menghitung pesanan yang sudah dibayar pada hari tersebut, dan tampil nilai awal yang wajar bila belum ada transaksi.

## Sub-fitur: Menu Terlaris

Ketahui menu yang paling sering dipesan pelanggan.

### Tujuan
Menunjukkan menu mana yang paling banyak dipesan agar admin tahu favorit pelanggan dan bisa mengatur persiapan bahan.

### Selesai bila
- Daftar/grafik menu terlaris diurutkan dari jumlah porsi terjual terbanyak.
- Tiap baris menampilkan nama menu dan jumlah porsi terjual.
- Bila belum ada penjualan pada periode terpilih, tampil pesan kosong yang jelas.

## Sub-fitur: Filter Periode

Pilih rentang hari atau bulan untuk melihat laporan penjualan.

### Tujuan
Memungkinkan admin melihat laporan penjualan pada rentang waktu tertentu, bukan hanya hari ini.

### Selesai bila
- Tersedia pilihan rentang periode (mis. hari ini, 7 hari terakhir, 30 hari terakhir, atau bulan tertentu).
- Mengubah periode langsung memperbarui angka ringkasan dan daftar menu terlaris tanpa memuat ulang halaman secara manual.
- Periode yang sedang aktif terlihat jelas pada tampilan sehingga admin tidak salah baca laporan.

## Task

### 1. Bangun halaman grafik penjualan dengan data tiruan

### 2. Buat kartu ringkasan omzet dan pesanan

### 3. Buat daftar menu terlaris terurut

### 4. Buat filter periode interaktif

### 5. Poles tampilan kosong dan format grafik

### 6. Buat service agregasi penjualan per periode

### 7. Buat endpoint ringkasan penjualan

### 8. Buat endpoint menu terlaris

### 9. Tambah index query analytics penjualan

### 10. Tangani respons periode tanpa data
