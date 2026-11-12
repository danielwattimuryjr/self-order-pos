# Kelola Menu & Meja

Admin mengatur daftar menu, harga, meja, dan kode QR dari satu tempat.

## Spesifikasi

### Tujuan
Fitur ini memberi admin satu tempat untuk mengatur seluruh daftar menu (beserta foto, deskripsi, harga, kategori, dan status ketersediaan) serta daftar meja restoran lengkap dengan kode QR uniknya, sehingga menu yang dilihat pelanggan dan QR yang dipindai selalu akurat.

### Selesai bila
- Admin dapat menambah, mengubah, dan menghapus menu lengkap dengan foto, deskripsi, dan harga, dan perubahan langsung tercermin di tampilan menu pelanggan.
- Admin dapat mengelompokkan menu ke dalam kategori serta menandai menu yang habis, dan menu yang ditandai habis tidak bisa dipesan pelanggan.
- Admin dapat mengatur daftar meja (nomor dan label) sesuai jumlah meja nyata di restoran, dan meja yang dinonaktifkan tidak bisa dipakai memesan.
- Setiap meja memiliki kode QR unik yang dapat dibuat dan diunduh admin dalam bentuk gambar siap cetak.
- Semua data menu, kategori, dan meja hanya dapat diubah oleh admin/pemilik yang berhak, dan perubahannya tersimpan permanen.

## Sub-fitur: Tambah & Ubah Menu

Buat menu baru beserta foto, deskripsi, dan harganya.

### Tujuan
Memungkinkan admin membuat menu baru dan memperbarui menu yang sudah ada — termasuk foto, deskripsi, dan harga — agar daftar menu selalu sesuai dengan yang dijual restoran.

### Selesai bila
- Admin dapat menambah menu baru dengan nama, deskripsi, harga, dan foto, lalu menu tersebut langsung tampil di daftar menu pelanggan.
- Admin dapat mengubah nama, deskripsi, harga, dan foto menu yang sudah ada, dan perubahan langsung terlihat oleh pelanggan.
- Admin dapat menghapus menu yang tidak dijual lagi, dan menu tersebut hilang dari tampilan pelanggan.
- Harga ditampilkan dalam format rupiah yang mudah dibaca (contoh: Rp25.000).

## Sub-fitur: Atur Kategori & Ketersediaan

Kelompokkan menu dan tandai habis agar tidak bisa dipesan pelanggan.

### Tujuan
Memungkinkan admin mengelompokkan menu ke dalam kategori yang rapi serta menandai menu yang sedang habis, sehingga pelanggan melihat menu terorganisir dan tidak bisa memesan menu yang tidak tersedia.

### Selesai bila
- Admin dapat membuat, mengubah nama, mengurutkan, dan menonaktifkan kategori, dan urutannya tercermin pada tampilan menu pelanggan.
- Admin dapat menandai sebuah menu sebagai tersedia atau habis dengan satu aksi, dan menu yang habis tampil dengan penanda jelas serta tidak bisa ditambahkan ke keranjang pelanggan.
- Setiap menu terhubung ke satu kategori, dan perubahan kategori langsung mengubah pengelompokan menu di tampilan pelanggan.

## Sub-fitur: Daftar Meja

Atur nomor dan jumlah meja yang tersedia di restoran.

### Tujuan
Memberi admin kendali atas daftar meja restoran — nomor, label, dan status aktifnya — agar setiap meja yang ada benar-benar bisa menerima pesanan mandiri.

### Selesai bila
- Admin dapat menambah meja baru dengan nomor dan label, serta mengubah atau menghapus meja yang sudah ada.
- Admin dapat menonaktifkan meja sehingga QR meja tersebut tidak lagi bisa dipakai memesan.
- Daftar meja menampilkan status aktif/tidak aktif dan nomor meja tidak bisa ganda.

## Sub-fitur: Buat & Unduh QR Meja

Buat kode QR unik untuk tiap meja lalu unduh untuk dicetak.

### Tujuan
Membuat kode QR unik untuk setiap meja dan menyediakannya dalam bentuk gambar siap unduh, agar admin dapat mencetak dan menempelkannya di meja untuk dipindai pelanggan.

### Selesai bila
- Setiap meja memiliki kode QR unik yang dibuatkan oleh sistem dan mengarah ke menu restoran untuk meja tersebut.
- Admin dapat mengunduh gambar QR satu meja maupun beberapa meja sekaligus untuk dicetak.
- Hasil pindai QR meja membuka menu dengan identitas meja yang benar, dan QR pada meja yang dinonaktifkan tidak lagi berfungsi.

## Task

### 1. Bangun halaman admin kelola menu meja

### 2. Buat UI daftar dan form menu

### 3. Buat UI kategori dan ketersediaan menu

### 4. Buat UI pengelolaan daftar meja

### 5. Buat UI unduh QR meja satuan massal

### 6. Poles tampilan admin menu dan meja responsif

### 7. Buat skema database menu kategori meja

### 8. Terapkan otorisasi admin dan RLS Supabase

### 9. Buat API CRUD menu dan unggah foto

### 10. Buat API kategori dan status ketersediaan

### 11. Buat API CRUD meja dan validasi nomor

### 12. Buat layanan generate dan unduh QR

### 13. Buat endpoint publik menu berdasarkan QR
