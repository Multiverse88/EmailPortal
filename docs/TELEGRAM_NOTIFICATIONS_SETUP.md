# Panduan Integrasi Bot Telegram EasyLegal (Rangkuman Harian 07:00 WIB & AI Chatbot Website)

Dokumen ini menjelaskan tata cara penyiapan, konfigurasi, dan pengoperasian **Bot Telegram EasyLegal** untuk:
1. Pemantauan harian sistem & keamanan website setiap pukul **07:00 WIB**.
2. Notifikasi *real-time* tiket bantuan (*support ticket*) klien.
3. **AI Chatbot Asisten Interaktif 24/7** untuk menanyakan segala kondisi, transaksi, atau aktivitas di website langsung lewat obrolan Telegram.

---

## 1. Fitur Utama

### 🌅 A. Rangkuman Harian Otomatis (Daily Digest) - Pukul 07:00 WIB
Dijalankan otomatis oleh worker `backend/src/workers/scheduler.ts` setiap pagi pukul 07:00 WIB (`0 7 * * *` zona waktu `Asia/Jakarta`):
- **Kesehatan Webmail & Server**: Status operasional portal, sync cluster Titan Mail (IMAP 993/SMTP 465), total mailbox aktif/nonaktif, dan antrean email di cache.
- **Radar Keamanan & Anomali**: Sesi login aktif, deteksi multi-IP login, log audit 24 jam terakhir, dan status isolasi in-memory zero-leakage.
- **Kapasitas Penyimpanan & Retensi**: Penggunaan hot storage S3 (IDCloudHost), jumlah berkas di Legal Drive, koneksi ke cold storage Synology NAS, dan pengawasan retensi 90 hari.
- **Pusat Tiket Support Klien**: Jumlah tiket terbuka (open), tiket berkategori mendesak (*urgent < 4 jam SLA*), dan tiket yang telah terselesaikan (*resolved*).

### 🤖 B. Asisten AI Chatbot Telegram Interaktif (Kondisi & Transaksi)
Super Admin dapat berinteraksi dua arah langsung dengan bot di Telegram. Bot didukung oleh engine AI (9router API / Smart Heuristic Local Fallback) dengan akses langsung (*live snapshot*) ke database website:

1. **Pertanyaan Bahasa Alami (Natural Language)**:
   - *"Bagaimana kondisi server dan website hari ini?"*
   - *"Ada transaksi atau aktivitas apa saja barusan?"*
   - *"Apakah ada tiket support yang urgent?"*
   - *"Berapa kapasitas penyimpanan S3 yang tersisa?"*
   - *"Siapa saja pengguna yang login hari ini?"*
2. **Perintah Cepat (Slash Commands)**:
   - `/start` atau `/help`: Panduan ringkas penggunaan bot AI.
   - `/status`: Kartu live kondisi portal, database, cluster Titan, uptime, dan RAM.
   - `/kegiatan` atau `/transaksi`: Daftar aktivitas terbaru (audit log, upload dokumen, korespondensi).
   - `/tiket`: Rincian seluruh tiket bantuan aktif yang belum selesai beserta SLA.
   - `/keamanan` atau `/radar`: Sesi login aktif, anomali multi-IP, dan status proteksi.
   - `/storage`: Kapasitas Hot S3 IDCloudHost dan Cold Storage Synology NAS.
   - `/ringkasan`: Memicu pengiriman laporan harian komprehensif seketika.

### 🎫 C. Notifikasi Real-Time Tiket Support Baru
- Terkirim dalam hitungan detik saat klien membuat tiket melalui portal `/support`.
- Rincian mencakup: Nomor Tiket (`#TK-XXXX`), Label Prioritas (Normal / Urgent), Kategori, Nama Klien & Alamat Mailbox Resmi, Subjek, serta cuplikan pesan awal.
- Tautan langsung ke konsol Super Admin.

### 🎛️ D. Panel Kontrol Terpadu di Super Admin Desk (Frontend)
- Status koneksi bot (*Bot & AI Chat Siaga* vs *Belum Dikonfigurasi*).
- Tombol **"Tes Bot"**: Mengirimkan pesan verifikasi ke Telegram.
- Tombol **"Kirim Rangkuman (07:00 WIB)"**: Memicu laporan harian kapan saja secara manual.
- Tombol **"💬 Tanya AI Website"**: Membuka konsol simulasi interaktif di browser untuk menguji respon AI terhadap kondisi & transaksi website.

---

## 2. Langkah Pembuatan Bot & Konfigurasi

### Langkah A: Buat Bot di Telegram (@BotFather)
1. Buka aplikasi Telegram dan cari bot resmi **@BotFather** (terverifikasi centang biru).
2. Mulai obrolan dengan mengirimkan:
   ```text
   /newbot
   ```
3. Beri nama bot, misalnya: `EasyLegal System & Security Bot`.
4. Beri username bot yang berakhiran `bot`, misalnya: `easylegal_admin_bot`.
5. Salin token API HTTP yang diberikan (format: `1234567890:ABCdefGhIJKlmNoPQRstuVWxYz`). Ini adalah `TELEGRAM_BOT_TOKEN`.

### Langkah B: Dapatkan Chat ID Anda
1. Buat grup Telegram bersama tim admin Anda atau kirim pesan langsung ke bot baru Anda.
2. Untuk mengetahui Chat ID:
   - Jika Anda mengirim pesan apa pun ke bot, bot akan otomatis merespon:  
     `📍 ID Chat Anda: -100xxxxxxxxxx` atau `123456789`.
   - Atau tambahkan bot pembantu seperti **@userinfobot** ke grup Anda.
3. Catat ID ini sebagai `TELEGRAM_CHAT_ID`.

---

## 3. Konfigurasi Environment Backend

Buka file `backend/.env` dan pastikan konfigurasi berikut terisi:

```dotenv
# ====================================================================
# TELEGRAM BOT & AI CHAT (Pukul 07:00 WIB & AI Konsultasi Website)
# ====================================================================
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRstuVWxYz
TELEGRAM_CHAT_ID=-1001928374650
TELEGRAM_DAILY_SUMMARY_CRON="0 7 * * *"
TELEGRAM_NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_POLLING=true
TZ="Asia/Jakarta"
```

> [!TIP]
> Bot otomatis menjalankan mekanisme **Long Polling** di latar belakang saat backend menyala (`npm run dev` atau `npm run start`). Tidak diperlukan IP publik, domain, atau ngrok untuk development lokal.

---

## 4. Keamanan & Hak Akses

1. **Whitelist Chat ID Ketat**:
   - Jika `TELEGRAM_CHAT_ID` telah disetel, hanya pengguna/grup dengan Chat ID tersebut yang dapat menanyakan data internal atau menerima alert.
   - Pesan dari pihak asing di luar grup terdaftar akan ditolak dengan pesan:  
     `⛔ Akses Ditolak. Bot AI ini dikonfigurasi khusus untuk Super Admin terotorisasi.`
2. **Zero-Leakage Guarantee**:
   - Respon AI hanya mengekstrak metadata operasional yang diperlukan dan tidak membocorkan isi berkas hukum rahasia.

---

## 5. Menjalankan Pengujian Otomatis

Untuk memastikan seluruh alur Telegram, scheduler 07:00 WIB, dan AI chatbot berfungsi dengan sempurna:

```bash
cd backend
npx jest tests/telegram-notifications.test.ts
```

Output pengujian:
```text
PASS tests/telegram-notifications.test.ts
  Telegram Daily Summary (07:00 WIB) & Interactive AI Chatbot Service
    1. HTML Sanitizer & Helper Logic
      ✓ should escape HTML characters correctly to avoid Telegram parse errors
      ✓ should return telegram configuration correctly
      ✓ should gracefully handle missing credentials
    2. Telegram Notification Dispatch with Mocked Fetch
      ✓ should send formatted message via Telegram Bot API when configured
      ✓ should notify new support ticket with SLA & client details
      ✓ should generate and dispatch daily digest scheduled for 07:00 WIB
    3. Telegram AI Chatbot Engine (Kondisi, Transaksi & Kegiatan Website)
      ✓ should gather comprehensive live snapshot of website without errors
      ✓ should respond to shortcut command /start and /help with interactive instructions
      ✓ should respond to /status with real-time website and server metrics
      ✓ should respond to /kegiatan with transactions and audit logs
      ✓ should respond to /tiket with support ticket status
      ✓ should answer natural language questions about activities/transactions
      ✓ should answer natural language questions about server condition
      ✓ should answer natural language questions about support tickets
    4. Super Admin Management & AI Chat Endpoints
      ✓ GET /api/admin/telegram/status should report 07:00 schedule and masked chat ID
      ✓ POST /api/admin/telegram/ask-ai should process AI query directly from console
      ✓ POST /api/admin/telegram/test should send test verification message
      ✓ POST /api/admin/telegram/send-digest should trigger instant 07:00 digest
    5. Real-time Ticket Submission Alert & Webhook Handler
      ✓ POST /api/support/tickets should trigger real-time alert
      ✓ POST /api/telegram/webhook should receive update and return ok

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```
