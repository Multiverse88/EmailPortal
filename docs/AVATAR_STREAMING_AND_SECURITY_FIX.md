# Dokumentasi Perbaikan Error Logo Perusahaan / Avatar & Security Error file:///

## 1. Latar Belakang & Gejala Error
Saat pengguna mengakses tab **Profil** di Pengaturan (`https://clienteasylegal.co.id/settings?tab=profile`) dan melakukan upload/drag logo perusahaan, muncul dua kendala:
1. `Security Error: Content at https://clienteasylegal.co.id/settings?tab=profile may not load or link to file:///.`
2. `GET https://clienteasylegal.co.id/api/settings/avatar?v=... [HTTP/2 401 Unauthorized]`

---

## 2. Analisis Akar Masalah (Root Cause Analysis)

### A. HTTP 401 Unauthorized pada `/api/settings/avatar`
- **Penyebab:**
  Di file `backend/src/app.ts`:
  ```ts
  app.use('/api/settings', authenticateCustomer, settingsRoutes(prisma));
  ```
  Seluruh grup route `/api/settings/*` diproteksi oleh middleware `authenticateCustomer` yang mewajibkan header `Authorization: Bearer <token>`.
  Ketika browser memuat tag HTML standar `<img>`:
  ```html
  <img src="/api/settings/avatar?v=..." />
  ```
  Browser **tidak pernah mengirimkan header Authorization** pada permintaan tag gambar. Akibatnya, server menolak request dengan status **HTTP 401 Unauthorized**, sehingga gambar logo gagal tampil.
  Selain itu, respons login di `backend/src/routes/auth.ts` sebelumnya mengembalikan nilai mentah storage key `accounts/...` alih-alih URL HTTP yang dapat diakses browser.

### B. Security Error `file:///` Saat Drag & Drop
- **Penyebab:**
  Perilaku bawaan (default browser behavior) ketika pengguna menarik (drag) berkas dari file explorer OS (misalnya Nautilus di Linux atau Explorer di Windows) dan menjatuhkannya (drop) ke area halaman web adalah: browser akan **mencoba melakukan navigasi tab ke URL berkas lokal** (`file:///home/user/...`).
  Browser modern (Chromium/Firefox) menerapkan kebijakan keamanan ketat yang **melarang situs berprotokol HTTPS berpindah (navigate) ke protokol lokal `file:///`**, sehingga browser memblokirnya dan mengeluarkan `Security Error: Content at https://... may not load or link to file:///`.

---

## 3. Langkah Perbaikan & Solusi

### A. Backend (`backend/src/app.ts`, `backend/src/routes/settings.ts`, `backend/src/routes/auth.ts`)
1. **Unprotect Mount Point `/api/settings`:**
   Di `backend/src/app.ts`, mount diubah menjadi:
   ```ts
   app.use('/api/settings', settingsRoutes(prisma));
   ```
2. **Proteksi Spesifik pada Route Sensitif:**
   Di `backend/src/routes/settings.ts`, middleware `authenticateCustomer` diterapkan secara eksplisit hanya pada:
   - `GET /` (data profil & preferensi)
   - `POST /avatar` (unggah logo baru)
   - `DELETE /avatar` (hapus logo)
   - `PUT /preferences` (simpan preferensi)
3. **Endpoint Streaming Avatar Publik & Terisolasi:**
   - Menambahkan route publik `GET /api/settings/avatar/:customerId`:
     - Mengambil avatar berdasarkan ID pelanggan.
     - Header `Cache-Control: public, max-age=86400` untuk performa cepat dengan cache busting otomatis via query string `?v=<timestamp>`.
     - Streaming buffer langsung dari IDCloudHost S3 / storage adapter tanpa memerlukan header Authorization.
   - Memperbarui `GET /api/settings/avatar` (fallback) untuk mendukung pencarian via `?customerId=...`, Bearer token, atau query token.
4. **Format URL Standar di Auth Routes:**
   Pada `backend/src/routes/auth.ts` (endpoint login, 2FA verify, impersonate, dan `/me`), `avatarUrl` diformat konsisten menjadi:
   `/api/settings/avatar/${customer.id}?v=${new Date(customer.updatedAt).getTime()}`.

### B. Frontend (`frontend/src/app/settings/page.tsx`, `frontend/src/components/suite-header.tsx`)
1. **Pencegahan Navigasi `file:///` Global:**
   Menambahkan event listener pada `window` untuk event `dragover` dan `drop` dengan `e.preventDefault()`, sehingga pelepasan file di luar dropzone tidak memicu navigasi tab ke `file:///`.
2. **Interactive Drag-and-Drop Zone pada Card Logo Perusahaan:**
   - Menambahkan event listener `onDragOver`, `onDragEnter`, `onDragLeave`, dan `onDrop` pada section logo dan kotak preview avatar.
   - Tampilan visual responsif saat file di-drag: border berubah biru/primary, background aktif, dan overlay *"Drop Logo"* muncul.
   - Saat file dilepas, sistem memvalidasi tipe file (`image/*`) dan batas ukuran (maksimal 5 MB), kemudian langsung mengunggah via `FormData`.
3. **Fallback Gambar Otomatis (`onError`):**
   Di `frontend/src/app/settings/page.tsx` dan `frontend/src/components/suite-header.tsx`, tag `<img>` dilengkapi dengan handler `onError` sehingga apabila terjadi kegagalan jaringan atau berkas tidak ditemukan, tampilan langsung fallback ke inisial nama perusahaan tanpa menampilkan ikon gambar rusak.

---

## 4. Hasil Verifikasi
1. **Backend Automated Tests:**
   Semua 8 unit test pada `backend/tests/quota-and-avatar.test.ts` berhasil lulus (100% PASS), termasuk pengujian publik:
   `✓ streams company logo publicly via GET /api/settings/avatar/:customerId without token`
2. **TypeScript Compilation:**
   - Backend `npm run build` (tsc): Lulus tanpa error.
   - Frontend `next build`: Lulus tanpa error (11/11 static pages generated).
