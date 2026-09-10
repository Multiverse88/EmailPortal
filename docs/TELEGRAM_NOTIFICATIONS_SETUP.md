# Panduan Integrasi Bot Telegram EasyLegal (Rangkuman Harian & Alert Tiket Support)

Dokumen ini menjelaskan tata cara penyiapan, konfigurasi, dan pengoperasian **Bot Telegram** untuk pemantauan harian sistem & keamanan website serta notifikasi *real-time* tiket bantuan (*support ticket*) klien.

---

## 1. Fitur Utama

1. **Rangkuman Harian Otomatis (Daily Digest) - Pukul 08:00 WIB**:
   - **Kesehatan Webmail & Server**: Status operasional portal, sync Titan Mail (IMAP 993/SMTP 465), total mailbox aktif/nonaktif, dan antrean email.
   - **Radar Keamanan & Anomali**: Sesi login aktif, deteksi multi-IP login, log audit 24 jam terakhir, dan konfirmasi perlindungan in-memory zero-leakage.
   - **Kapasitas Penyimpanan & Retensi**: Penggunaan hot storage S3 (IDCloudHost), jumlah berkas di Legal Drive, koneksi ke cold storage Synology NAS, dan pengawasan retensi 90 hari.
   - **Pusat Tiket Support Klien**: Jumlah tiket terbuka (open), tiket berkategori mendesak (*urgent < 4 jam SLA*), dan tiket yang telah terselesaikan (*resolved*).

2. **Notifikasi Real-Time Tiket Support Baru**:
   - Terkirim dalam hitungan detik saat klien membuat tiket melalui portal `/support`.
   - Rincian mencakup: Nomor Tiket (`#TK-XXXX`), Label Prioritas (Normal / Urgent), Kategori, Nama Klien & Alamat Mailbox Resmi, Subjek, serta cuplikan pesan awal.
   - Tautan langsung ke konsol Super Admin.

3. **Notifikasi Seketika Anomali Login Multi-IP**:
   - Terkirim otomatis saat satu akun terdeteksi login aktif dari beberapa alamat IP yang berbeda sekaligus.

4. **Panel Kontrol Super Admin Terpadu**:
   - Status koneksi bot (*Bot Aktif Terhubung* vs *Belum Dikonfigurasi*).
   - Tombol **"Tes Bot"**: Mengirimkan pesan uji coba verifikasi ke obrolan Telegram.
   - Tombol **"Kirim Rangkuman Sekarang"**: Memicu laporan rangkuman harian secara instan tanpa menunggu jam 08:00 WIB.

---

## 2. Langkah Pembuatan Bot & Konfigurasi

### Langkah A: Buat Bot di Telegram (@BotFather)
1. Buka aplikasi Telegram dan cari bot resmi **@BotFather** (terverifikasi tanda centang biru).
2. Mulai obrolan dengan mengirimkan:
   ```text
   /newbot
   ```
3. Beri nama bot, misalnya: `EasyLegal System & Security Bot`.
4. Beri username bot yang berakhiran `bot`, misalnya: `easylegal_monitor_bot`.
5. Salin token API HTTP yang diberikan oleh BotFather (format: `1234567890:ABCdefGhIJKlmNoPQRstuVWxYz`). Ini adalah `TELEGRAM_BOT_TOKEN`.

### Langkah B: Buat Grup/Saluran Admin & Dapatkan Chat ID
1. Buat grup baru di Telegram (misal: *EasyLegal Super Admin Alerts*).
2. Tambahkan bot yang baru dibuat ke dalam grup tersebut.
3. Berikan bot izin untuk membaca dan mengirim pesan.
4. Untuk mengetahui Chat ID:
   - Tambahkan bot pembantu seperti **@userinfobot** atau **@RawDataBot** ke grup, maka bot tersebut akan menampilkan ID grup (biasanya diawali tanda minus, contoh: `-1001928374650`).
   - Atau kirim satu pesan di grup tersebut, lalu buka tautan berikut di browser:
     ```text
     https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
     ```
     Cari nilai `"chat":{"id": -100xxxxxxxxxx}`.
5. Catat Chat ID ini sebagai `TELEGRAM_CHAT_ID`.

---

## 3. Konfigurasi Environment Backend

Buka file `backend/.env` dan tambahkan variabel berikut:

```dotenv
# ==========================================
# TELEGRAM BOT & DAILY DIGEST NOTIFICATIONS
# ==========================================
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRstuVWxYz
TELEGRAM_CHAT_ID=-1001928374650
TELEGRAM_NOTIFICATIONS_ENABLED=true
TELEGRAM_DAILY_SUMMARY_CRON="0 8 * * *"
TZ="Asia/Jakarta"
```

> [!NOTE]
> Jika `TELEGRAM_BOT_TOKEN` atau `TELEGRAM_CHAT_ID` belum diisi, sistem backend akan tetap berjalan normal tanpa galat (*graceful degrade*). Fitur notifikasi hanya akan dilewati dan tercatat di log server.

---

## 4. Pengujian & Verifikasi

1. **Jalankan Backend & Frontend**:
   ```bash
   npm --prefix backend run dev
   npm --prefix frontend run dev
   ```
2. **Buka Konsol Super Admin**:
   - Masuk sebagai akun Super Admin (`admin@clienteasylegal.co.id`).
   - Klik tab **"Pusat Tiket Support Klien"**.
   - Pada panel atas **"Pusat Notifikasi & Rangkuman Harian Telegram"**, pastikan terdapat tanda hijau: `🟢 Bot Aktif Terhubung`.
3. **Klik Tombol "Tes Bot"**:
   - Periksa obrolan Telegram Anda. Pesan bertuliskan `[TEST NOTIFIKASI TELEGRAM] EasyLegal Portal` akan masuk dalam sekejap.
4. **Klik Tombol "Kirim Rangkuman Sekarang"**:
   - Pesan komprehensif berisi kondisi server, akun webmail, storage S3, radar keamanan, dan status antrean tiket akan langsung terkirim ke Telegram.

---

## 5. Menjalankan Unit & Integration Test

Seluruh fungsi Telegram memiliki cakupan pengujian otomatis:

```bash
cd backend
npx jest tests/telegram-notifications.test.ts
```

Output yang diharapkan:
```text
PASS tests/telegram-notifications.test.ts
  Telegram Daily Summary & Support Ticket Alert Service
    1. HTML Sanitizer & Helper Logic
      ✓ should escape HTML characters correctly to avoid Telegram parse errors
      ✓ should return telegram configuration correctly
      ✓ should gracefully handle missing credentials
    2. Telegram Notification Dispatch with Mocked Fetch
      ✓ should send formatted message via Telegram Bot API when configured
      ✓ should notify new support ticket with SLA & client details
      ✓ should send security anomaly alert when multi-IP detected
      ✓ should generate and dispatch comprehensive daily health & security digest
    3. Super Admin Telegram Management Endpoints
      ✓ GET /api/admin/telegram/status should enforce Super Admin authorization
      ✓ POST /api/admin/telegram/test should send test verification message
      ✓ POST /api/admin/telegram/send-digest should trigger daily digest on demand
    4. Real-time Trigger on New Support Ticket Submission
      ✓ POST /api/support/tickets should dispatch Telegram alert in background

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```
