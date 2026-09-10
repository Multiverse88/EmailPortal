# Panduan Akun Internal — Super Admin & Officer EasyLegal

Dokumen ini memuat informasi kredensial, peran, hak akses (*Role-Based Access Control / RBAC*), dan alur kerja untuk akun internal **Super Admin** dan **Officer (Staf Legal)** pada platform EasyLegal Portal.

---

## 🔑 1. Ringkasan Kredensial Default

Kredensial berikut telah aktif di sistem dan siap digunakan:

| Atribut           | 👑 Akun Super Admin                                                        | 🛡️ Akun Officer (Staf Legal)                                              |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Role Sistem**   | `superadmin`                                                               | `officer`                                                                  |
| **Nama Pengguna** | Admin Utama EasyLegal                                                      | Officer Staf Legal                                                         |
| **Email Login**   | `admin@clienteasylegal.co.id`                                              | `officer@clienteasylegal.co.id`                                            |
| **Password Awal** | `Admin123!`                                                                | `Officer123!`                                                              |
| **URL Login**     | [https://clienteasylegal.co.id/login](https://clienteasylegal.co.id/login) | [https://clienteasylegal.co.id/login](https://clienteasylegal.co.id/login) |
| **Tab Login**     | Tab **Administrator**                                                      | Tab **Administrator**                                                      |

> [!NOTE]
> Kedua akun di atas login melalui tab **Administrator** pada halaman login yang sama. Sistem akan secara otomatis mendeteksi peran (*role*) dan menampilkan dashboard sesuai hak akses masing-masing.

---

## 👑 2. Akun Super Admin

### A. Deskripsi & Tanggung Jawab
Super Admin adalah pemilik akses tertinggi (*Root / IT & Security Administrator*) yang bertanggung jawab atas seluruh infrastruktur sistem, cold storage, audit radar keamanan, dan kebijakan akses.

### B. Fitur & Hak Istimewa Khusus Super Admin:
1. **Manajemen Mailbox Penuh:**
   - Membuat mailbox baru untuk klien/customer.
   - Mengaktifkan (*reactivate*), menonaktifkan (*deactivate*), atau menghapus (*delete*) mailbox customer.
2. **1-Click Customer Impersonation:**
   - Melakukan login darurat/asistensi langsung ke mailbox customer tanpa perlu mengetahui kata sandi pribadi klien.
   - Sesi impersonation dicatat dalam Security Radar dan audit trail demi transparansi.
3. **Synology Cold Storage Controller & Runner Inspector:**
   - Memantau status koneksi runner laptop lokal (*Laptop Online / Offline*).
   - Memicu tugas sinkronisasi arsip legal 90+ hari ke Synology Drive Cold Storage via queue job.
4. **Master Storage Inspector:**
   - Memantau penggunaan disk lokal (`/app/storage`) dan *Object Storage S3* IDCloudHost.
   - Memeriksa total kuota dan berkas arsip.
5. **Security Radar (Real-Time 5s Polling):**
   - Mendeteksi login dari multi-IP yang mencurigakan secara live.
   - Menghentikan paksa sesi aktif (*Terminate Session*).
   - Memblokir akun yang terindikasi kompromi (*Lock Account*).
6. **Audit Logs:**
   - Meninjau 100 riwayat aktivitas administratif terakhir secara kronologis.

---

## 🛡️ 3. Akun Officer (Staf Legal & Operasional)

### A. Deskripsi & Tanggung Jawab
Officer adalah akun operasional harian yang digunakan oleh staf legal, customer support, atau paralegal EasyLegal untuk melayani klien tanpa risiko merusak konfigurasi sistem atau infrastruktur cloud.

### B. Fitur & Hak Akses Officer:
1. **Pendaftaran Mailbox Customer Baru:**
   - Membuat akun mailbox klien baru (terhubung ke Hostinger Mail API).
   - Menetapkan nama perusahaan, email pribadi, dan kuota penyimpanan.
2. **1-Click Asistensi Klien:**
   - Membantu klien memeriksa dokumen legal atau kendala lampiran melalui impersonasi terotorisasi.
3. **Tab "Pintasan Operasional Staf" (Ruang Kerja Khusus):**
   - **Tiket Bantuan Klien (`/support`):** Membantu menjawab permohonan pemulihan arsip dan konsultasi legal dari customer.
   - **Dokumen Legal (`/documents`):** Memeriksa berkas legalitas klien (Akta Perusahaan, SK Kemenkumham, Draf Perjanjian).
   - **Webmail Staf (`/inbox`):** Membuka kotak masuk email staf untuk berkorespondensi resmi.

### C. Batasan Keamanan (*Restricted Access*):
Untuk menjaga keamanan sistem, akun Officer **tidak memiliki akses** ke:
- ❌ **Security Radar** (pemutus sesi & deteksi multi-IP hanya untuk Super Admin).
- ❌ **Synology Sync Trigger & Runner Status** (sinkronisasi cold storage NAS dibatasi hanya untuk Super Admin).
- ❌ **Master Storage Inspector** (konfigurasi S3 & disk fisik cloud).
- ❌ **Manajemen Akun Administrator Lain** (tidak dapat menonaktifkan akun Super Admin).

---

## 📊 4. Matriks Perbandingan Hak Akses (RBAC Matrix)

| Modul / Fitur | Super Admin (`superadmin`) | Officer (`officer`) | Customer (`customer`) |
|---|:---:|:---:|:---:|
| **Buat Mailbox Customer Baru** | ✅ Ya | ✅ Ya | ❌ Tidak |
| **Ubah Status Mailbox (Aktif / Nonaktif / Hapus)** | ✅ Ya | ❌ Terbatas | ❌ Tidak |
| **1-Click Impersonation ke Mailbox Klien** | ✅ Ya | ✅ Ya | ❌ Tidak |
| **Akses Pintasan Operasional Staf** | ✅ Ya | ✅ Ya | ❌ Tidak |
| **Akses Security Radar & Kill Session** | ✅ Ya | ❌ Tidak | ❌ Tidak |
| **Akses Storage Inspector (S3 / Local)** | ✅ Ya | ❌ Tidak | ❌ Tidak |
| **Trigger Sinkronisasi Synology NAS** | ✅ Ya | ❌ Tidak | ❌ Tidak |
| **Webmail (Inbox, Sent, Draf, Lampiran)** | ❌ (Khusus Klien) | ✅ (Via Impersonasi) | ✅ Ya |
| **Akses Legal Drive Dokumen Klien** | ✅ (Via Impersonasi) | ✅ (Via Impersonasi) | ✅ Ya |
| **Kelola 2FA TOTP Pribadi** | ✅ Ya | ✅ Ya | ✅ Ya |

---

## 🔒 5. Rekomendasi Keamanan Produksi

1. **Ganti Kata Sandi Awal:**  
   Setelah pertama kali login di lingkungan produksi, segera perbarui kata sandi default (`Admin123!` dan `Officer123!`) melalui pengaturan akun.
2. **Kustomisasi Password via Environment Variable (Opsional):**  
   Jika ingin menentukan password saat deployment awal, Anda dapat menambahkan variabel berikut di Dokploy:
   ```env
   INITIAL_ADMIN_PASSWORD=SandiKuatSuperAdmin2026!
   INITIAL_OFFICER_PASSWORD=SandiKuatOfficer2026!
   ```
3. **Aktifkan 2FA (Two-Factor Authentication):**  
   Gunakan Google Authenticator atau aplikasi TOTP lainnya pada menu Settings untuk lapisan perlindungan ganda.
