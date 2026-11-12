# Voucher & Promo

Admin membuat voucher diskon yang bisa dipakai pelanggan saat memesan.

## Spesifikasi

### Tujuan
Fitur ini ada agar admin bisa membuat kode promo diskon yang dapat dipakai pelanggan saat memesan, sehingga menarik minat beli sekaligus memberi keleluasaan promo tanpa ubah harga menu.
### Selesai bila
- Admin dapat membuat voucher dengan kode, jenis potongan (persen atau nominal), besar potongan, dan kuota pemakaian dari dashboard.
- Admin dapat melihat daftar voucher beserta kode, besar potongan, kuota terpakai, dan status aktif/tidak aktif.
- Voucher yang sudah dipakai atau lewat masa berlaku tidak bisa dipakai lagi oleh pelanggan.
- Pelanggan dapat memasukkan kode voucher di keranjang dan melihat potongan harga tercermin pada total sebelum mengirim pesanan.
- Total akhir yang harus dibayar pelanggan sudah memperhitungkan potongan voucher secara benar (tidak minus, sesuai batas minimum belanja bila diatur).

## Sub-fitur: Buat Voucher

Tentukan kode, besar potongan, dan kuota pemakaian sebuah voucher.

### Tujuan
Memungkinkan admin membuat kode promo diskon dengan besar potongan dan kuota pemakaian yang jelas, agar promo bisa dijalankan tanpa mengubah harga menu.
### Selesai bila
- Admin dapat mengisi kode voucher, memilih jenis potongan (persen atau nominal rupiah), besar potongan, dan jumlah kuota pemakaian, lalu menyimpan voucher.
- Voucher baru langsung muncul di daftar voucher dengan status aktif dan kuota terpakai 0.
- Admin dapat mengubah atau menonaktifkan voucher yang sudah ada dari daftar voucher.

## Sub-fitur: Atur Masa Berlaku

Tetapkan tanggal mulai dan berakhirnya sebuah promo.

### Tujuan
Memastikan setiap voucher hanya berlaku pada rentang waktu yang ditentukan admin, sehingga promo berjalan dan berhenti otomatis.
### Selesai bila
- Admin dapat menetapkan tanggal dan jam mulai serta berakhir sebuah voucher.
- Daftar voucher menampilkan masa berlaku dan status (belum mulai, berjalan, berakhir) secara jelas.
- Voucher yang di luar masa berlaku otomatis ditolak saat pelanggan memakainya.

## Sub-fitur: Pakai Voucher saat Pesan

Pelanggan memasukkan kode voucher dan potongan harga langsung terlihat.

### Tujuan
Agar pelanggan bisa memasukkan kode voucher di halaman pemesanan dan langsung melihat potongan harga sebelum mengirim pesanan.
### Selesai bila
- Pelanggan dapat memasukkan kode voucher pada halaman keranjang/pemesanan dan menekan tombol untuk memakainya.
- Bila kode valid, potongan harga tampil sebagai baris diskon dan total akhir berkurang sesuai besar potongan.
- Bila kode tidak valid, kadaluarsa, kuota habis, atau belanja belum mencapai minimum, muncul pesan alasan yang jelas dan total tidak berubah.

## Task

### 1. Bangun halaman daftar voucher admin dengan data tiruan

### 2. Buat form modal tambah dan edit voucher dengan mock

### 3. Tampilkan kolom masa berlaku dan status voucher di daftar

### 4. Bangun panel pakai voucher di halaman keranjang dengan mock

### 5. Buat tabel vouchers dan migrasi database

### 6. Buat API CRUD voucher untuk dashboard admin

### 7. Buat endpoint validasi dan hitung potongan voucher pelanggan

### 8. Integrasikan voucher ke pembuatan pesanan dan kuota terpakai
