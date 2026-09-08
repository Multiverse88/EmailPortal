# Design Document: EasyLegal Hub Extended Modules

- **Tanggal**: 2026-09-08
- **Topik**: Integrasi Modul EasyLegal Hub (Account Settings, Login Activity & Security, Legal Documents & Document Preview, Support Helpdesk & Ticket Thread)
- **Status**: Disetujui (Approved by User)

---

## 1. Ringkasan & Tujuan (Overview & Goals)

Tujuan dari proyek ini adalah mentransformasikan portal email EasyLegal menjadi **EasyLegal Suite & Hub** yang komprehensif, mengadopsi mental model Google Workspace (Gmail, Drive, Google Admin) yang dipadukan dengan wibawa brand EasyLegal Corporate Law (`#680003` Legal Red, `#FDFCFB` Surface Cream).

Empat modul inti yang diintegrasikan:
1. **Account Settings (`/settings`)**: Tab navigasi *General*, *Profile*, *Security*, dan *Notifications* untuk mengelola preferensi pengguna dan profil mailbox.
2. **Login Activity & Security (`/settings?tab=security` atau `/security`)**: Fitur keamanan akun mencakup Two-Factor Authentication (2FA) toggle, ganti kata sandi, aksi darurat *"Terminate Other Sessions"*, dan tabel audit sesi login aktif (*Recent Login Activity*).
3. **Legal Documents Drive & Document Preview (`/documents`)**: Repositori berkas legal bergaya Google Drive dengan navigasi folder, bento grid kartu file, dan **Document Preview Modal/View** yang menampilkan preview lembar dokumen, metadata berkas, riwayat versi (*Version History*), tombol download, dan hapus berkas.
4. **Support Helpdesk & Ticket Thread (`/support`)**: Pusat bantuan legal pelanggan dengan banner kontak darurat 24/7, FAQ akordeon, daftar tiket aktif (*Active Tickets*), serta **Interactive Ticket Conversation Thread** dengan obrolan dua arah antara klien, agen support, catatan internal tim (*internal note*), dan editor balasan pesan (*reply composer*).

---

## 2. Arsitektur Navigasi & App Launcher

### 2.1 Google-Style App Launcher (Grid 9-Dots)
Pada header global (`/inbox`, `/documents`, `/support`, `/settings`), terdapat ikon launcher aplikasi 9-titik (`apps`) yang membuka popover menu untuk berpindah antar aplikasi:
* ✉️ **EasyLegal Mail** (`/inbox`): Kotak surat masuk, kirim email, arsip.
* 📄 **Legal Drive** (`/documents`): Repositori berkas hukum & preview dokumen.
* 🎫 **Support Helpdesk** (`/support`): Layanan tiket bantuan hukum & FAQ.
* ⚙️ **Settings & Security** (`/settings`): Profil akun, keamanan 2FA, dan sesi login.

### 2.2 Shared Layout & Desain Stitch
* Menggunakan token warna Stitch:
  * Primary Burgundy: `#680003` / `#930006`
  * Surface Cream: `#FDFCFB`
  * Background Light: `#F8F9FA`
  * Subtle Border: `#DADCE0` / `border-slate-200`
* Navigasi sidebar 256px di setiap halaman dengan indikator aktif pil (*rounded-r-full*).

---

## 3. Skema Data & Relasi Backend (Prisma SQLite)

### 3.1 Model Customer (Penambahan Field)
```prisma
model Customer {
  // ... field eksisting: id, name, personalEmail, mailboxAddress, passwordEnc, status, createdAt, updatedAt, lastLoginAt
  twoFactorEnabled  Boolean         @default(false)
  preferences       String?         // JSON: { language: "id", timezone: "Asia/Jakarta", signature: "...", notifyEmail: true, notifySound: true }

  documents         LegalDocument[]
  tickets           SupportTicket[]
  sessions          LoginSession[]
  // ...
}
```

### 3.2 Model LoginSession
```prisma
model LoginSession {
  id           String    @id @default(uuid())
  customerId   String
  deviceName   String    // e.g. "MacBook Pro 16\""
  deviceType   String    // "laptop" | "mobile" | "desktop"
  browser      String    // e.g. "Chrome 120"
  ipAddress    String    // e.g. "182.253.140.22"
  location     String    // e.g. "Jakarta, Indonesia"
  isCurrent    Boolean   @default(false)
  lastActiveAt DateTime  @default(now())
  createdAt    DateTime  @default(now())

  customer     Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId])
}
```

### 3.3 Model LegalDocument & DocumentVersion
```prisma
model LegalDocument {
  id          String            @id @default(uuid())
  customerId  String
  title       String            // e.g. "Master Service Agreement v2.pdf"
  category    String            // "Client Agreements" | "Tax Filings" | "NDA Templates"
  filename    String
  mimeType    String            @default("application/pdf")
  size        Int               @default(0) // bytes
  path        String            // file path relative to backend/storage
  status      String            @default("Reviewed") // "Urgent Review" | "Reviewed" | "Approved"
  isStarred   Boolean           @default(false)
  ownerName   String            @default("Legal Team")
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  customer    Customer          @relation(fields: [customerId], references: [id], onDelete: Cascade)
  versions    DocumentVersion[]

  @@index([customerId])
  @@index([category])
}

model DocumentVersion {
  id            String        @id @default(uuid())
  documentId    String
  versionNumber String        // "v2.1", "v2.0", "v1.0"
  authorName    String
  approved      Boolean       @default(true)
  notes         String?
  createdAt     DateTime      @default(now())

  document      LegalDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
}
```

### 3.4 Model SupportTicket & TicketMessage
```prisma
model SupportTicket {
  id           String          @id @default(uuid())
  customerId   String
  ticketNumber String          @unique // e.g. "#TK-4920"
  subject      String
  category     String          @default("Umum") // "Billing", "Document Review", "Access Revocation"
  status       String          @default("open") // "open", "resolved", "closed"
  priority     String          @default("normal") // "normal", "urgent"
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  customer     Customer        @relation(fields: [customerId], references: [id], onDelete: Cascade)
  messages     TicketMessage[]

  @@index([customerId])
  @@index([status])
}

model TicketMessage {
  id           String        @id @default(uuid())
  ticketId     String
  senderName   String
  senderRole   String        // "client", "agent", "system"
  senderAvatar String?
  message      String
  isInternal   Boolean       @default(false)
  createdAt    DateTime      @default(now())

  ticket       SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
}
```

---

## 4. Spesifikasi Endpoint REST API Backend

Seluruh endpoint pelanggan dilindungi oleh middleware `authenticateCustomer`:

### 4.1 Modul Pengaturan & Keamanan (`/api/settings` & `/api/security`)
* `GET /api/settings`: Mengembalikan informasi profil, preferensi, dan status 2FA pelanggan.
* `PUT /api/settings/preferences`: Memperbarui data preferensi (tanda tangan, bahasa, notifikasi).
* `POST /api/auth/change-password`: Memperbarui kata sandi akun pelanggan.
* `GET /api/security/sessions`: Mengembalikan daftar sesi perangkat aktif pelanggan.
* `POST /api/security/2fa/toggle`: Mengaktifkan / menonaktifkan fitur 2FA pelanggan.
* `POST /api/security/sessions/terminate-others`: Menghapus semua sesi kecuali sesi aktif (`isCurrent: true`).

### 4.2 Modul Dokumen Legal (`/api/documents`)
* `GET /api/documents`: Mengambil daftar folder dan berkas (bisa difilter berdasarkan folder/kategori, pencarian keyword, atau favorit).
* `GET /api/documents/:id`: Mengambil detail dokumen beserta riwayat versi.
* `GET /api/documents/:id/download`: Mengunduh berkas fisik dokumen dari penyimpanan storage.
* `POST /api/documents/upload`: Menerima berkas upload via `multipart/form-data` dan menyimpannya ke storage disk.
* `PATCH /api/documents/:id/star`: Menandai / menghapus bintang favorit dokumen.
* `DELETE /api/documents/:id`: Menghapus berkas dokumen dari drive.

### 4.3 Modul Support Helpdesk (`/api/support`)
* `GET /api/support/tickets`: Mengambil daftar tiket bantuan milik pelanggan.
* `GET /api/support/tickets/:id`: Mengambil detail tiket dan percakapan thread pesan.
* `POST /api/support/tickets`: Membuat tiket bantuan baru.
* `POST /api/support/tickets/:id/reply`: Mengirim pesan balasan ke dalam tiket.
* `POST /api/support/tickets/:id/close`: Menutup status tiket menjadi *resolved*.

---

## 5. Rincian Antarmuka Frontend (Next.js Pages)

### 5.1 Account Settings & Security (`/settings`)
* **Tab Navigasi**:
  * **General**: Pemilihan bahasa (ID/EN), zona waktu, pengaturan Rich Signature editor.
  * **Profile**: Kartu identitas pengguna, status mailbox, nama, email, perusahaan.
  * **Security & Activity**:
    * **Kartu 2FA**: Switch toggle Two-Factor Authentication dengan status badge interaktif.
    * **Kartu Ubah Password**: Input kata sandi lama, kata sandi baru, konfirmasi sandi dengan tombol intip dan kriteria keamanan sandi.
    * **Kartu Darurat**: Tombol merah *"Sign out of all other sessions"* untuk memutuskan sesi perangkat lain.
    * **Tabel Recent Login Activity**: Baris sesi aktif dengan penanda *Current Device* (hijau/merah container), IP address, lokasi kota, browser, dan timestamp.
  * **Notifications**: Toggle peringatan suara dan popup browser saat ada email masuk.

### 5.2 Legal Documents Drive & Preview (`/documents`)
* **Sidebar Repositori**:
  * Tombol pil *"Upload File"*.
  * Tab navigasi: *My Files*, *Recent*, *Starred*, *Shared with me*, *Trash*.
  * Indikator pemakaian kuota storage (mis. `4.2 GB / 15 GB`, progress bar 28%).
* **Canvas Utama**:
  * Breadcrumb navigasi folder (*My Files > Q3 Contracts*).
  * Bagian Folder: Kartu folder *Client Agreements*, *Tax Filings 2023*, *NDA Templates*.
  * Bento Grid Berkas: Kartu thumbnail PDF/DOCX/JPG dengan badge status (*Urgent Review*, *Reviewed*), ukuran, tanggal, dan tombol opsi.
* **Modal / View Document Preview**:
  * Klik kartu membuka viewer dokumen.
  * Bagian kiri/tengah: Preview lembar dokumen resmi (berkas asli dari backend storage seperti `sk-kemenkumham-2026.pdf` atau preview visual terstruktur jika file berupa kontrak).
  * Bagian kanan: Metadata lengkap, tombol **Download** & **Share**, riwayat versi (*Version History Timeline* dengan badge *Approved*), dan tombol hapus.

### 5.3 Support Helpdesk & Ticket Thread (`/support`)
* **Layar Help Center**:
  * Input pencarian knowledge base.
  * Banner kontak darurat 24/7 dengan tombol *"Contact Live Support"*.
  * Tab filter tiket: *Active Tickets* vs *Resolved*.
  * Daftar tiket dengan label status (*Open*, *Resolved*, *Urgent*), nomor tiket (*#TK-4920*), dan waktu pembaruan.
  * Sidebar FAQ akordeon interaktif.
* **Tampilan Ticket Thread**:
  * Klik tiket membuka ruang percakapan.
  * Header tiket dengan judul masalah, nomor tiket, status badge ganda (*Urgent + Open*), dan tombol *"Close Ticket"*.
  * Riwayat obrolan: Balon pesan Klien, Balon pesan Agen Dukungan, dan Catatan Internal tim bergaris putus-putus (*internal note*).
  * Editor balasan (*Reply Box*) dengan toolbar teks, attachment, tombol *"Save Draft"*, dan tombol *"Send Message"*.

---

## 6. Data Seeder & Demo
Untuk memastikan aplikasi langsung dapat dicoba secara realistis:
* Seeder akan membuat dokumen awal yang terhubung ke file riil di `backend/storage/` (`sk-kemenkumham-2026.pdf`, `perjanjian-kerjasama.pdf`, `invoice-2025-088.pdf`, `panduan-trial.pdf`).
* Tiket support realistis (*#TK-4920: Document Review Delay*, *#TK-4811: Billing Discrepancy*, *#TK-4925: Access Revocation Error*) lengkap dengan riwayat obrolan dua arah.
* Sesi login audit awal (MacBook Pro 16" [Current], iPhone 14 Pro, Windows Desktop).

---

## 7. Strategi Verifikasi & Testing
1. **Prisma & Migration Check**: Verifikasi skema database diperbarui dengan aman tanpa merusak data mailbox yang sudah ada.
2. **Backend API Testing**: Pengujian endpoint dokumen, tiket, sesi, dan pengaturan menggunakan request HTTP.
3. **Frontend Functional Testing**:
   * Tes navigasi App Launcher di header.
   * Tes alur ganti password dan toggle 2FA di `/settings`.
   * Tes terminate other sessions di daftar sesi login.
   * Tes browse folder, buka Document Preview, dan unduh berkas di `/documents`.
   * Tes buka detail tiket support, balas pesan di thread, dan tutup tiket di `/support`.
