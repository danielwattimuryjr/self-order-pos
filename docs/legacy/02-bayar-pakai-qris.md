# Bayar Pakai QRIS

Pelanggan membayar pesanan langsung dari ponsel lewat QRIS tanpa antre di kasir.

## Spesifikasi

### Tujuan
Memungkinkan pelanggan membayar pesanan langsung dari ponsel lewat QRIS tanpa antre di kasir dan tanpa perlu konfirmasi manual dari staf.
### Selesai bila
- Setelah pelanggan mengirim pesanan, muncul halaman pembayaran yang menampilkan total tagihan dan pilihan cara bayar.
- Pelanggan dapat menampilkan kode QR pembayaran dan menyelesaikan pembayaran dari aplikasi e-wallet (GoPay, DANA, atau lainnya).
- Status pembayaran berubah menjadi "Dibayar" secara otomatis setelah pelanggan menyelesaikan pembayaran, tanpa tindakan staf.
- Pesanan baru masuk ke antrian staf/dapur hanya setelah pembayaran dinyatakan berhasil.
- Setelah berhasil, pelanggan menerima bukti pembayaran digital yang dapat dibuka kembali dari ponselnya.

## Sub-fitur: Pilih Metode Pembayaran

Tentukan cara bayar lewat QRIS, GoPay, DANA, atau dompet digital lain.

### Tujuan
Memberi pelanggan keleluasaan memilih cara bayar yang paling nyaman sebelum melanjutkan pembayaran.
### Selesai bila
- Halaman pembayaran menampilkan total tagihan dan daftar metode bayar yang tersedia (QRIS, GoPay, DANA, dan dompet digital lain).
- Metode yang sedang dipilih terlihat jelas (ditandai), dan pelanggan dapat melanjutkan dengan satu tekanan tombol.
- Bila hanya QRIS umum yang tersedia, metode tersebut tetap tampil sebagai pilihan utama tanpa membuat pelanggan bingung.

## Sub-fitur: Tampilkan Kode QRIS

Tampilkan kode QR pembayaran yang bisa dipindai aplikasi e-wallet pelanggan.

### Tujuan
Menampilkan kode QR pembayaran yang bisa langsung dipindai aplikasi e-wallet pelanggan.
### Selesai bila
- Kode QR tampil besar dan mudah dipindai, disertai nominal yang harus dibayar dan batas waktu berlakunya.
- Terdapat hitungan waktu mundur; saat waktu habis, kode ditandai kedaluwarsa dan tersedia tombol untuk menampilkan kode baru.
- Petunjuk singkat cara membayar (buka aplikasi e-wallet, pindai kode, konfirmasi) tampil di dekat kode QR.

## Sub-fitur: Konfirmasi Otomatis

Status pembayaran diperbarui sendiri tanpa perlu konfirmasi manual ke kasir.

### Tujuan
Memastikan status pembayaran diperbarui sendiri tanpa pelanggan atau kasir harus mengonfirmasi secara manual.
### Selesai bila
- Halaman pembayaran berubah sendiri dari "Menunggu Pembayaran" menjadi "Pembayaran Berhasil" tanpa pelanggan menekan apa pun.
- Bila pembayaran gagal atau kedaluwarsa, pelanggan melihat pesan yang jelas beserta pilihan untuk mencoba lagi.
- Status pesanan ikut diperbarui sehingga staf/dapur hanya melihat pesanan yang sudah benar-benar dibayar.

## Sub-fitur: Bukti Pembayaran

Pelanggan menerima bukti transaksi digital setelah pembayaran berhasil.

### Tujuan
Memberi pelanggan bukti transaksi digital yang bisa dilihat dan dibuka kembali kapan saja sebagai tanda pembayaran sah.
### Selesai bila
- Setelah pembayaran berhasil, pelanggan melihat halaman bukti pembayaran berisi nomor pesanan, nomor meja, metode bayar, waktu pembayaran, rincian menu, dan total yang dibayar.
- Bukti menampilkan status "Lunas" yang jelas dan dapat dibuka kembali dari ponsel pelanggan selama pesanan tersimpan.
- Bukti pembayaran juga tersedia dalam bentuk yang mudah dibaca ulang, misalnya untuk ditunjukkan ke staf bila diperlukan.

## Task

### 1. Bangun halaman pembayaran dengan data tiruan

### 2. Buat pemilihan metode bayar interaktif

### 3. Buat halaman kode QRIS dan hitungan mundur

### 4. Tambahkan status kedaluwarsa dan kode baru

### 5. Buat halaman status pembayaran otomatis

### 6. Bangun halaman bukti pembayaran digital

### 7. Sediakan akses ulang bukti dari riwayat

### 8. Rancang skema pembayaran dan migrasi

### 9. Integrasikan pembuatan transaksi QRIS Midtrans

### 10. Buat endpoint pembuatan pembayaran pesanan

### 11. Tangani webhook notifikasi pembayaran otomatis

### 12. Sediakan endpoint status pembayaran

### 13. Sediakan endpoint bukti pembayaran

### 14. Implementasikan kedaluwarsa dan regenerasi QRIS

### 15. Tandai status bayar tanpa menyembunyikan pesanan dari antrian dapur

Antrian dapur menampilkan semua pesanan yang masuk (termasuk yang belum terbayar) karena tiket dapur dicetak saat pesanan dikirim; status bayar hanya ditampilkan sebagai penanda, bukan filter yang menyembunyikan pesanan.
