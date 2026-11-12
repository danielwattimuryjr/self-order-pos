# Akun & Akses Staf

Pemilik mengatur akun staf dan siapa saja yang boleh membuka dashboard.

## Spesifikasi

### Tujuan
Fitur ini ada agar pemilik restoran bisa menentukan siapa saja staf yang boleh masuk ke dashboard dan apa yang boleh mereka lakukan, sehingga operasional tetap aman dan terkontrol.

### Selesai bila
- Staf bisa masuk ke dashboard dengan email dan kata sandi, dan keluar kapan saja.
- Setiap staf hanya melihat menu dashboard yang sesuai perannya: pemilik, kasir, atau staf dapur.
- Pemilik bisa menambah akun staf baru, menonaktifkan akun, dan mengatur perannya dari satu halaman.
- Akun yang dinonaktifkan tidak bisa lagi masuk ke dashboard.
- Halaman kelola akun menampilkan daftar staf dengan nama, email, peran, dan status aktif/nonaktif.

## Sub-fitur: Masuk & Keluar Akun

Staf masuk dengan email dan kata sandi untuk membuka dashboard.

### Tujuan
Staf bisa masuk ke dashboard dengan email dan kata sandi, dan keluar dengan aman setelah selesai bertugas.

### Selesai bila
- Ada halaman masuk dengan kolom email dan kata sandi serta tombol masuk.
- Bila email atau kata sandi salah, muncul pesan kesalahan yang jelas dan staf tetap di halaman masuk.
- Setelah berhasil masuk, staf diarahkan ke dashboard sesuai perannya dan namanya terlihat di layar.
- Ada tombol keluar yang mengakhiri sesi dan mengembalikan staf ke halaman masuk.
- Akun yang sudah dinonaktifkan tidak bisa masuk dan mendapat pesan bahwa akun tidak aktif.

## Sub-fitur: Peran & Hak Akses

Bedakan wewenang pemilik, kasir, dan staf dapur.

### Tujuan
Membedakan wewenang pemilik, kasir, dan staf dapur agar tiap orang hanya bisa membuka bagian dashboard yang menjadi tugasnya.

### Selesai bila
- Ada tiga peran yang bisa dipilih saat mengatur akun: pemilik, kasir, dan staf dapur.
- Menu dashboard yang tampil menyesuaikan peran, misalnya kasir tidak melihat pengaturan akun staf dan staf dapur hanya melihat antrian pesanan.
- Bila staf membuka halaman di luar wewenangnya, muncul pesan bahwa ia tidak punya akses.
- Peran staf terlihat jelas di dashboard, misalnya di dekat nama pengguna.

## Sub-fitur: Kelola Akun Staf

Tambah atau nonaktifkan akun staf yang bertugas.

### Tujuan
Pemilik bisa menambah staf baru, mengatur perannya, dan menonaktifkan staf yang tidak lagi bertugas dari satu halaman.

### Selesai bila
- Ada halaman daftar akun staf berisi nama, email, peran, dan status aktif/nonaktif.
- Pemilik bisa menambah akun staf baru dengan mengisi nama, email, kata sandi awal, dan peran, lalu akun langsung muncul di daftar.
- Pemilik bisa mengubah peran staf yang sudah ada dan perubahannya langsung berlaku.
- Pemilik bisa menonaktifkan atau mengaktifkan kembali akun staf dengan satu tombol, dan statusnya langsung terlihat di daftar.
- Bila email yang dimasukkan sudah dipakai akun lain, muncul pesan kesalahan yang jelas.

## Task

### 1. Bangun halaman masuk dengan data tiruan

### 2. Bangun layout dashboard sesuai peran tiruan

### 3. Buat halaman akses ditolak dengan data tiruan

### 4. Bangun halaman daftar akun staf tiruan

### 5. Buat form staf tiruan dengan error email

### 6. Tambahkan aksi ubah peran staf tiruan

### 7. Tambahkan tombol aktif nonaktif akun tiruan

### 8. Buat skema tabel staf di Supabase

### 9. Buat migrasi dan seed pemilik awal

### 10. Implementasi login email dan kata sandi

### 11. Implementasi logout dan hapus sesi

### 12. Tolak login akun nonaktif dengan pesan

### 13. Buat middleware otorisasi berdasarkan peran

### 14. Sediakan endpoint profil pengguna aktif

### 15. Buat API daftar akun staf

### 16. Buat API tambah staf dengan validasi email

### 17. Buat API ubah peran dan status staf
