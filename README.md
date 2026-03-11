# Library Management System (LMS)

Project **portfolio**: sistem perpustakaan modern untuk mengelola katalog multi-format (buku/ebook/media), transaksi peminjaman/pengembalian, denda, dan analytics.

Repo ini **bebas dipakai dan dimodifikasi** untuk kebutuhan belajar/portfolio/demo. Lihat `LICENSE`.

## Tech Stack
- Backend: Node.js + Express.js
- DB/Auth: Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- Frontend: EJS + Tailwind CSS
- Deploy: Vercel (serverless)

---

## Fitur Utama
- Auth & role: `admin` (pustakawan) dan `member` (peminjam) via Supabase Auth + RLS
- Katalog:
  - Browse + search + filter kategori (SSR)
  - Admin CRUD buku & kategori (SSR)
- Transaksi:
  - Checkout / check-in (atomic via Supabase RPC)
  - Due date otomatis + denda saat check-in (RPC)
- Dashboard:
  - Member: pinjaman aktif + riwayat
  - Admin: statistik ringkas + Top 5 buku paling sering dipinjam bulan ini
- Security hardening:
  - Auto-refresh session (via `sb-refresh-token`)
  - CSRF protection untuk semua web form POST
  - Rate limiting (auth + API)
  - Audit logging (console + optional DB table)

---

## Quick Start (Local)

### 1) Prerequisites
- Node.js 18+
- Akun + Project Supabase

### 2) Install
```bash
npm install
cp .env.example .env
```

Isi `.env`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `COOKIE_SECRET` (wajib untuk production, dan disarankan untuk dev)
- (optional) `SUPABASE_SERVICE_ROLE_KEY` (kalau mau audit log masuk DB)

### 3) Setup database (Supabase)
1. Supabase Dashboard → SQL Editor
2. Run `supabase/schema.sql`
3. (Optional) isi data contoh: run `supabase/seed.sql`

### 4) Jalankan app
```bash
npm run dev
```
Buka URL sesuai log terminal (default `http://localhost:3000`, atau set `PORT` di `.env`).

---

## Cara Pakai (Flow UI)

### Login/Register
- Register: `GET /register` → `POST /register`
- Login: `GET /login` → `POST /login`
- Logout: `POST /logout`

### Admin (Pustakawan)
1. Login sebagai admin
2. Tambah kategori: `GET /admin/categories`
3. Tambah buku: `GET /admin/books` → `+ Add Book`
4. Lihat transaksi: `GET /admin/transactions`
5. Lihat analytics: `GET /admin/dashboard`

### Member (Peminjam)
1. Login sebagai member
2. Buka catalog `GET /`
3. Klik **Checkout** pada buku yang tersedia
4. Lihat pinjaman aktif & riwayat: `GET /member/dashboard`
5. Klik **Check-in** untuk mengembalikan

---

## Bootstrap Admin (Open Source / Demo)

### Opsi 1 (recommended): admin via allowlist email
Tambahkan email kamu ke allowlist **sebelum** sign-up:
```sql
insert into public.admin_allowlist (email) values ('you@example.com')
on conflict (email) do nothing;
```
Lalu register pakai email itu → otomatis role `admin`.

### Opsi 2 (demo credentials): 1 admin account shared
Schema ini sudah menambahkan allowlist default: `admin@lms.local` (lihat `supabase/schema.sql`).

Penting: password **tidak disimpan** di database. Kamu harus membuat user ini di Supabase Auth sekali:
1. Supabase Dashboard → Authentication → Users → **Add user**
2. Email: `admin@lms.local`
3. Password: `Admin12345!`
4. Centang **Email confirmed**
5. Login via `/login`

Jangan pakai kredensial shared ini untuk production publik.

---

## Deploy ke Vercel

### Sebelumnya
1. Supabase schema sudah di-apply (`supabase/schema.sql`)
2. Kamu sudah punya admin
3. Tailwind akan di-build oleh Vercel (`vercel-build` → `npm run build:css`)

### Steps
1. Push repo ke GitHub/GitLab
2. Vercel → New Project → import repo
3. Build & Output Settings (kalau Vercel minta diisi):
   - Build Command: `npm run vercel-build`
   - Output Directory: *(kosongkan)*
   - Install Command: `npm install` *(atau kosongkan biar default)*
4. Set Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `COOKIE_SECRET` (random panjang)
   - (optional) `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy

Catatan:
- Express handler serverless: `api/index.js`
- Routing: `vercel.json`
- Kalau dapat 500 di Vercel, cek `GET /healthz` untuk memastikan env sudah terbaca.

---

## REST API (JSON)

Base URL: `/api`

Auth menggunakan Supabase JWT:
- Cookie auth: dari web login / API login (`sb-access-token`)
- Header auth: `Authorization: Bearer <access_token>`

### Auth
#### `POST /api/auth/login`
Body:
```json
{ "email": "member@example.com", "password": "password-min-8" }
```

#### `POST /api/auth/logout`

#### `GET /api/auth/me`

### Categories
#### `GET /api/categories`
#### `POST /api/categories` (Admin)
#### `PATCH /api/categories/:id` (Admin)
#### `DELETE /api/categories/:id` (Admin)

### Books
#### `GET /api/books?q=harry&category_id=1`
#### `POST /api/books` (Admin)
#### `PATCH /api/books/:id` (Admin)
#### `DELETE /api/books/:id` (Admin)

### Transactions
#### `POST /api/transactions/checkout` (Member)
#### `POST /api/transactions/checkin` (Member/Admin)
#### `GET /api/transactions/me` (Member)
#### `GET /api/transactions` (Admin)

### Admin Analytics
#### `GET /api/admin/analytics/top-books` (Admin)

---

## Database Schema (Ringkas)

SQL utama: `supabase/schema.sql`

Tabel:
- `auth.users` (Supabase Auth)
- `public.users` (profile + role, FK ke `auth.users`)
- `public.categories` → `public.books`
- `public.books` → `public.transactions`
- `public.transactions` (peminjaman/pengembalian + fine)
- `public.admin_allowlist` (bootstrap admin)
- `public.audit_logs` (opsional, untuk audit)

RPC (Postgres functions):
- `checkout_book(p_book_id, p_member_id, p_loan_days)` (atomic)
- `checkin_book(p_transaction_id, p_daily_fine)` (atomic)
- `top_borrowed_books(p_from, p_to, p_limit)` (analytics)

---

## Keamanan (Yang Sudah Diimplement)
- RLS aktif untuk tabel utama (lihat `supabase/schema.sql`)
- Auto-refresh session saat access token expired: `src/middleware/auth.js`
- CSRF protection untuk semua web form POST: `src/middleware/csrf.js`
- Rate limiting untuk auth dan API: `src/middleware/rateLimit.js`
- Audit logging (console + optional DB): `src/middleware/audit.js`

---

## Struktur Project
- `src/app.js` Express app
- `src/server.js` local server entry
- `src/routes/web.js` SSR routes (UI)
- `src/routes/api/*` REST API routes
- `src/views/*` EJS views
- `src/services/*` Supabase client(s)
- `src/middleware/*` auth/csrf/rate-limit/audit

---

## Troubleshooting

### Port conflict (EADDRINUSE)
Set `PORT=3001` di `.env` atau jalankan `PORT=3001 npm run dev`.

### Vercel 500 (Internal Server Error)
- Cek `GET /healthz` → pastikan `hasSupabase: true`
- Pastikan env Vercel ter-set di scope yang benar (Preview + Production)
- Untuk debugging sementara, set env `SHOW_ERROR_DETAILS=1` lalu redeploy (jangan aktifkan untuk production publik beneran)

### Admin tidak muncul
Pastikan row `public.users.role` = `admin` untuk email kamu:
```sql
select email, role from public.users order by created_at desc;
```

---

## Lisensi
MIT — bebas dipakai untuk portfolio, belajar, dan komersial. Lihat `LICENSE`.
