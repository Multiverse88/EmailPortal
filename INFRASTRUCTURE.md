# Arsitektur Infrastruktur & Storage Lifecycle — Email Portal Customer

Dokumen ini menjelaskan arsitektur infrastruktur sistem **Email Portal Customer**, strategi penyimpanan **Hybrid Storage (Hot & Cold Storage)**, estimasi kapasitas serta alur data dari penerimaan dokumen hingga pengarsipan jangka panjang ke Synology NAS tanpa mengubah konfigurasi jaringan lokal kantor.

---

## 1. Ringkasan Eksekutif

| Parameter | Spesifikasi & Strategi |
|---|---|
| **Estimasi Beban** | 1.000 Customer / Bulan |
| **Hot Storage (Cloud)** | IDCloudHost Object Storage (S3-Compatible) |
| **Masa Retensi Hot Storage** | 3 Bulan (Rolling Window / Steady-State) |
| **Kapasitas Hot Storage Stabil** | ~150 GB – 250 GB |
| **Cold Storage (On-Premises)** | Synology NAS (Folder Arsip Dokumen Kantor) |
| **Jembatan Sinkronisasi (Bridge)** | Laptop Admin + Synology Drive Client (0 Konfigurasi di NAS/Router) |
| **Biaya Cloud Storage** | Flat ~Rp 80.000 – Rp 140.000 / bulan |
| **Platform Hosting** | Cloud VPS IDCloudHost (Dikelola via Dokploy) |

---

## 2. Diagram Arsitektur Infrastruktur (System Architecture)

Diagram berikut memetakan relasi antara pengguna, server VPS Dokploy di IDCloudHost, S3 Object Storage, dan Synology NAS lokal:

```mermaid
flowchart TD
    %% Styling & Classes
    classDef client fill:#EBF5FB,stroke:#2980B9,stroke-width:2px,color:#1B4F72;
    classDef cloud fill:#E8F8F5,stroke:#16A085,stroke-width:2px,color:#0E6251;
    classDef storage fill:#FEF9E7,stroke:#F39C12,stroke-width:2px,color:#7D6608;
    classDef local fill:#F4ECF7,stroke:#8E44AD,stroke-width:2px,color:#512E5F;

    subgraph USERS["Public Internet & Pengguna"]
        Customer["Customer / Klien<br/>(Web Browser / Mobile)"]:::client
        Admin["Admin / Legal Staff<br/>(Dashboard Browser)"]:::client
    end

    subgraph IDCLOUDHOST["IDCloudHost Data Center (Indonesia)"]
        subgraph VPS_DOKPLOY["VPS Dokploy Server"]
            Traefik["Reverse Proxy Traefik<br/>(SSL / Auto HTTPS)"]:::cloud
            Frontend["Frontend Next.js<br/>(Portal UI)"]:::cloud
            Backend["Backend Express.js<br/>(API & Business Logic)"]:::cloud
            Worker["Sync Worker Service<br/>(IMAP / Mail Sync)"]:::cloud
            Postgres[("PostgreSQL DB<br/>(Metadata, Auth & Logs)")]:::cloud
            Redis[("Redis Cache<br/>(Session & Queue)")]:::cloud
        end

        subgraph HOT_STORAGE["Hot Storage (0 - 3 Bulan)"]
            S3Storage[("IDCloudHost Object Storage<br/>(S3-Compatible Bucket)<br/>Kapasitas: ~150-250 GB")]:::storage
        end
    end

    subgraph LOCAL_OFFICE["Lingkungan Kantor / Lokal (Private Network)"]
        subgraph ADMIN_WORKSTATION["Laptop / PC Administrator"]
            ArchiveTool["Archival Tool / Script<br/>(Tarik data > 3 Bulan)"]:::local
            SyncClient["Synology Drive Client<br/>(Background Daemon)"]:::local
            LocalFolder["Local Folder Arsip<br/>(Staging Sinkronisasi)"]:::local
        end

        subgraph SYNOLOGY_ECOSYSTEM["On-Premises Private Storage"]
            NAS["Synology NAS Server<br/>(Cold Storage Permanen)<br/>*0 Konfigurasi Router / No Public IP*"]:::local
        end
    end

    %% Network & Data Flows
    Customer -->|HTTPS / Akses Portal| Traefik
    Admin -->|HTTPS / Akses Dashboard| Traefik
    Traefik --> Frontend
    Traefik --> Backend

    Frontend <--> Backend
    Backend <--> Postgres
    Backend <--> Redis
    Worker <--> Backend

    Backend -->|1. Simpan & Baca Berkas Lampiran| S3Storage

    %% Archival Flows
    ArchiveTool -.->|2. Download Arsip Berkala| S3Storage
    ArchiveTool -.->|Simpan File Lama| LocalFolder
    LocalFolder <--> SyncClient
    SyncClient ==|3. Otomatis Sync via QuickConnect / LAN|==> NAS

    ArchiveTool -.->|4. Purge File Lama dari S3| S3Storage
```

---

## 3. Diagram Alur Siklus Dokumen (Data Lifecycle)

Alur berkas dari saat diunggah customer, disimpan di Hot Storage S3 selama 90 hari, hingga diarsipkan ke NAS:

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer / Staf
    participant VPS as Backend VPS (Dokploy)
    participant S3 as IDCloudHost S3 (Hot)
    participant Laptop as Laptop (Admin PC)
    participant NAS as Synology NAS (Cold)

    %% Fase Hot Storage
    Note over User, S3: FASE HOT STORAGE (Bulan 1 - 3 / 90 Hari)
    User->>VPS: Upload Dokumen / Email Masuk
    VPS->>S3: PutObject (Simpan PDF / Berkas ke S3)
    S3-->>VPS: Simpan URL Path / Key
    VPS-->>User: Berkas Tersedia & Siap Diakses Cepat
    User->>VPS: Request Preview / Unduh Berkas
    VPS->>S3: GetObject / Signed URL
    S3-->>User: Streaming Dokumen

    %% Fase Archival / Cold Storage
    Note over S3, NAS: FASE COLD STORAGE (> 3 Bulan / Pengarsipan)
    Note over Laptop: Admin menjalankan download arsip berkala (1x sebulan/kuartal)
    Laptop->>S3: Download berkas usia > 90 hari
    S3-->>Laptop: File tersimpan di folder Synology Drive lokal
    Note over Laptop, NAS: Synology Drive Client mendeteksi file baru di folder
    Laptop->>NAS: Sinkronisasi otomatis via LAN / QuickConnect
    NAS-->>Laptop: Konfirmasi data tersimpan di Volume Hard Disk NAS
    Laptop->>S3: DeleteObject (Hapus berkas lama dari S3 untuk hemat biaya)
```

---

## 4. Rincian Komponen Infrastruktur

### A. Compute & Platform Layer (IDCloudHost VPS)
* **Dokploy PaaS**: Berfungsi sebagai orkestrator kontainer (Docker) mandiri di VPS untuk mengelola database, redis, backend, dan frontend secara otomatis.
* **Traefik Reverse Proxy**: Menangani routing domain (`mail.clienteasylegal.co.id`), rate limiting, dan auto-renewal sertifikat SSL Let's Encrypt.
* **Backend & Worker**: Menjalankan Node.js untuk menangani REST API, IMAP sync dengan Hostinger, dan adapter S3.
* **Database (PostgreSQL)**: Menyimpan metadata dokumen (nama file, hash, ukuran, relasi user, timestamp), bukan file fisik biner.

### B. Hot Storage Layer (IDCloudHost Object Storage S3)
* **Standard**: S3-Compatible API.
* **Fungsi**: Menyimpan berkas biner aktif (PDF kontrak, scan identitas, lampiran email).
* **Keunggulan**:
  * **Zero VPS Disk Bloat**: Hard disk SSD VPS tetap bersih dan tidak akan kehabisan ruang.
  * **Intranet Speed**: Karena VPS dan S3 berada di data center IDCloudHost yang sama, latensi transfer data sangat rendah (< 2 ms).
  * **High Availability**: Redundansi multi-node IDCloudHost memastikan file tidak hilang jika VPS mengalami restart/maintenance.

### C. Cold Storage Layer (Synology NAS & Drive Client)
* **Fungsi**: Arsip permanen jangka panjang untuk keperluan audit hukum dan retensi data bertahun-tahun.
* **Mekanisme Bridge**:
  * Menggunakan **Synology Drive Client** yang terpasang di komputer/laptop administrator.
  * Tidak memerlukan pembukaan port router (Port Forwarding), tidak memerlukan IP publik statis di kantor, dan tidak memerlukan instalasi aplikasi tambahan di DSM NAS.
  * Laptop bertindak sebagai agen transisi: file yang ditarik dari S3 langsung dimasukkan ke folder sinkronisasi Synology, lalu ditransfer ke NAS secara aman melalui jalur terenkripsi Synology QuickConnect atau WiFi LAN lokal.

---

## 5. Analisis Kapasitas & Estimasi Biaya

### Proyeksi Kapasitas (1.000 Pengguna / Bulan)

* **Rata-rata Dokumen**: ~15–20 berkas/dokumen per customer per bulan.
* **Rata-rata Ukuran Dokumen**: ~3 MB – 5 MB (gabungan surat teks, PDF resmi, dan lampiran scan).
* **Akumulasi per User**: ~75 MB / customer.

$$\text{Kebutuhan Bulanan} = 1.000 \times 75\text{ MB} = 75\text{ GB / Bulan}$$

Dengan kebijakan **Rolling Window 3 Bulan**:

$$\text{Steady-State Storage S3} = 75\text{ GB} \times 3 = \mathbf{225\text{ GB}}$$

### Estimasi Biaya Bulanan

| Komponen | Spesifikasi | Estimasi Biaya / Bulan |
|---|---|---|
| **Object Storage S3** | IDCloudHost (225 GB @ Rp 507/GB) | ~Rp 114.000 |
| **VPS Server (Dokploy)** | 2 vCPU, 4 GB RAM, 40-50 GB SSD | ~Rp 150.000 – Rp 200.000 |
| **Cold Storage (NAS)** | Synology Drive On-Premises | **Rp 0** (Hardware sudah dimiliki) |
| **Total Estimasi** | Infrastruktur Full Cloud + Hot Storage | **~Rp 264.000 – Rp 314.000 / bulan** |

> **Catatan:** Setelah bulan ke-3, tagihan Object Storage akan terkunci stabil (flat) karena dokumen lama yang berumur > 90 hari dipindahkan ke NAS dan dihapus dari S3.

---

## 6. Aspek Keamanan & Kepatuhan Regulasi

1. **Kedaulatan Data (UU Pelindungan Data Pribadi / PDP)**:
   * Seluruh data aktif tersimpan di pusat data lokal Indonesia (IDCloudHost Data Center).
2. **Isolasi Jaringan NAS Kantor**:
   * NAS kantor tidak dibuka ke internet publik, menghilangkan risiko serangan brute-force, ransomware, atau scanning port dari peretas luar.
3. **Enkripsi End-to-End**:
   * Komunikasi Web ke VPS: HTTPS (TLS 1.3).
   * Komunikasi VPS ke S3: S3 HTTPS API dengan Signature V4.
   * Komunikasi Laptop ke NAS: Enkripsi SSL bawaan Synology Drive Client.
