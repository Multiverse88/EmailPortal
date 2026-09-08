# Email Portal Customer - Email Client Custom

Custom email client yang berjalan di atas domain & mail server Hostinger (Titan Mail). Customer bisa login dan mengelola inbox mereka sendiri.

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** Prisma — SQLite untuk dev, PostgreSQL untuk produksi
- **Search:** query SQL `LIKE` di message cache (Meilisearch ditunda, lihat catatan)
- **Storage:** filesystem lokal (`backend/storage`) untuk lampiran
- **E2E:** Playwright (35 test, desktop + mobile)

## Struktur Project

```
email-portal/
├── backend/          # Express API server
├── frontend/         # Next.js web app
├── shared/           # Shared types & utils
└── prisma/           # Database schema & migrations
```

## Setup (Development)

```bash
# Install dependencies
npm install

# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start services (requires Docker or manual setup)
# See DEPLOYMENT.md for full guide

# Run dev server
npm run dev
```

## API Endpoints

**Auth**
- `POST /api/auth/login/customer` — login customer
- `POST /api/auth/login/admin` — login admin
- `POST /api/auth/register` — admin membuat mailbox baru
- `POST /api/auth/change-password` — customer ganti password sendiri
- `GET  /api/auth/me` — profil customer aktif

**Mailbox (admin)**
- `GET    /api/mailboxes` — daftar mailbox + kuota
- `GET    /api/mailboxes/:id` — detail mailbox
- `POST   /api/mailboxes/:id/deactivate` | `/reactivate`
- `DELETE /api/mailboxes/:id` — soft delete
- `GET    /api/mailboxes/audit/logs` — audit trail

**Email (customer)**
- `GET    /api/email/folders` — folder + jumlah belum dibaca
- `GET    /api/email?folder=&q=&page=` — daftar/cari email
- `GET    /api/email/:uid` — buka email (HTML disanitasi)
- `POST   /api/email/send` — kirim (multipart, lampiran maks 5 × 10MB)
- `POST   /api/email/:uid/read` | `/star` | `/move`
- `DELETE /api/email/:uid` — ke Trash, atau hapus permanen bila sudah di Trash
- `GET    /api/email/attachment/:id/download`
- `POST   /api/search` — pencarian full-text

## Testing

```bash
npm run test:e2e        # Playwright, build + jalankan kedua server otomatis
npm run seed            # reset database ke data contoh
```

Akun contoh: `admin@clienteasylegal.co.id / Admin123!` dan `budi@clienteasylegal.co.id / Customer123!`

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
