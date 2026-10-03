# Design Document: Deployment Hostinger Shared Hosting

- **Tanggal**: 2026-10-03
- **Topik**: Migrasi EasyLegal Email Portal ke satu Hostinger Node.js Web App
- **Status**: Disetujui pengguna — opsi “Satu Web App + staging”
- **Klasifikasi**: Critical — perubahan boundary deployment dan migrasi data produksi

## 1. Tujuan dan batasan

Deploy frontend Next.js 14 dan backend Express dalam satu Hostinger Node.js Web App tanpa mengubah domain produksi sebelum staging lulus verifikasi. Migrasi mencakup database SQLite, isi email yang tersimpan di `MessageCache`, attachment email, dokumen legal, dan storage aplikasi.

Batasan platform yang harus diterima:

- Hostinger Web App menjalankan satu proses publik pada `process.env.PORT`.
- Proses dapat dihentikan saat tidak ada request dan dihidupkan kembali oleh request berikutnya.
- Deployment mengganti isi `hbuilds/current`; database dan storage tidak boleh disimpan di direktori build.
- Node.js 22 dipakai karena didukung Hostinger dan sesuai dengan toolchain proyek.
- Sinkronisasi background tidak lagi dijamin berjalan tiap 15 detik saat aplikasi idle. Hostinger Cron menjadi pemicu terjadwal; sinkronisasi per mailbox tetap dapat dipicu dari aplikasi.

## 2. Arsitektur target

Satu entrypoint Node.js menangani satu port Hostinger:

1. Menjalankan sinkronisasi skema Prisma terhadap database persisten.
2. Menginisialisasi Prisma, akun administratif, worker, scheduler, Telegram, dan security monitor melalui lifecycle backend yang dapat dipanggil ulang.
3. Menyiapkan Next.js dari build produksi.
4. Mengarahkan `/api/*` dan `/health` ke Express.
5. Mengarahkan request lain ke Next.js.
6. Menutup HTTP server, worker, scheduler, bot, monitor, dan koneksi Prisma saat menerima `SIGTERM`/`SIGINT`.

Konfigurasi Hostinger:

| Field | Nilai |
|---|---|
| Framework | `Other` |
| Root directory | `/` |
| Node.js | `22` |
| Build script | `build:hostinger` |
| Entry file | `hostinger-entrypoint.cjs` |
| Output directory | kosong |

`build:hostinger` memasang dependency backend/frontend, menghasilkan Prisma Client, mengompilasi backend TypeScript, dan membangun frontend Next.js. Docker/Dokploy tetap memakai entrypoint dan compose yang ada.

## 3. Persistensi data

Data staging dipulihkan dari backup terverifikasi `emailportal-full-backup-20261003T032727Z.tar.gz.enc` ke direktori persisten di luar `hbuilds/current`:

```text
~/domains/<staging-domain>/data/prod.db
~/domains/<staging-domain>/storage/
```

Environment menggunakan path absolut:

```env
DATABASE_URL=file:/home/<hostinger-user>/domains/<staging-domain>/data/prod.db
STORAGE_DIR=/home/<hostinger-user>/domains/<staging-domain>/storage
```

Backup sumber memiliki bukti berikut:

- `PRAGMA integrity_check`: `ok`
- 43 customer
- 349 email; 349 memiliki body
- 126 record attachment; 126 file ditemukan
- 0 attachment hilang
- 0 ukuran attachment berbeda
- 127 dokumen legal

Restore staging memakai salinan. Backup asli bersifat immutable. Produksi VPS tetap aktif selama staging.

## 4. Background jobs pada shared hosting

Process sleep membuat timer in-process tidak cukup sebagai jaminan operasional. Desain memakai endpoint maintenance internal yang dilindungi `HOSTINGER_CRON_SECRET` dan dipanggil Hostinger Cron:

| Pekerjaan | Jadwal | Tindakan |
|---|---|---|
| Sinkronisasi mailbox | setiap menit | satu pass `SyncWorker.syncAll()`; overlap ditolak oleh guard worker yang sudah ada |
| Security scan | setiap menit | `runSecurityScan()` |
| Daily digest | `0 7 * * *`, `Asia/Jakarta` | `sendDailyDigest()` |
| Health/warm-up | setiap 5 menit | `GET /health` |

Telegram menggunakan webhook pada `/api/telegram/webhook`; `TELEGRAM_BOT_POLLING=false` mencegah long polling berganda setelah cold start.

Endpoint maintenance menolak request bila secret kosong atau salah, memakai perbandingan konstan, dan tidak mengembalikan data email. Kesalahan menghasilkan status non-2xx agar output Cron dapat dipakai untuk diagnosis.

## 5. Environment dan keamanan

Wajib sebelum startup:

- `NODE_ENV=production`
- `DATABASE_URL`
- `STORAGE_DIR`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `INITIAL_ADMIN_PASSWORD`
- `INITIAL_OFFICER_PASSWORD`
- `HOSTINGER_CRON_SECRET`
- `HOSTINGER_DOMAIN`
- `PORTAL_URL`
- `CORS_ORIGIN`

Integrasi opsional tetap memakai environment yang sudah ada: Hostinger Mail API, SMTP/IMAP, S3, 9router, Telegram, dan Synology runner.

Credential plaintext yang saat ini terdokumentasi di `Akses VPS.md` dan `docs/deployment/DOKPLOY_ENV.md` dianggap terekspos. Credential tersebut tidak disalin ke dokumen handoff atau paket deployment dan wajib dirotasi sebelum cutover produksi.

## 6. Alur staging dan cutover

### Staging

1. Buat satu Node.js Web App pada paket Business Web Hosting atau Cloud yang mendukung Web Apps.
2. Gunakan subdomain staging Hostinger; jangan ubah DNS `clienteasylegal.co.id`.
3. Upload source/archive atau hubungkan branch rilis.
4. Isi environment tanpa menyimpan secret di Git.
5. Buat direktori persisten, restore database dan storage, lalu deploy.
6. Tambahkan Cron dan webhook Telegram.
7. Jalankan verifikasi fungsional dan data.

### Cutover

Cutover hanya dilakukan setelah persetujuan eksplisit berdasarkan hasil staging:

1. Ambil backup delta/final produksi saat write dihentikan singkat.
2. Restore data final ke Hostinger dan ulangi pemeriksaan integritas.
3. Turunkan TTL DNS bila dikelola eksternal.
4. Arahkan domain produksi ke Web App Hostinger.
5. Verifikasi HTTPS, health, login, email, attachment, cron, dan webhook.
6. Pertahankan VPS lama tanpa write sebagai rollback window.

## 7. Rollback

Sebelum cutover, rollback berarti tetap memakai VPS karena DNS produksi belum berubah. Sesudah cutover, rollback dilakukan dengan mengembalikan DNS ke IP VPS dan membuka kembali write hanya setelah memastikan tidak ada data baru yang tertinggal di Hostinger.

Rollback aplikasi Hostinger memakai commit/source archive yang tervalidasi. Rollback data memakai backup final beserta checksum; database dan storage harus dipulihkan sebagai satu pasangan agar referensi attachment tetap konsisten.

## 8. Verifikasi dan acceptance criteria

Deployment staging dinyatakan lulus bila:

- Build Hostinger selesai dan proses berjalan pada satu port.
- `GET /health` memberi `200` setelah cold start dan warm request.
- SQLite `integrity_check=ok`.
- Jumlah customer, email, attachment, dan dokumen sama dengan manifest restore.
- Sampel email teks dan HTML dapat dibuka.
- Seluruh 126 attachment terpetakan ke file; sampel unduh cocok ukuran dan checksum.
- Login superadmin, officer, dan customer berhasil dengan password staging.
- Endpoint maintenance menolak secret salah dan menjalankan job dengan secret benar.
- Cron mencatat eksekusi sukses; Telegram webhook tidak menjalankan polling.
- Runtime log tidak memuat secret, crash loop, atau error database/storage.
- VPS produksi dan DNS produksi tidak berubah selama staging.
