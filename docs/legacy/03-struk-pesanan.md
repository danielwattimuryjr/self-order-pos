# Struk Pesanan

Struk pesanan dikirim ke email pelanggan dan bisa dibuka di ponsel. Cetak thermal masih WIP: baru berupa alert/popup, dikerjakan di fase terakhir.

## Spesifikasi

### Tujuan
Memberi pelanggan bukti pesanan dan pembayaran yang bisa dibuka kapan saja, serta mengirimkannya otomatis lewat email. Cetak ke printer thermal ditetapkan sebagai fitur minor yang dikerjakan terakhir dan untuk sementara hanya ditandai WIP.

### Selesai bila
- Setelah pembayaran berhasil, struk digital otomatis terkirim ke email pelanggan dan status pengirimannya tercatat (terkirim/gagal).
- Bagian cetak thermal hanya menampilkan alert/popup "Fitur cetak thermal masih dalam pengembangan (WIP)"; tidak ada pencetakan ke printer nyata pada rilis ini.
- Pelanggan dapat membuka kembali struk pesanannya dari ponsel kapan saja dengan tampilan yang rapi di layar kecil.
- Struk memuat informasi yang jelas: nomor pesanan, nomor meja, daftar menu beserta jumlah dan harga, potongan voucher bila ada, dan total akhir.
- Bila pengiriman email gagal, sistem mencoba ulang dan kegagalannya terlihat oleh staf/admin.

### Di luar cakupan (backlog WIP)
Antrean cetak nyata, integrasi printer (cloud print atau print agent lokal), cetak tiket dapur otomatis, dan retry cetak thermal dikerjakan pada fase terakhir setelah pelanggan memutuskan perangkat/printer yang dipakai.

## Sub-fitur: Kirim Struk ke Email

Struk digital otomatis dikirim ke email pelanggan setelah pembayaran selesai.

### Tujuan
Memastikan pelanggan menerima bukti pembayaran digital di emailnya secara otomatis setelah pembayaran selesai, tanpa perlu meminta ke kasir.
### Selesai bila
- Struk terkirim otomatis ke email yang diisi pelanggan saat memesan, begitu pembayaran dinyatakan berhasil.
- Isi email menampilkan nomor pesanan, nomor meja, daftar menu dengan jumlah dan harga, potongan voucher bila ada, serta total akhir.
- Status pengiriman email tercatat dan dapat dilihat (menunggu, terkirim, atau gagal) beserta kesempatan kirim ulang bila gagal.

## Sub-fitur: Cetak Struk Thermal (WIP)

Fitur minor yang dikerjakan terakhir. Untuk sekarang hanya menampilkan alert/popup bahwa cetak thermal masih WIP — tidak ada pencetakan ke printer nyata.

### Tujuan
Cetak ke printer thermal kasir/dapur ditetapkan sebagai fitur minor yang dikerjakan paling akhir. Untuk sementara sistem hanya memberi tahu pengguna bahwa fitur ini masih dalam pengembangan (WIP), tanpa mencetak apa pun.

### Selesai bila
- Setiap titik yang menyentuh cetak thermal (status cetak di halaman struk, tombol cetak ulang, indikator antrean cetak) menampilkan alert/popup jelas: "Fitur cetak thermal masih dalam pengembangan (WIP)".
- Alert/popup bersifat informatif saja: tidak memblokir alur pesanan, pembayaran, maupun pengiriman struk ke email.
- Tidak ada job yang dikirim ke printer nyata. Pemicu cetak hanya mencatat log/penanda WIP, bukan mengirim ke perangkat.
- Tombol cetak ulang/manual tetap tampil tetapi nonaktif atau memunculkan popup WIP yang sama.
- Format tiket dapur dan struk kasir tetap disiapkan sebagai preview data tiruan: nomor meja, nama pemesan, waktu masuk, menu + jumlah, catatan per item ditonjolkan (tanpa harga) untuk tiket dapur; harga, potongan voucher, dan total untuk struk kasir. Tujuannya agar bisa diaktifkan nanti tanpa mengubah alur.
- Implementasi antrian cetak nyata, integrasi printer, retry, dan status cetak ditunda ke fase terakhir dan dicatat sebagai backlog WIP.

### Catatan teknis (untuk fase terakhir)
Server Vercel tidak dapat mengakses printer di jaringan lokal restoran. Nanti perlu salah satu: printer dengan cloud print (Star CloudPRNT / Epson ePOS-Print Server) atau print agent lokal di PC/mini-PC dapur yang menarik antrean cetak. Keputusan ini belum diambil dan tidak menghambat rilis sekarang.

## Sub-fitur: Lihat Struk di Ponsel

Pelanggan bisa membuka ulang struk kapan saja dari ponselnya.

### Tujuan
Memberi pelanggan akses ke struk pesanannya kapan saja dari ponsel, agar bukti pesanan dan pembayaran tidak hilang setelah layar ditutup.
### Selesai bila
- Pelanggan dapat membuka kembali struk pesanannya dari ponsel setelah pesanan dikirim, tanpa perlu login.
- Tampilan struk di ponsel rapi dan mudah dibaca di layar kecil, memuat nomor pesanan, nomor meja, daftar menu, potongan voucher bila ada, dan total akhir.
- Struk menampilkan status pesanan dan status pembayaran terkini saat dibuka.

## Task

### 1. Buat halaman struk publik dengan data tiruan

### 2. Buat komponen struk responsif untuk ponsel

### 3. Tampilkan status pesanan dan pembayaran

### 4. Buat panel status email struk

### 5. Buat tombol kirim ulang email mock

### 6. Tampilkan alert dan popup WIP pada status cetak thermal

Ganti isi halaman status cetak thermal menjadi penanda WIP: badge/label "WIP — dalam pengembangan" plus popup informatif saat pengguna membuka detail atau menekan tombol cetak ulang. Tidak ada aksi cetak nyata; teks menjelaskan bahwa cetak otomatis ke printer dapur/kasir menyusul di fase terakhir.

**Prompt:**

```
Buat halaman/komponen status cetak thermal yang menampilkan status WIP saja. Gunakan konstanta bersama mis. THERMAL_PRINT_WIP = true. Tampilkan badge "WIP" dan dialog/popup dengan pesan "Fitur cetak thermal masih dalam pengembangan (WIP)" ketika pengguna membuka detail cetak atau menekan tombol cetak ulang. Tombol cetak ulang nonaktif (disabled) atau hanya memunculkan popup yang sama, tanpa memanggil API cetak apa pun. Desain mengikuti komponen dialog/sheet yang sudah dipakai di halaman struk.
```

### 7. Buat preview struk thermal dengan data tiruan

### 8. Buat skema tabel struk dan log

### 9. Buat service snapshot data struk

### 10. Buat endpoint publik struk via token

### 11. Picu email dan struk kasir otomatis saat pembayaran berhasil

Webhook pembayaran berhasil memicu email struk dan antrean cetak struk kasir (harga, potongan voucher, total). Tiket dapur dipicu terpisah saat pesanan masuk.

### 12. Buat service kirim email struk otomatis

### 13. Buat endpoint kirim ulang email struk

### 14. Buat service antrian cetak thermal (fase terakhir - WIP)

Ditunda ke fase terakhir. Untuk sekarang service hanya menyiapkan antarmuka (enqueue/status) dengan implementasi no-op bertanda WIP; belum ada pengiriman ke printer cloud maupun print agent lokal.

**Prompt:**

```
Buat modul antrian cetak (mis. lib/print/queue.ts) dengan fungsi enqueueTicket(payload) dan getPrintStatus(). Implementasi awal no-op: catat log dengan flag WIP dan kembalikan status 'wip'. Jangan tambahkan dependensi printer apa pun. Sertakan komentar backlog untuk opsi Star CloudPRNT / Epson ePOS-Print Server atau print agent lokal yang polling antrean.
```

### 15. Buat endpoint status dan cetak ulang thermal (respons WIP)

Ditunda ke fase terakhir. Endpoint tetap ada agar UI tidak error, tetapi selalu mengembalikan status 'wip' beserta pesan bahwa fitur masih dalam pengembangan dan tidak memicu pencetakan.

**Prompt:**

```
Buat route GET /api/struk/[token]/cetak-status dan POST /api/struk/[token]/cetak-ulang yang selalu mengembalikan { status: 'wip', message: 'Fitur cetak thermal masih dalam pengembangan (WIP)' } dengan HTTP 200 (GET) dan 409 atau 200 (POST, tanpa efek samping). Tidak ada panggilan ke service printer.
```

### 16. Buat mekanisme retry gagal email (cetak thermal menyusul)

Fokus retry pada pengiriman email struk. Retry cetak thermal tidak diaktifkan karena fitur cetak masih WIP dan akan dibahas di fase terakhir.

**Prompt:**

```
Implementasikan antrean retry untuk pengiriman email struk (maksimum 3 percobaan, backoff eksponensial, status tercatat di tabel log struk). Jangan menyertakan logika retry cetak thermal; cukup komentar backlog bahwa retry cetak akan ditambahkan bersama aktivasi fitur thermal.
```

### 17. Siapkan antrian cetak tiket dapur (ditunda - WIP)

Ditunda ke fase terakhir sebagai backlog WIP. Saat pesanan tersimpan, cukup tulis log penanda "cetak tiket dapur diminta" tanpa mengirim job ke printer. Payload tiket (nomor meja, nama pemesan, waktu, menu + jumlah, catatan per item) tetap disusun agar siap dipakai ketika fitur diaktifkan.

**Prompt:**

```
Jangan implementasikan pengiriman ke printer. Setelah pesanan tersimpan, susun objek payload tiket dapur (nomor_meja, nama_pemesan, waktu_masuk, items[{nama, qty, catatan}]) lalu simpan sebagai log/record bertanda WIP. Bungkus seluruh pemanggilan di balik flag THERMAL_PRINT_WIP agar alur pembuatan pesanan tidak pernah gagal karena fitur ini.
```
