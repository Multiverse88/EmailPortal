# PRD — Email Client Custom (Domain Hostinger — clienteasylegal.co.id)

**Status:** Draft **Versi:** 1.0

## 1. Latar belakang & masalah

Saat ini akses email tim/customer bergantung pada webmail bawaan Hostinger (Titan Mail). Dibutuhkan panel email sendiri (mirip Gmail) yang:

- Berjalan di atas domain & mail server Hostinger yang sudah ada (tidak menggantikan infrastruktur email).
- Akun email customer dibuat manual oleh admin, bukan self-registrasi publik.
- Customer bisa login dan mengelola inbox mereka sendiri, termasuk mengganti password.

## 2. Tujuan

- Menyediakan pengalaman inbox yang familiar (baca, compose, reply, forward, search) tanpa bergantung pada Webmail Hostinger.
- Memberi kontrol penuh ke admin atas siapa yang punya akun email dan kapan dibuat/dicabut.
- Meletakkan dasar yang bisa discale ke puluhan–ratusan mailbox tanpa merombak arsitektur.

## 3. Target pengguna

|Role|Deskripsi|Kebutuhan utama|
|---|---|---|
|Admin|Internal tim yang mengelola akun email customer|Provisioning mailbox, monitoring kuota, cabut akses|
|Customer|Pemilik mailbox yang dibuatkan admin|Login, baca/kirim email, ganti password sendiri|

## 4. Ruang lingkup (MVP)

### Termasuk (in scope)

- Admin: buat mailbox baru (via Hostinger API), lihat daftar mailbox & kuota, hapus/nonaktifkan mailbox.
- Customer: login pakai kredensial mailbox, lihat inbox & folder, baca email, compose/reply/forward, lampiran (kirim & unduh), pencarian email, ganti password sendiri.
- Sinkronisasi email near-realtime (IMAP IDLE/polling) ke cache database.
- Notifikasi ke customer saat akun dibuat (kredensial sementara via kanal terpisah, bukan email itu sendiri).

### Tidak termasuk (out of scope untuk MVP)

- Self-registrasi publik oleh customer.
- Multi-inbox per customer (1 customer = 1 mailbox untuk MVP).
- Fitur kolaborasi (shared inbox, label bersama, delegasi akses).
- Aplikasi mobile native (web-responsive dulu).
- Migrasi/impor email dari provider lain.
- Kalender, kontak, atau fitur groupware lain.

## 5. Functional requirements

### 5.1 Admin — provisioning mailbox

- FR-1: Admin dapat membuat mailbox baru dengan input nama, email pribadi customer (untuk notifikasi), dan local part email yang diinginkan.
- FR-2: Sistem memvalidasi kuota mailbox tersisa sebelum membuat mailbox baru; jika penuh, tampilkan pesan jelas ke admin.
- FR-3: Sistem generate password mailbox otomatis (bukan diketik admin), disimpan terenkripsi.
- FR-4: Admin dapat melihat daftar seluruh mailbox beserta status (aktif/nonaktif) dan penggunaan storage.
- FR-5: Admin dapat menonaktifkan/menghapus mailbox customer (soft-delete, masa pemulihan sesuai kebijakan Hostinger).
- FR-6: Hanya user dengan role admin yang bisa mengakses endpoint/halaman provisioning.

### 5.2 Customer — autentikasi

- FR-7: Customer login menggunakan alamat email + password mailbox.
- FR-8: Sistem membatasi percobaan login gagal (rate limiting) untuk mencegah brute-force.
- FR-9: Customer dapat mengganti password mailbox sendiri dari halaman pengaturan, dengan verifikasi password saat ini.
- FR-10: Password baru divalidasi memenuhi syarat kompleksitas Hostinger sebelum dikirim ke server.

### 5.3 Customer — inbox & email

- FR-11: Customer dapat melihat daftar folder (Inbox, Sent, Drafts, Trash, dst.) beserta jumlah pesan belum dibaca.
- FR-12: Customer dapat membuka, membaca isi email (teks & HTML tersanitasi), dan melihat lampiran.
- FR-13: Customer dapat mengunduh lampiran.
- FR-14: Customer dapat menulis, membalas, dan meneruskan email, termasuk melampirkan file.
- FR-15: Customer dapat menandai email sebagai dibaca/belum dibaca, menghapus, dan memindahkan email antar folder.
- FR-16: Customer dapat mencari email berdasarkan subjek, pengirim, atau isi.
- FR-17: Email baru masuk muncul di inbox tanpa customer perlu refresh manual (near-realtime).

### 5.4 Notifikasi & onboarding

- FR-18: Saat mailbox dibuat, sistem mengirim informasi ke email pribadi customer (bukan email baru) berisi alamat email baru dan cara login/set password pertama.

### 5.5 Retensi Berkas 3 Bulan & Pemulihan Arsip via Support Ticket (Cold Storage)

- FR-19: Sistem mendeteksi usia lampiran email dan dokumen legal secara cerdas (*Smart Age Detection*). Berkas berusia > 90 hari (3 bulan) dialihkan ke status arsip (*Cold Storage*).
- FR-20: Berkas biner di Object Storage S3 IDCloudHost otomatis dihapus setelah 90 hari menggunakan *S3 Native Lifecycle Rule* untuk mengunci kapasitas dan menjaga biaya cloud tetap flat/stabil.
- FR-21: Salinan permanen berkas disimpan di Synology NAS kantor melalui sinkronisasi berkala *Synology Drive Client* di PC/laptop administrator.
- FR-22: Sistem memblokir unduhan langsung file berusia > 90 hari untuk mencegah error `404 Not Found`, serta menampilkan badge status *"Arsip Cold Storage (> 3 Bulan)"*.
- FR-23: Sistem menyediakan tombol 1-klik *"Minta Berkas (Tiket Bantuan)"* yang mengarahkan customer ke formulir tiket `/support` dengan field terisi otomatis (*pre-filled* nama file, ID dokumen, tanggal unggah, ukuran).
- FR-24: Staf admin/legal dapat merespons tiket dengan melampirkan berkas hasil pemulihan dari Synology NAS kantor dan menandai tiket selesai (*Resolved*).

## 6. Non-functional requirements

|Kategori|Requirement|
|---|---|
|Keamanan|Password mailbox disimpan terenkripsi (bukan hash, karena dibutuhkan untuk IMAP/SMTP); seluruh komunikasi via TLS; HTML email disanitasi sebelum render (cegah XSS)|
|Performa|Buka inbox (dari cache) < 1 detik; email baru masuk terdeteksi dalam < 30 detik dari waktu diterima server|
|Skalabilitas|Arsitektur mendukung minimal 100 mailbox aktif tanpa perubahan desain|
|Ketersediaan|Uptime target 99% untuk panel; kegagalan sync satu mailbox tidak mengganggu mailbox lain|
|Auditability|Setiap aksi admin (buat/hapus mailbox) tercatat di log dengan timestamp & pelaku|
|Kompatibilitas|Web app responsive, berfungsi baik di desktop & mobile browser|

## 7. Ringkasan arsitektur teknis

- **Mail server:** Hostinger Titan Mail (tidak self-host) — akses via IMAP/SMTP & Hostinger Mail API untuk provisioning.
- **Backend:** API server (auth, proxy provisioning) + sync worker terpisah (IMAP IDLE/polling).
- **Data:** PostgreSQL (metadata & kredensial terenkripsi), Redis (cache & antrean job), Meilisearch (full-text search), MinIO/S3-compatible (attachment).
- **Frontend:** Web app (React/Next.js), UI ala Gmail.
- **Deployment:** VPS + Docker Compose, Nginx reverse proxy, TLS via Let's Encrypt.

_(Detail lengkap ada di dokumen arsitektur & `docker-compose.yml` terpisah.)_

## 8. Entitas data utama

- **Customer** — id, nama, email pribadi, mailbox_address, mailbox_resource_id, mailbox_password_encrypted, status, created_at.
- **AdminUser** — id, nama, email, role, password_hash.
- **MessageCache** — mailbox_id, uid, folder, subject, sender, snippet, is_read, received_at (hasil sync, bukan sumber kebenaran — isi lengkap tetap di server IMAP).
- **AuditLog** — actor_id, action, target_customer_id, timestamp.

## 9. Metrik keberhasilan (MVP)

- Waktu admin membuat 1 mailbox baru: < 1 menit (dari input sampai notifikasi terkirim).
- Tingkat keberhasilan sync (mailbox yang berhasil sinkron tanpa error) > 98%.
- Waktu rata-rata customer menemukan email lewat search < 3 detik.
- Zero insiden kebocoran kredensial mailbox selama periode observasi 3 bulan pertama.

## 10. Asumsi & batasan

- Domain & paket email (mail order) di Hostinger sudah tersedia dengan kuota mailbox mencukupi.
- Admin bertanggung jawab menyampaikan password sementara ke customer lewat kanal aman (WA/telepon), bukan lewat sistem.
- MVP mengasumsikan 1 mailbox = 1 customer; kebutuhan multi-mailbox per customer ditunda ke fase berikutnya.

## 11. Risiko & pertanyaan terbuka

|Risiko/Pertanyaan|Dampak|Mitigasi/Tindak lanjut|
|---|---|---|
|Kuota mailbox plan Hostinger habis saat pertumbuhan customer cepat|Provisioning gagal|Monitoring kuota otomatis + alert sebelum penuh|
|IMAP IDLE Hostinger punya batasan koneksi simultan|Sync delay saat mailbox banyak|Uji beban di fase testing, siapkan fallback polling|
|Siapa yang menentukan local part (nama sebelum @) — admin atau customer usul dulu?|Alur onboarding|Perlu diputuskan sebelum desain form admin final|
|Kebijakan retensi email lama / kuota storage per mailbox|Pengalaman customer|Perlu ditentukan batas storage & notifikasi saat mendekati limit|

## 12. Milestone

Mengacu ke dokumen timeline terpisah (`timeline-email-client.md`) — total estimasi 5–7 minggu untuk MVP dengan satu developer full-time.