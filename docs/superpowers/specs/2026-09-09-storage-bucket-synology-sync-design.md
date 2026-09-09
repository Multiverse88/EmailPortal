# Design Spec: Unified Storage Adapter & Synology Drive Sync Bridge

## 1. Overview & Objectives

Sistem penyimpanan Email Portal dirancang untuk mendukung strategi **Hybrid Storage**:
1. **Hot Storage (Siklus 0 - 90 Hari)**:
   - File tersimpan di Object Storage S3 (IDCloudHost di production, atau Local Emulated Bucket di development) untuk akses cepat melalui web portal.
2. **Cold Storage / Permanent Archive (Synology NAS)**:
   - File disalin ke folder kerja **Synology Drive Client** (`~/SynologyDrive/EmailPortal_ColdStorage`), sehingga aplikasi Synology Drive yang aktif di komputer langsung mengunggahnya ke NAS kantor secara otomatis di background.
3. **Penyimpanan Lokal Dev & Sinkronisasi On-Demand**:
   - Mendukung switch mode storage via `.env` (`STORAGE_DRIVER=local` atau `s3`).
   - Menyediakan antarmuka visual di dashboard Admin (`/admin`) dan perintah CLI (`npm run storage:sync-synology`) untuk memicu sinkronisasi manual atau terjadwal ke Synology Drive Client kapan pun dibutuhkan.
4. **Kebijakan Retensi 90 Hari & Pemulihan via Tiket Bantuan**:
   - Setelah 90 hari, file di S3 dibersihkan secara otomatis via S3 Lifecycle Rule.
   - Portal web mendeteksi usia berkas (> 90 hari) dan mengarahkan pengguna untuk membuat tiket bantuan pre-filled ke tim legal guna mengambil arsip dari Synology NAS.

---

## 2. Arsitektur & Struktur Direktori

### 2.1 Konfigurasi Environment (`.env`)
```bash
# Driver mode: 'local' | 's3'
STORAGE_DRIVER=local
STORAGE_DIR=./storage

# IDCloudHost S3 (Dipakai saat STORAGE_DRIVER=s3)
S3_ENDPOINT=https://is3.cloudhost.id
S3_BUCKET=emailportal
S3_ACCESS_KEY_ID=4MXLOEG0T3G835XWTNB9
S3_SECRET_ACCESS_KEY=
S3_REGION=ap-southeast-3

# Synology Drive Client Bridge (Folder yang dipantau Synology Drive Client)
SYNOLOGY_DIR=/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage
```

### 2.2 Hirarki Folder Penyimpanan

#### Local Bucket Storage (`STORAGE_DRIVER=local`)
```text
backend/storage/
└── buckets/
    └── emailportal/
        ├── documents/
        │   └── {customerId}/
        │       └── {documentId}_{cleanFilename}
        └── attachments/
            └── {mailboxId}/
                └── {messageId}/
                    └── {attachmentId}_{cleanFilename}
```

#### Synology Drive Client Mirror (`SYNOLOGY_DIR`)
```text
~/SynologyDrive/EmailPortal_ColdStorage/
├── documents/
│   └── {customerId}/
│       └── {documentId}_{cleanFilename}
├── attachments/
│   └── {mailboxId}/
│       └── {attachmentId}_{cleanFilename}
└── .sync-manifest.json    # Catatan riwayat file yang berhasil disinkronkan
```

---

## 3. Komponen Backend

### 3.1 Modular Storage Adapter (`backend/src/lib/storage.ts`)
Menyediakan antarmuka terpadu (Unified Storage Interface) yang membungkus driver `local` dan `s3`:
- `putObject(key: string, buffer: Buffer, mimeType: string): Promise<string>`
- `getObjectStream(key: string): Promise<ReadableStream | NodeJS.ReadableStream>`
- `deleteObject(key: string): Promise<void>`
- `objectExists(key: string): Promise<boolean>`
- `mirrorToSynology(relPath: string, buffer: Buffer): Promise<boolean>`

### 3.2 Synology Synchronization Service (`backend/src/lib/synology-sync.ts`)
Mengelola sinkronisasi on-demand antara database/storage lokal ke Synology:
- `getSynologyStatus()`:
  - Memeriksa apakah `SYNOLOGY_DIR` dapat diakses / writable.
  - Membaca `.sync-manifest.json`.
  - Menghitung total dokumen dan lampiran yang telah tersinkronisasi vs pending.
  - Mengembalikan waktu sinkronisasi terakhir (`lastSyncAt`).
- `runSynologySync()`:
  - Memindai semua rekam data `LegalDocument` dan `Attachment` di database.
  - Memastikan berkas sumber ada di storage lokal/S3.
  - Menyalin berkas yang belum ada ke `SYNOLOGY_DIR`.
  - Memperbarui manifest dan mengembalikan statistik (`syncedCount`, `skippedCount`, `failedCount`, `totalBytesCopied`).

### 3.3 Storage & Sync API Routes (`backend/src/routes/storage.ts`)
Diproteksi dengan autentikasi Admin (`authenticateAdmin` middleware):
- `GET /api/storage/synology-status`:
  - Mengembalikan payload status keterhubungan, lokasi path, total file tersinkronisasi, dan timestamp sinkronisasi terakhir.
- `POST /api/storage/sync-synology`:
  - Menjalankan proses sinkronisasi dan mengembalikan laporan ringkasan.

### 3.4 CLI Synchronization Runner (`backend/scripts/sync-synology.ts`)
- Script mandiri yang dapat dijalankan lewat terminal:
  ```bash
  npm run storage:sync-synology
  ```
- Mendukung opsi `--dry-run` untuk melihat file mana saja yang akan disinkronkan tanpa menyalin data fisik.

---

## 4. Antarmuka Pengguna Admin (UI/UX)

### 4.1 Lokasi Halaman
Ditempatkan pada halaman [**`/admin`**](file:///home/fullstackiteasylegal/Documents/Email%20Portal%20Customer/frontend/src/app/admin/page.tsx) di bawah kartu metrik KPI utama.

### 4.2 Desain Komponen ("Synology Cold Storage Bridge")
- **Status Indicator**:
  - Hijau: *Folder Synology Terhubung* (`~/SynologyDrive/EmailPortal_ColdStorage`)
  - Kuning: *Folder Belum Terdeteksi* (Menyediakan tombol "Inisialisasi Folder")
- **Statistik Metrik**:
  - Total berkas di Cold Storage (dokumen legal + lampiran email)
  - Terakhir kali disinkronkan (format waktu relatif: misal *"5 menit yang lalu"*)
- **Tombol Aksi**:
  - Tombol **"Sinkronkan ke Synology Sekarang"** dengan ikon `RefreshCw` beranimasi putar saat proses sinkronisasi berlangsung.
  - Toast feedback visual setelah sinkronisasi selesai (menampilkan jumlah berkas baru yang disalin).

---

## 5. Kebijakan Retensi 90 Hari & Smart Age Detection

### 5.1 Aturan Siklus Dokumen & Lampiran
- Dokumen dan lampiran dihitung usianya berdasarkan `createdAt` (atau `receivedAt` pada email).
- Jika usia $\le 90$ hari:
  - Berkas berada di Hot Storage (bisa diunduh langsung / dipratinjau).
- Jika usia $> 90$ hari:
  - Berkas dianggap telah kadaluarsa dari bucket S3.
  - Pada UI, berkas ditandai dengan badge **"Arsip Cold Storage (> 3 Bulan)"**.
  - Tombol download/preview mengarahkan pengguna ke halaman pembuatan tiket dengan parameter:
    `category=Permohonan File Arsip&subject=Permohonan Akses File: [Nama File]`
  - Staf legal dapat membuka Synology NAS kantor, mengambil berkas, dan membalas tiket bantuan klien.

---

## 6. Rencana Pengujian & Verifikasi

1. **Pengujian Unit & Adapter**:
   - Uji penyimpanan berkas dengan driver `local`.
   - Uji verifikasi pembuatan mirror di folder `SYNOLOGY_DIR`.
2. **Pengujian API**:
   - `GET /api/storage/synology-status` mengembalikan 200 OK dengan format status yang valid.
   - `POST /api/storage/sync-synology` menyalin berkas yang belum ada dan mencatatnya di `.sync-manifest.json`.
3. **Pengujian Frontend UI**:
   - Kartu Synology di `/admin` menampilkan status live.
   - Menekan tombol "Sinkronkan" memicu API dan menampilkan toast notifikasi hasil.
4. **Pengujian Integrasi Synology Client**:
   - Memverifikasi berkas yang disalin muncul di `/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage` dan siap diunggah oleh Synology Drive Client ke NAS.
