# QR Restaurant Ordering System — V1 Documentation

Dokumentasi ini menjadi acuan produk, business rules, desain, arsitektur, implementasi, dan quality assurance untuk QR Restaurant Ordering System V1.

## Struktur dokumentasi

### `00-product/` — Product requirements
- `PRD.md`: tujuan, scope, aktor, dan kebutuhan produk.
- `BUSINESS_RULES.md`: aturan bisnis yang telah disepakati.
- `USER_FLOWS.md`: alur pelanggan, Admin, dan Staff.
- `UI_UX_SPEC.md`: spesifikasi halaman dan perilaku antarmuka.
- Tambahkan `DESIGN.md` di folder ini jika proyek memiliki design system (warna, typography, spacing, komponen, dan aturan visual).

### `01-architecture/` — Technical architecture
- `ARCHITECTURE.md`: arsitektur aplikasi dan batas tanggung jawab.
- `DATABASE.md`: model data, relasi, constraints, snapshot, dan indeks.
- `API_SPEC.md`: kontrak API.
- `SECURITY.md`: autentikasi, otorisasi, RLS, dan perlindungan data.
- `INTEGRATIONS.md`: integrasi provider.
- `LOCAL_DEVELOPMENT.md`: Docker Desktop, Supabase CLI, environment variables, migration, dan local workflow.

### `02-quality/`
- `TESTING.md`: strategi pengujian dan acceptance criteria.

### `03-implementation/`
- `IMPLEMENTATION_PLAN.md`: urutan implementasi bertahap.

### `04-ai/`
- `AI_INSTRUCTIONS.md`: panduan kerja tambahan untuk AI coding agent.

### `reference/`
- `MASTER-DOCUMENTATION.md` dan `.pdf`: dokumen referensi gabungan. Dokumen spesifik di folder lain tetap menjadi acuan operasional untuk topik masing-masing.

### `legacy/`
Dokumen sumber/versi lama yang dipertahankan sebagai referensi historis, bukan sumber requirement terbaru jika bertentangan dengan dokumen yang sudah disepakati.

## Status keputusan

- **Agreed**: disetujui secara eksplisit.
- **Recommended default**: rekomendasi teknis untuk implementasi.
- **Assumption / verify**: perlu diverifikasi sebelum implementasi atau production.

Jika terjadi konflik, prioritaskan keputusan terbaru yang disetujui dan dokumen spesifik terkait. Jangan mengarang requirement yang belum diputuskan; ajukan pertanyaan atau tandai sebagai asumsi.

## Ringkasan environment

- Local development: Docker Desktop + Supabase CLI, seluruh Supabase local stack berjalan di mesin developer.
- Production: hosted Supabase.
- Application deployment: Vercel.
- Local development dan automated tests tidak boleh bergantung pada database atau credential production.
