# Panduan Pembersihan Total Data Dummy & Akun Demo

Panduan ini mencatat pembersihan akun demo awal dan cara menjaga database tetap bersih (*production ready*).

---

## 🧹 1. Apa Saja yang Telah Dihapus?

1. **Frontend Login (`/login`):**
   - Panel *"Akun demo - Isi otomatis"* (tombol cepat untuk Budi, Trial, Admin, Officer) telah dihapus sepenuhnya dari halaman login.
   - Halaman login kini bersih, hanya menampilkan formulir autentikasi resmi.

2. **Frontend Admin Dashboard (`/admin`):**
   - Tombol *"Muat Data Demo"* (`seed-demo-btn`) telah dihapus dari header mailbox.

3. **Backend Startup & Auto-Seeding:**
   - Server backend tidak lagi melakukan auto-seed data dummy ketika database kosong.
   - Jika database baru pertama kali dijalankan, sistem **hanya** membuat 1 akun root:
     - **Email:** `admin@clienteasylegal.co.id`
     - **Password:** `Admin123!` (atau nilai dari `INITIAL_ADMIN_PASSWORD`)
     - **Role:** `superadmin`
   - Mekanisme *emergency auto-seed* pada login customer dan admin telah dihapus.
   - `AUTO_SEED_DEMO` diubah menjadi `false` secara default di `docker-compose.dokploy.yml` dan `docker-compose.yml`.

4. **Pembersihan Database & Storage:**
   - Seluruh customer demo (`budi@...`, `trial@...`, `siti@...`, `hendra@...`, `dewi@...`, `ahmad@...`, `rudi@...`, `maya@...`, `eka@...`, dll.) telah dihapus.
   - Seluruh 20 pesan email dummy, 7 tiket dummy, 9 dokumen dummy, dan 8 file dummy di storage fisik telah dihapus.
   - Folder akun dummy di Synology Cold Storage laptop (`~/SynologyDrive/EmailPortal_ColdStorage/accounts`) telah dibersihkan dan `.sync-manifest.json` di-reset.

---

## 🚀 2. Cara Menjalankan Pembersihan di Dokploy (Produksi)

Setelah Anda men-deploy commit terbaru ini di Dokploy, jika container produksi masih menyimpan data demo lama di volume SQLite (`/app/data/prod.db`), Anda dapat membersihkannya dalam 1 langkah mudah:

### Opsi A: Lewat Dokploy Dashboard Terminal (Paling Mudah)
1. Buka dashboard **Dokploy** -> Service **`email-portal`**.
2. Masuk ke tab **Containers / Terminal**, pilih container **`backend`**.
3. Jalankan perintah:
   ```bash
   npm run db:clean-dummy
   ```
4. Semua data dummy di container produksi akan langsung terhapus bersih dan menyisakan hanya akun Super Admin (`admin@clienteasylegal.co.id`).

### Opsi B: Reset Database Total di Dokploy
Jika Anda ingin database SQLite benar-benar dibuat ulang dari nol:
1. Di Dokploy, buka terminal container backend.
2. Hapus file database lama:
   ```bash
   rm -f /app/data/prod.db
   ```
3. Restart container backend. Backend akan otomatis membuat database kosong baru dan hanya menginisialisasi akun Super Admin.

---

## 🔑 3. Akun Super Admin Resmi

- **URL Login:** `https://clienteasylegal.co.id/login` (Tab **Administrator**)
- **Email:** `admin@clienteasylegal.co.id`
- **Password:** `Admin123!`
- Dari akun ini, Anda dapat membuat mailbox customer resmi baru melalui tombol **"Buat Mailbox Baru"** di dashboard `/admin`.
