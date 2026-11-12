# Antrian Pesanan

Staf/dapur melihat antrian pesanan secara langsung tanpa perlu melakukan aksi apa pun.

## Spesifikasi

### Tujuan
Memberi staf/dapur satu papan antrian pesanan yang sifatnya hanya-baca (read-only): semua informasi yang dibutuhkan dapur langsung terbaca, tanpa ada input tambahan yang harus dilakukan staf.

### Selesai bila
- Papan antrian hanya menampilkan informasi: nomor meja, nama pemesan, waktu pesanan masuk, daftar menu beserta jumlah, dan catatan per menu.
- Tidak ada tombol atau aksi wajib bagi staf di papan antrian; seluruh pekerjaan staf selesai di layar kasir/dapur fisik (struk thermal).
- Pesanan baru muncul otomatis di papan tanpa staf memuat ulang halaman dan tanpa perlu mengubah status apa pun.
- Status pesanan berjalan otomatis (Diterima → Sedang Dibuat → Selesai) tanpa input manual, sehingga pelanggan tetap bisa memantau tahap pesanannya.
- Pencarian nomor meja/nama pemesan memakai debounce sehingga daftar menyempit setelah jeda ketik singkat, bukan sekali per ketukan.
- Endpoint antrian dibatasi rate limit agar tidak dibanjiri polling/realtime berlebih.

## Sub-fitur: Daftar Pesanan Masuk

Semua pesanan baru tampil berurutan dan hanya-baca: nomor meja, nama pemesan, menu, jumlah, dan catatan per menu.

### Tujuan
Menampilkan semua pesanan yang masuk ke restoran dalam satu daftar hanya-baca yang mudah dipantau staf/dapur, lengkap dengan identitas meja, pemesan, dan isi pesanannya.

### Selesai bila
- Pesanan baru muncul di daftar antrian secara langsung tanpa perlu memuat ulang halaman dan tanpa aksi staf.
- Daftar tersusun dari pesanan terbaru di atas dan setiap baris/kartu menampilkan nomor meja, nama pemesan, waktu masuk, serta daftar menu beserta jumlah.
- Catatan per menu tampil menempel pada item menunya (bukan catatan pesanan global) dan tetap terbaca saat catatan panjang.
- Tampilan murni informatif: tidak ada tombol ubah status atau aksi lain yang menuntut staf mengerjakan sesuatu di layar.
- Pesanan dikelompokkan/diberi penanda visual berdasarkan status otomatisnya (baru, sedang dibuat, selesai) dan pesanan selesai tidak menutupi pesanan baru.

## Sub-fitur: Status Pesanan Otomatis

Status pesanan berpindah otomatis tanpa input staf, sehingga antrian tetap murni informatif.

### Tujuan
Membuat status pesanan berjalan sendiri tanpa perlu disentuh staf, agar dapur dan pelanggan tetap tahu tahap pesanan meskipun antrian staf bersifat hanya-baca.

### Selesai bila
- Status berubah otomatis: "Diterima" saat pesanan masuk, "Sedang Dibuat" saat tiket dapur berhasil terkirim ke printer, dan "Selesai" setelah estimasi waktu penyajian atau saat struk kasir/bukti bayar diterbitkan.
- Tidak ada kontrol manual ubah status di antrian staf; status hanya bisa dibaca.
- Perubahan status otomatis tersimpan dan tampil konsisten di papan antrian maupun di halaman status pelanggan.
- Jika proses otomatis gagal (mis. tiket dapur belum tercetak), status tetap di "Diterima" dan staf bisa melihat penanda bahwa tiket perlu dicetak ulang, tanpa mengubah status manual.

## Sub-fitur: Notifikasi Pesanan Baru

Pemberitahuan muncul setiap ada pesanan baru agar tidak terlewat.

### Tujuan
Memberi pemberitahuan saat pesanan baru masuk agar staf segera menindaklanjuti tanpa melewatkan pesanan.
### Selesai bila
- Setiap pesanan baru memunculkan pemberitahuan yang dapat dilihat staf di dashboard.
- Pemberitahuan menunjukkan nomor meja atau nomor pesanan yang baru masuk.
- Pemberitahuan dapat ditandai sudah dibaca atau hilang setelah ditindaklanjuti, sehingga staf tahu mana yang masih perlu ditangani.

## Sub-fitur: Cari Pesanan

Temukan pesanan tertentu dengan cepat berdasarkan nomor meja atau nama pemesan, memakai debounce dan rate limit.

### Tujuan
Membantu staf menemukan pesanan tertentu dengan cepat saat antrian ramai, tanpa membebani server pada setiap ketukan tombol.

### Selesai bila
- Tersedia kolom pencarian pesanan berdasarkan nomor meja atau nama pemesan.
- Input pencarian memakai debounce (sekitar 300–400 ms) sehingga permintaan hanya dikirim setelah staf berhenti mengetik sebentar, bukan tiap karakter.
- Kata kunci disertakan ke parameter query endpoint antrian yang sudah ada (bukan endpoint baru) dan hasilnya menyempit dengan cepat.
- Endpoint pencarian dibatasi rate limit per sesi agar tidak disalahgunakan untuk scraping atau brute force.
- Bila tidak ada pesanan yang cocok, muncul pesan jelas bahwa pesanan tidak ditemukan dan staf dapat mengosongkan pencarian untuk kembali ke daftar lengkap.

## Task

### 1. Bangun halaman antrian pesanan dengan data tiruan

### 2. Tampilkan daftar pesanan masuk lengkap detail menu

### 3. Buat tampilan status hanya-baca pada kartu pesanan

Kartu pesanan di antrian menampilkan badge status otomatis (Diterima / Sedang Dibuat / Selesai) tanpa tombol aksi. Tidak ada kontrol ubah status yang bisa ditekan staf.

### 4. Buat panel notifikasi pesanan baru dengan data tiruan

### 5. Buat kolom pencarian meja dan nama pelanggan

### 6. Rapikan pembeda visual status dan pesanan selesai

### 7. Buat skema tabel pesanan dan item pesanan

### 8. Buat endpoint daftar antrian pesanan dengan filter

### 9. Buat service derivasi status pesanan otomatis

Ganti endpoint ubah status manual menjadi service internal yang menurunkan status pesanan: Diterima saat pesanan dibuat, Sedang Dibuat saat tiket dapur berhasil terkirim ke antrian cetak, Selesai setelah estimasi waktu penyajian atau saat bukti bayar terbit. Tidak diekspos sebagai endpoint publik/antrian.

### 10. Aktifkan realtime pesanan baru dan perubahan status

### 11. Buat endpoint notifikasi pesanan baru dan tandai dibaca

### 12. Terapkan debounce pada kolom pencarian antrian

Kolom pencarian antrian memakai debounce ~350 ms sebelum memanggil endpoint, plus pembatalan request lama (AbortController) agar hasil tidak balapan. Input langsung dari pengguna harus di-encode.

**Prompt:**

```
Implementasikan debounce pada kolom pencarian di halaman antrian pesanan (Next.js). Gunakan hook useDebouncedValue (~350 ms) plus AbortController agar request lama dibatalkan saat query berubah. Panggil endpoint antrian yang sudah ada dengan parameter q (nomor meja / nama pemesan). Tampilkan indikator loading singkat dan state "tidak ada pesanan cocok".
```
