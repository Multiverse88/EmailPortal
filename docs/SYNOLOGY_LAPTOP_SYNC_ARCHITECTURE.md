# Arsitektur Sinkronisasi Cloud-ke-Laptop (Synology Drive Cold Storage)

Dokumen ini menjelaskan alur kerja dan arsitektur pengunduhan file cold storage dari Cloud Server (Dokploy / S3) ke Laptop Super Admin (Fedora) yang terhubung ke Synology NAS.

---

## 1. Latar Belakang & Masalah Sebelumnya

1. **Pemisahan Lingkungan (Decoupled Environment):**
   - Cloud server EasyLegal (`https://clienteasylegal.co.id`) berjalan di Dokploy dengan database dan penyimpanan cloud (S3 IDCloudHost / disk container).
   - Laptop Fedora Super Admin menjalankan Synology Drive Client lokal yang memantau folder:
     `/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage`
2. **Masalah Sebelumnya:**
   - Tombol "Sinkronkan ke Synology Sekarang" di dashboard admin mengirim tugas ke runner laptop.
   - Namun, runner di laptop sebelumnya mengeksekusi query database lokal (`dev.db`), padahal seluruh akun pelanggan dan dokumen yang diunggah klien berada di database produksi Dokploy. Akibatnya, runner menyelesaikan job dengan status `0 file disalin`.
   - Tidak ada endpoint bagi runner untuk mengunduh binary stream dari cloud server.

---

## 2. Arsitektur Solusi Terpadu

```
[Klien Mengunggah Berkas / Dokumen / Lampiran]
                       │
                       ▼
         [Dokploy Cloud Server & S3]
         (Database Dokumen & Object Storage)
                       │
                       │ 1. Super Admin klik "Sinkronkan ke Synology Sekarang"
                       ▼
            [Queue Job: PENDING]
                       │
                       │ 2. Runner Laptop Fedora Poll (GET /sync-agent/poll)
                       │    Server mengirim Job + Manifest Berkas Cloud
                       ▼
    [Runner Service: easylegal-synology-runner]
                       │
                       │ 3. Runner membandingkan manifest lokal (.sync-manifest.json)
                       │ 4. Runner mengunduh berkas baru via:
                       │    GET /api/storage/sync-agent/download/:type/:id
                       ▼
[Folder Lokal: ~/SynologyDrive/EmailPortal_ColdStorage]
  ├── accounts/
  │   └── apaajapt@clienteasylegal.co.id/
  │       ├── account-info.json
  │       ├── documents/
  │       │   └── Background Banner.jpg
  │       └── attachments/
  └── .sync-manifest.json
                       │
                       │ 5. Synology Drive Client (inotify daemon)
                       ▼
       [Synology NAS Kantor / Cold Storage]
```

---

## 3. Komponen & Endpoint API

### A. Cloud Server (`backend/src/routes/storage.ts`)
1. **`GET /api/storage/sync-agent/poll`** (Diakses Runner Laptop dengan `X-Runner-Secret-Token`)
   - Memeriksa antrean job aktif.
   - Menghasilkan manifest ekspor (`generateExportManifest()`) yang memuat seluruh metadata akun dan daftar berkas (dokumen, lampiran, avatar) beserta path unik per akun.
2. **`GET /api/storage/sync-agent/download/:type/:id`** (Diakses Runner Laptop)
   - Mengambil buffer file dari storage S3 / local disk.
   - Mengirimkan stream binary dengan header `Content-Type`, `Content-Length`, dan `Content-Disposition`.
3. **`POST /api/storage/sync-agent/complete`**
   - Menerima laporan penyelesaian dari laptop runner (`syncedCount`, `skippedCount`, `totalBytesCopied`, `errors`).

### B. Laptop Runner Daemon (`backend/scripts/sync-agent.ts`)
- Berjalan mandiri tanpa dependensi database lokal.
- Mengelola folder `/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage`.
- Menulis `account-info.json` untuk setiap pelanggan.
- Mengunduh file baru/berubah secara efisien dan memperbarui `.sync-manifest.json`.
- Melaporkan progress kembali ke dashboard cloud secara real-time.
