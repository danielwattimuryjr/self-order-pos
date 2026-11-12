# Pesan Mandiri via QR

Pelanggan memindai QR di meja, memilih menu, dan mengirim pesanan sendiri tanpa lewat kasir.

## Spesifikasi

### Tujuan
Pelanggan dapat memesan sendiri dari ponsel setelah memindai QR meja, tanpa perlu antre atau lewat kasir.
### Selesai bila
- Pelanggan memindai QR meja dan langsung diarahkan ke menu restoran yang sesuai dengan meja tersebut.
- Pelanggan dapat memilih menu, mengatur jumlah, menambahkan catatan, dan melihat ringkasan pesanan sebelum mengirim.
- Pelanggan mengirim pesanan dengan satu tekan, lalu pesanan tercatat dan muncul di antrian staf/dapur lengkap dengan nomor meja dan detail menu.
- Setelah mengirim, pelanggan melihat konfirmasi pesanan berhasil dan dapat mengetahui status awal pesanannya.

## Sub-fitur: Scan QR Meja

Pindai kode QR di meja untuk langsung membuka menu restoran dari ponsel.

### Tujuan
Pelanggan dapat membuka menu restoran langsung dari ponsel dengan memindai QR yang tertempel di meja.
### Selesai bila
- Memindai QR meja membuka halaman menu restoran tanpa perlu membuat akun atau login.
- Halaman menu menampilkan nomor atau label meja yang sedang digunakan agar pelanggan yakin berada di meja yang benar.
- Bila QR tidak valid atau meja tidak aktif, pelanggan melihat pesan yang jelas dan arahan untuk menghubungi staf.

## Sub-fitur: Jelajah Daftar Menu

Lihat menu lengkap dengan foto, harga, dan kategori agar mudah memilih.

### Tujuan
Pelanggan dapat melihat menu lengkap dengan foto, harga, kategori, dan status ketersediaan agar mudah memilih.
### Selesai bila
- Menu tampil dikelompokkan per kategori dan nyaman dijelajahi dari layar ponsel.
- Setiap menu menampilkan nama, foto, harga, dan penanda tersedia atau habis.
- Menu yang ditandai habis tidak dapat ditambahkan ke keranjang dan alasannya terlihat jelas.

## Sub-fitur: Keranjang Pesanan

Kumpulkan pilihan menu, ubah jumlah, dan tambahkan catatan sebelum dikirim.

### Tujuan
Pelanggan dapat mengumpulkan pilihan menu, mengubah jumlah, dan menambahkan catatan sebelum pesanan dikirim.
### Selesai bila
- Pelanggan dapat menambahkan menu ke keranjang dan melihat daftar item beserta harga satuan dan totalnya.
- Pelanggan dapat mengubah jumlah atau menghapus item, dan total harga di keranjang ikut berubah.
- Pelanggan dapat menambahkan catatan untuk item atau pesanan, lalu melihat ringkasan pesanan sebelum mengirim.

## Sub-fitur: Kirim ke Dapur

Kirim pesanan sekali tekan agar langsung masuk ke antrian dapur dan tiketnya tercetak otomatis tanpa aksi staf.

### Tujuan
Pelanggan mengirim pesanan sekali tekan, lalu pesanan langsung masuk ke antrian dapur dan tiketnya tercetak otomatis, tanpa kasir dan tanpa aksi staf.

### Selesai bila
- Pelanggan mengisi nama dan email, menekan tombol kirim, lalu melihat konfirmasi bahwa pesanan berhasil dibuat.
- Pesanan yang dikirim muncul di antrian staf/dapur lengkap dengan nomor meja, nama pemesan, daftar menu, jumlah, dan catatan per menu.
- Pengiriman pesanan otomatis memicu cetak tiket dapur (lihat Cetak Struk Thermal); staf tidak perlu menekan tombol cetak atau memindahkan pesanan.
- Bila pengiriman gagal, pelanggan melihat pesan yang jelas dan isi keranjang tidak hilang.
- Pengiriman pesanan dibatasi rate limit per meja/per perangkat agar tidak terjadi spam pesanan ganda.

## Task

### 1. Buat halaman menu meja via QR

### 2. Buat tampilan error QR dan meja nonaktif

### 3. Buat state keranjang lokal dengan data tiruan

### 4. Buat panel keranjang ubah jumlah catatan

### 5. Buat halaman checkout dengan form dan ringkasan

### 6. Buat konfirmasi pesanan dan tampilan status awal

### 7. Buat skema meja, menu, pesanan, dan QR

### 8. Buat API resolusi QR meja

### 9. Buat API daftar menu publik per meja

### 10. Buat API pembuatan pesanan pelanggan

### 11. Buat API antrian pesanan staf dapur

### 12. Kirim email konfirmasi setelah pesanan dibuat

### 13. Terapkan rate limit pada API publik pesanan dan QR

Terapkan rate limit pada API publik yang tidak butuh login: resolusi QR meja, daftar menu per meja, pembuatan pesanan, dan struk via token. Gunakan pembatas berbasis IP + kunci (mis. Upstash Redis / tabel counter di Supabase) karena deploy serverless di Vercel. Kembalikan 429 dengan pesan ramah.

**Prompt:**

```
Buat modul rate limit di Next.js API layer untuk route publik (resolusi QR, daftar menu publik, pembuatan pesanan, struk via token). Gunakan sliding window per IP + per meja dengan store eksternal (Upstash Redis atau tabel counter Supabase). Batas contoh: 30 req/menit per IP untuk baca, 5 pesanan/menit per meja untuk pembuatan pesanan. Kembalikan HTTP 429 + Retry-After dan pesan berbahasa Indonesia.
```
