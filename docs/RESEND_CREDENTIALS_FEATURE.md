# Fitur Pengiriman Ulang Informasi Akun & Password (Superadmin & Officer)

## 1. Latar Belakang & Kebutuhan
Seringkali pengguna/pelanggan membutuhkan informasi kredensial akun mereka dikirimkan ulang (misalnya belum sempat mencatat kata sandi sementara, email notifikasi awal tidak terbaca, atau lupa akun). 
Untuk menjaga keamanan data dan mencegah penyalahgunaan:
- **Pengguna biasa (Customer)** tidak memiliki tombol kirim ulang langsung di halaman mereka. Jika membutuhkan, mereka mengajukan permohonan melalui **Tiket Bantuan** (`/support`).
- **Superadmin & Officer** memiliki tombol resmi di dashboard manajemen (`/admin`) untuk memicu pengiriman ulang email akun secara instan ke email pribadi pelanggan (`personalEmail`) sekaligus menyalin pesan pengantar ke clipboard.

---

## 2. Implementasi Backend (`POST /api/mailboxes/:id/resend-credentials`)
- **Akses & Otorisasi:**
  Grup route `/api/mailboxes` diproteksi middleware `authenticateOfficerOrAdmin`.
  - Superadmin: **Diizinkan** (HTTP 200)
  - Officer: **Diizinkan** (HTTP 200)
  - Customer: **Ditolak** (HTTP 403 Forbidden)
  - Tanpa Token: **Ditolak** (HTTP 401 Unauthorized)

- **Alur Kerja Endpoint:**
  1. Mengambil data pelanggan berdasarkan `id`.
  2. Melakukan dekripsi kata sandi yang tersimpan (`decrypt(customer.passwordEnc)`). Jika kata sandi belum dapat didekripsi, sistem men-generate password baru yang kuat dan memperbarui database.
  3. Memanggil fungsi `sendOnboardingNotice()` untuk mengirimkan email HTML resmi EasyLegal yang memuat:
     - Nama Customer
     - Alamat Email Portal Resmi (`@clienteasylegal.co.id`)
     - Password Sementara
     - URL Akses Login (`https://clienteasylegal.co.id/login`)
     - Panduan keamanan akun.
  4. Mencatat tindakan ke dalam `auditLog` (`mailbox.resend_credentials`).
  5. Mengembalikan JSON yang memuat status pengiriman, alamat email tujuan, dan kata sandi agar admin/officer dapat langsung menyalinnya jika diperlukan.

---

## 3. Implementasi Frontend

### A. Dashboard Superadmin & Officer (`/admin`)
1. **Tabel Akun Mailbox (Tab "Akun Mailbox"):**
   Setiap baris akun pelanggan memiliki tombol **"Kirim Info"** dengan ikon surat (`Mail`).
2. **Meja Kerja Staf (Tab "Meja Kerja Staf"):**
   Pada kartu "Akses Cepat 1-Klik Mailbox Klien", staf Officer memiliki tombol **"Kirim Info"** di samping tombol "Buka Webmail".
3. **Modal Konfirmasi & Rincian Kredensial:**
   Setelah tombol ditekan:
   - Menampilkan status pengiriman (terkirim via SMTP atau siap disalin manual).
   - Menampilkan tabel rincian (Nama, Email Resmi, Email Pribadi, Password, URL Portal).
   - Tombol **"Salin Format Pesan"** yang secara otomatis menyalin format template resmi untuk WhatsApp atau balasan tiket bantuan.

### B. Portal Pelanggan (`/support`)
1. **Kategori Baru pada Form Tiket:**
   Menambahkan opsi kategori **"Permohonan Kredensial & Password"** di modal pembuatan tiket bantuan.
2. **Panduan FAQ:**
   Menambahkan petunjuk di bagian Tanya Jawab (FAQ) bahwa jika pelanggan membutuhkan pengiriman ulang kredensial atau reset kata sandi sementara, mereka dapat membuat tiket dengan kategori tersebut untuk diproses oleh staf Officer.

---

## 4. Hasil Verifikasi
1. **Unit Test Backend:**
   File `backend/tests/resend-credentials.test.ts` (4 pengujian) lulus 100%:
   - `✓ allows superadmin to resend credentials to customer personal email`
   - `✓ allows officer to resend credentials to customer personal email`
   - `✓ blocks customer from accessing resend credentials endpoint with 403 Forbidden`
   - `✓ blocks unauthenticated requests with 401 Unauthorized`
2. **Build TypeScript & Next.js:**
   - Backend `tsc`: Berhasil tanpa error.
   - Frontend `next build`: Berhasil tanpa error (11/11 halaman terkompilasi).
