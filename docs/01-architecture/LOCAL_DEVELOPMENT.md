# Local Development Environment

## 1. Purpose

Dokumen ini menjelaskan standar environment pengembangan lokal QR Restaurant Ordering System V1. Tujuannya agar developer dapat menjalankan aplikasi dan layanan Supabase secara lokal tanpa bergantung pada database production.

## 2. Agreed setup

- Container runtime: Docker Desktop.
- Local Supabase: Supabase CLI.
- Database: PostgreSQL yang dijalankan oleh local Supabase stack.
- Auth, Storage, Realtime, dan Supabase API: layanan lokal yang dikelola Supabase CLI.
- Database schema changes: Supabase SQL migrations.
- Production backend services: hosted Supabase.
- Application deployment: Vercel.

Supabase CLI mengelola container local stack. Jangan membuat container duplikat untuk layanan Supabase yang sama melalui Docker Compose kecuali ada kebutuhan teknis yang disetujui. Docker Desktop harus berjalan sebelum local stack dinyalakan.

## 3. Prerequisites

Install dan siapkan: 

1. Node.js 24 (lihat `.nvmrc`; `package.json` menetapkan minimum 20.9).
2. npm 11.13.0 (ditetapkan melalui `packageManager` di `package.json`).
3. Docker Desktop, dalam keadaan running.
4. Supabase CLI, sebaiknya dijalankan melalui dependency/dev script proyek atau `npx supabase` agar versi CLI dapat dikendalikan.

## 4. Initialize and start Supabase

Jika folder `supabase/` belum diinisialisasi:

```bash
npx supabase init
```

Jalankan local stack:

```bash
npx supabase start
```

Perintah pertama dapat mengunduh image yang dibutuhkan dan memerlukan koneksi internet. Setelah stack berjalan, lihat URL dan key lokal dengan:

```bash
npx supabase status
npx supabase status -o env
```

Untuk menghentikan stack:

```bash
npx supabase stop
```

Jangan mengasumsikan port atau key lokal tanpa memeriksa output CLI dan konfigurasi `supabase/config.toml`. Default umum Supabase CLI mencakup API di `54321`, PostgreSQL di `54322`, Studio di `54323`, dan Inbucket di `54324`; nilai aktual dapat berubah jika konfigurasi proyek diubah.

## 5. Environment variables

Buat `.env.local` untuk aplikasi Next.js. Gunakan URL dan public anon/publishable key dari local Supabase CLI. Contoh nama variabel (sesuaikan dengan implementasi client/server di proyek):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
RESEND_API_KEY=<resend-development-key>
RESEND_FROM_EMAIL=<verified-sender-address>
MIDTRANS_SERVER_KEY=<midtrans-sandbox-server-key>
MIDTRANS_IS_PRODUCTION=false
```

Ketentuan keamanan:

- Nilai di atas hanya contoh nama dan URL; ambil key aktual dari `supabase status -o env`.
- Service-role/secret key hanya boleh digunakan di server dan tidak boleh memiliki prefix `NEXT_PUBLIC_`.
- `RESEND_API_KEY` dan `RESEND_FROM_EMAIL` hanya digunakan server-side untuk integrasi email struk.
- `MIDTRANS_SERVER_KEY` hanya digunakan server-side. Untuk pengembangan, gunakan server key sandbox; `MIDTRANS_IS_PRODUCTION` tetap `false`.
- Pengujian transaksi sandbox dapat ditunda sampai credential sandbox tersedia; automated tests dan SQL smoke test lokal tidak menghubungi provider.
- Jangan commit `.env.local`, key, token, atau secret ke Git.
- Jangan pernah menggunakan credential production untuk pengembangan lokal.

## 6. Database migrations and seed data

Buat migration baru:

```bash
npx supabase migration new <migration_name>
```

Simpan perubahan schema sebagai SQL migration di `supabase/migrations/`. Jangan mengandalkan perubahan manual di Studio sebagai satu-satunya catatan perubahan database.

Untuk membangun ulang local database dari migration dan seed yang dikonfigurasi:

```bash
npx supabase db reset
```

Untuk menerapkan migration yang belum diterapkan pada local database, gunakan perintah CLI yang sesuai dengan versi Supabase CLI proyek, misalnya:

```bash
npx supabase migration up
```

Seed data lokal dikelola melalui konfigurasi seed Supabase (umumnya `supabase/seed.sql`). Seed harus aman dijalankan ulang dan tidak boleh berisi data pribadi atau credential production.

### First Admin account

Public Auth signup is disabled. For the first local Admin, create a confirmed Auth user through the local Supabase Studio, then insert its profile into `public.staff_profiles` from the local SQL editor with `role = 'ADMIN'`. Use only local test identity data. Do not put passwords or service-role credentials in migrations or seed files. Subsequent Staff accounts must be provisioned by an authorized server-side Admin flow.

## 7. Run the application

Setelah local Supabase aktif dan `.env.local` disiapkan:

```bash
# Install dependencies menggunakan package manager proyek
# Lalu jalankan Next.js development server
npm run dev
```

Gunakan script yang benar-benar tersedia di `package.json`; jangan mengasumsikan nama script jika belum didefinisikan.

## 8. Local, staging, and production separation

| Environment | Application | Supabase | Purpose |
|---|---|---|---|
| Local | Local Next.js dev server | Local Supabase via Docker + CLI | Daily development and automated tests |
| Staging | Staging deployment | Separate staging Supabase project | Integration/UAT before release |
| Production | Vercel | Hosted production Supabase project | Live restaurant operations |

Local and staging must not share production credentials or production data. Production schema changes must be applied through reviewed migrations and a controlled release process.

## 9. Troubleshooting checklist

- Docker Desktop is running and has enough allocated resources.
- `npx supabase status` reports the expected services.
- Ports configured in `supabase/config.toml` are not occupied by another process.
- `.env.local` points to local Supabase, not production.
- The local database has been reset/applied after migration changes.
- If the stack is unhealthy, inspect `npx supabase status` and Docker container logs before deleting volumes or resetting data.

## 10. Non-goals and boundaries

- This decision does not mean Supabase must be self-hosted in production. Production V1 uses hosted Supabase.
- Docker Desktop is the local container runtime; Supabase CLI manages the Supabase local stack.
- Do not add a separate Express backend or a manually assembled Supabase Docker Compose stack for V1; the agreed application architecture uses Next.js Route Handlers and Supabase CLI.
