# EasyLegal Hub & Customer Email Portal

Platform terintegrasi layanan korporat dan custom email client bergaya Google Minimalist yang berjalan di atas domain & mail server Hostinger (Titan Mail). Pelanggan dapat mengelola email bisnis, repositori dokumen legal, tiket bantuan layanan, serta keamanan akun dalam satu ekosistem terpadu.

## Modul EasyLegal Hub

1. **✉️ EasyLegal Mail (`/inbox`)**
   - Webmail client minimalis Google-style dengan dukungan folder (Inbox, Terkirim, Draf, Sampah).
   - Pratinjau email HTML, penandaan bintang, pencarian instan, dan compose/balas/teruskan dengan lampiran hingga 10MB.
2. **📁 Legal Documents Drive (`/documents`)**
   - Repositori berkas legal korporasi (Perjanjian Kerjasama, SK Kemenkumham, Invoice, Bukti Bayar).
   - Modal interaktif **Document Preview** dengan visualizer berkas, pelacak riwayat versi (Version History Timeline), status dokumen (CONFIDENTIAL / Urgent Review), serta unduh berkas asli.
3. **🎫 Support Helpdesk (`/support`)**
   - Pusat bantuan pelanggan 24/7 dan FAQ accordion interaktif.
   - Thread percakapan tiket interaktif (Client bubble, Support Agent bubble, dan Catatan Internal tim berarsip aman) dengan dukungan penutupan tiket (Resolved) dan pengajuan tiket baru.
4. **⚙️ Account Settings & Security (`/settings`)**
   - **General**: Bahasa, zona waktu, dan editor tanda tangan email (Rich Signature) dengan pratinjau langsung.
   - **Profile**: Detail akun pelanggan, nama korporasi, dan ringkasan kuota mailbox.
   - **Security & Activity** (`/settings?tab=security`):
     - Sakelar autentikasi 2 faktor (Two-Factor Authentication / 2FA).
     - Formulir pembaruan kata sandi akun aman dengan kriteria password kuat.
     - Tabel audit riwayat aktivitas login perangkat (MacBook Pro, iPhone, Windows PC) dengan indikator sesi aktif saat ini.
     - Tombol darurat terminate all other sessions.
   - **Notifications**: Preferensi peringatan desktop dan bunyi notifikasi.
5. **🎛️ Google-Style App Launcher (9-Dots Popover)**
   - Akses navigasi cepat lintas aplikasi (Mail, Documents, Support, Settings) yang tersedia di header setiap halaman serta sidebar navigasi.

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS (Lucide Icons)
- **Database:** Prisma ORM — SQLite untuk dev/test, PostgreSQL untuk produksi
- **Search:** Query SQL `LIKE` di message cache & berkas
- **Storage:** Filesystem lokal (`backend/storage`) untuk lampiran email & dokumen legal
- **E2E & Integration:** Playwright (50 test case otomatis, desktop & mobile)
- **Backend Tests:** Jest (41 unit & integration test case)

## Struktur Project & Dokumentasi

```
email-portal/
├── docs/             # Dokumentasi sistem terstruktur per modul
│   ├── deployment/   # Panduan deployment (Dokploy, VPS, Docker, Nginx, SSL)
│   ├── infrastructure/# Arsitektur Hybrid Storage (S3 + Synology NAS) & retensi
│   ├── planning/     # Spesifikasi kebutuhan sistem & roadmap fitur
│   ├── smtp/         # Panduan setup SMTP & IMAP Hostinger Titan Mail
│   └── superpowers/  # Spesifikasi arsitektur modul & rencana pengembangan
├── backend/          # Express API server & routes (auth, email, documents, support, security, settings)
├── frontend/         # Next.js 14 web app & components (AppLauncher, DocumentPreview, TicketThread)
├── shared/           # Shared types & utils
└── prisma/           # Database schema (Customer, MessageCache, LegalDocument, SupportTicket, LoginSession)
```

### 📚 Indeks Dokumentasi

Setiap panduan dan spesifikasi telah dikelompokkan ke dalam folder masing-masing di bawah direktori `docs/`:

| Modul / Topik | Lokasi Folder & File | Ringkasan Konten |
|---|---|---|
| **Infrastruktur & Storage** | [`docs/infrastructure/`](docs/infrastructure/INFRASTRUCTURE.md) | Arsitektur Hybrid Storage (Hot S3 IDCloudHost + Cold Synology NAS), Lifecycle Rule 90 hari, dan integrasi tiket bantuan. |
| **Deployment & Server** | [`docs/deployment/`](docs/deployment/DEPLOYMENT.md) | Panduan instalasi dan deployment via Dokploy VPS, Docker Compose, manual installation, dan environment variables. |
| **Perencanaan & Requirement** | [`docs/planning/`](docs/planning/Planning-Development.md) | Analisis kebutuhan sistem, batasan fungsional (FR-01 s.d. FR-24), arsitektur modul, dan implementasi bertahap. |
| **Integrasi Mail (SMTP/IMAP)** | [`docs/smtp/`](docs/smtp/SMTP_SETUP_GUIDE.md) | Panduan langkah demi langkah konfigurasi mail server Hostinger Titan Mail untuk pengiriman dan penerimaan email. |
| **Spesifikasi Modul Hub** | [`docs/superpowers/`](docs/superpowers/specs/2026-09-08-easylegal-hub-modules-design.md) | Desain modul EasyLegal Mail, Legal Drive, Helpdesk Ticket, Security & Settings. |


## Setup (Development)

```bash
# Install dependencies
npm install

# Setup environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Seed database dengan data demo lengkap
npm run seed:demo

# Jalankan backend & frontend concurrently
npm run dev
```
Backend berjalan di `http://localhost:4000`, Frontend di `http://localhost:3000`.

## API Endpoints

**Auth & Profil**
- `POST /api/auth/login/customer` — Login customer
- `POST /api/auth/login/admin` — Login admin
- `POST /api/auth/register` — Admin membuat mailbox baru
- `POST /api/auth/change-password` — Customer ganti password sendiri
- `GET  /api/auth/me` — Profil customer aktif

**Security & Settings**
- `GET  /api/security/sessions` — Daftar sesi login aktif & riwayat perangkat
- `POST /api/security/2fa/toggle` — Aktifkan / nonaktifkan 2FA
- `POST /api/security/sessions/terminate-others` — Hentikan seluruh sesi selain yang aktif
- `GET  /api/settings` — Ambil profil dan konfigurasi preferensi customer
- `PUT  /api/settings/preferences` — Simpan preferensi bahasa, timezone, dan signature

**Legal Documents Drive**
- `GET    /api/documents` — Repositori dokumen legal, filter kategori & bintang, info kuota
- `GET    /api/documents/:id` — Detail dokumen beserta seluruh riwayat versi
- `GET    /api/documents/:id/download` — Stream unduh berkas asli dari storage
- `POST   /api/documents/upload` — Unggah dokumen baru (multipart FormData)
- `PATCH  /api/documents/:id/star` — Toggle bintang dokumen
- `DELETE /api/documents/:id` — Hapus dokumen beserta versinya

**Support Helpdesk**
- `GET  /api/support/tickets` — Daftar tiket bantuan customer
- `GET  /api/support/tickets/:id` — Thread percakapan tiket lengkap
- `POST /api/support/tickets` — Buat tiket bantuan baru
- `POST /api/support/tickets/:id/reply` — Balas pesan dalam thread tiket
- `POST /api/support/tickets/:id/close` — Tutup tiket sebagai selesai (resolved)

**Email & Mailbox**
- `GET    /api/email/folders` — Folder + jumlah belum dibaca
- `GET    /api/email?folder=&q=&page=` — Daftar / cari email
- `GET    /api/email/:uid` — Buka email (HTML disanitasi)
- `POST   /api/email/send` — Kirim email (multipart, lampiran maks 5 × 10MB)
- `POST   /api/email/:uid/read` | `/star` | `/move`
- `DELETE /api/email/:uid` — Ke Trash, atau hapus permanen
- `GET    /api/email/attachment/:id/download` — Unduh lampiran email

## Testing & Verifikasi

```bash
# Menjalankan 50 Playwright E2E tests (Desktop & Mobile)
npx playwright test

# Menjalankan 41 Jest backend tests
npm --prefix backend test

# Reset database ke data seed testing
npm run seed
```

**Akun Demo:**
- **Customer:** `budi@clienteasylegal.co.id` / `Customer123!`
- **Trial (14 Hari):** `trial@clienteasylegal.co.id` / `Customer123!`
- **Administrator:** `admin@clienteasylegal.co.id` / `Admin123!`

## Catatan implementasi

- **SQLite di dev.** Tidak ada Docker/Postgres di mesin ini. Ganti `provider` di
  `prisma/schema.prisma` ke `postgresql` untuk produksi; `recipients` dan
  `AuditLog.details` bisa kembali jadi `String[]` / `Json`.
- **Redis, Meilisearch, MinIO belum dipakai.** Pencarian pakai `LIKE`, lampiran
  ke disk lokal. Tambahkan saat korpus > ~100k pesan atau butuh multi-node.
- **SMTP/IMAP opsional.** Tanpa kredensial Hostinger, email terkirim tetap masuk
  folder Sent dan sync worker idle — jalur kode sama begitu kredensial diisi.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `MEILISEARCH_HOST` | Meilisearch endpoint |
| `MEILISEARCH_API_KEY` | Meilisearch admin key |
| `MINIO_ENDPOINT` | MinIO/S3 endpoint |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `HOSTINGER_API_KEY` | Hostinger Mail API key |
| `JWT_SECRET` | JWT signing secret |

## Architecture

- **Sync Worker** (background): IMAP IDLE/polling → PostgreSQL cache → Meilisearch index
- **API Server** (Express): REST API for frontend + auth
- **Frontend** (Next.js): Gmail-like UI, SSR for login/register pages

## Security

- Password mailbox dienkripsi (AES-256) sebelum disimpan
- JWT untuk session management
- Rate limiting di login endpoint
- HTML email disanitasi sebelum render
