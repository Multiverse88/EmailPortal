export interface CompanionQuickAction {
  label: string;
  action: string;
  url?: string;
  category?: string;
  subject?: string;
  message?: string;
  priority?: 'normal' | 'urgent';
}

export interface KnowledgeItem {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  content: string;
  pose: 'greeting' | 'thinking' | 'document' | 'tips' | 'suggestion' | 'happy' | 'enthusiastic';
  quickActions?: CompanionQuickAction[];
}

export const PORTAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: 'about-easylegal-portal',
    title: 'Tentang Portal EasyLegal & Panduan Fitur',
    keywords: [
      'tentang portal',
      'tentang website',
      'apa itu easylegal',
      'apa ini',
      'fungsi portal',
      'fungsi website',
      'fitur portal',
      'fitur website',
      'halaman website',
      'menu portal',
      'tujuan website',
      'cara pakai portal',
      'layanan portal',
    ],
    summary: 'EasyLegal Customer Portal adalah platform terpadu untuk email korporasi dan manajemen dokumen legal.',
    content: '**EasyLegal Customer Portal** adalah platform terpadu yang dirancang khusus untuk klien EasyLegal dalam mengelola komunikasi surat-menyurat resmi dan penyimpanan dokumen hukum penting.\n\nPortal ini menyediakan 4 menu utama:\n1. **Kotak Masuk (/inbox)**: Email korporasi resmi berbasis Titan Mail Hostinger, manajemen folder (Inbox, Sent, Drafts, Trash, Spam), unduh lampiran, dan privasi sanitasi gambar email.\n2. **Dokumen (/documents)**: Legal Drive berbasis Cloud S3 (kuota 5 GB) untuk menyimpan Akta, Kontrak, Pajak, dan Perizinan, dengan sinkronisasi Cold Storage Synology NAS.\n3. **Bantuan (/support)**: Layanan helpdesk tiket untuk permohonan arsip berkas, kendala teknis backend, billing, dan telaah hukum (SLA 1x24 jam kerja).\n4. **Pengaturan (/settings)**: Kelola profil akun, upload logo/avatar (maks 3 MB), ganti password, pantau kuota, dan aktifkan proteksi 2FA.',
    pose: 'greeting',
    quickActions: [
      { label: '✉️ Kotak Masuk', action: 'navigate', url: '/inbox' },
      { label: '📁 Legal Drive', action: 'navigate', url: '/documents' },
      { label: '🎫 Pusat Bantuan', action: 'navigate', url: '/support' },
    ],
  },
  {
    id: 'scope-and-unsupported-features',
    title: 'Cakupan Layanan Portal & Batasan Fitur',
    keywords: [
      'whatsapp',
      'wa',
      'whatsapp gateway',
      'whatsapp api',
      'wa bot',
      'resi',
      'cek resi',
      'ekspedisi',
      'kurir',
      'pengiriman barang',
      'paket pengiriman',
      'ongkir',
      'toko online',
      'marketplace',
      'jual beli',
      'beli barang',
    ],
    summary: 'EasyLegal Customer Portal khusus untuk email korporasi resmi dan manajemen berkas hukum, tidak menyediakan WhatsApp API atau pelacakan ekspedisi.',
    content: '**EasyLegal Customer Portal** secara khusus berfokus sebagai **Platform Email Korporasi Resmi & Legal Document Hub**.\n\nLayanan portal ini **tidak menyediakan maupun mendukung**:\n- ❌ **WhatsApp API / WhatsApp Gateway**: Seluruh komunikasi email resmi korporasi dikelola melalui **Hostinger Titan Mail (Webmail)** di menu Kotak Masuk.\n- ❌ **Pelacakan Resi / Ekspedisi / Kurir**: Portal ini mengelola berkas dokumen digital, bukan pengiriman barang fisik.\n- ❌ **Toko Online / Marketplace**: Portal ini adalah hub privat B2B khusus klien korporasi EasyLegal.\n\nFitur resmi yang tersedia di portal ini:\n1. **Kotak Masuk (/inbox)**: Email korporasi aman berbasis Titan Mail (IMAP/SMTP).\n2. **Legal Drive (/documents)**: Hot Storage S3 & Cold Storage Synology NAS.\n3. **Pusat Bantuan (/support)**: Layanan helpdesk tiket terpadu.\n4. **Pengaturan (/settings)**: Keamanan 2FA TOTP, kelola sesi & kuota storage.',
    pose: 'thinking',
    quickActions: [
      { label: '✉️ Kotak Masuk', action: 'navigate', url: '/inbox' },
      { label: '📁 Legal Drive', action: 'navigate', url: '/documents' },
      { label: '🎫 Pusat Bantuan', action: 'navigate', url: '/support' },
    ],
  },
  {
    id: 'backend-tech-architecture',
    title: 'Arsitektur Backend & Teknologi Sistem',
    keywords: [
      'arsitektur backend',
      'arsitektur sistem',
      'teknologi backend',
      'tech stack',
      'node.js',
      'express',
      'typescript',
      'prisma',
      'database backend',
      'sqlite',
      'postgresql',
      'arsitektur portal',
      'bagaimana backend bekerja',
      'teknologi apa yang dipakai',
    ],
    summary: 'Backend EasyLegal dibangun dengan Node.js, Express, TypeScript, Prisma ORM, terintegrasi Cloud S3 dan Titan Mail.',
    content: 'Arsitektur backend EasyLegal Portal dirancang tangguh, aman, dan modular:\n- **Runtime & Framework**: Node.js dengan Express dan TypeScript yang type-safe.\n- **Database & ORM**: Prisma ORM dengan SQLite untuk lingkungan pengembangan lokal dan siap produksi PostgreSQL.\n- **Mail Service**: Terintegrasi langsung dengan Hostinger Titan Mail melalui protokol IMAP & SMTP dengan enkripsi password AES-256-GCM.\n- **Storage Hybrid**: IDCloudHost Object Storage S3 (Hot Storage hingga 90 hari) dan Synology NAS lokal kantor (Cold Storage untuk berkas > 90 hari).\n- **Keamanan & Autentikasi**: JSON Web Tokens (JWT) dengan proteksi RBAC, 2FA TOTP RFC 6238, dan sanitasi email DOMPurify.\n- **AI Engine El**: Terhubung ke 9router AI API melalui backend proxy aman dengan fallback otomatis ke Smart Local Knowledge Base.',
    pose: 'thinking',
    quickActions: [
      { label: '⚙️ Status Sistem', action: 'navigate', url: '/settings' },
      { label: '🎫 Tanya Tim Teknis', action: 'open-support-modal', category: 'Kendala Teknis & Backend', priority: 'normal' },
    ],
  },
  {
    id: 'storage-cloud-synology',
    title: 'Penyimpanan Data: Hot Storage S3 & Cold Storage Synology NAS',
    keywords: [
      'di mana berkas',
      'di mana file',
      'di mana dokumen',
      'disimpan secara cloud',
      'disimpan di mana',
      'di mana berkas disimpan',
      'di mana file disimpan',
      'penyimpanan cloud',
      'hot storage',
      'cold storage',
      's3 idcloudhost',
      'synology nas kantor',
      'arsip berkas',
      'lokasi penyimpanan',
      'penyimpanan hybrid',
    ],
    summary: 'Berkas aktif disimpan di Cloud S3 IDCloudHost, dan diarsipkan ke Cold Storage Synology NAS setelah 90 hari.',
    content: 'Sistem penyimpanan portal menggunakan arsitektur hybrid bertingkat untuk menjamin keamanan dan kepatuhan hukum:\n1. **Hot Storage (Cloud S3 IDCloudHost)**: Menyimpan berkas legal aktif dan lampiran email Anda selama 90 hari pertama dengan kuota standar 5 GB per customer.\n2. **Cold Storage (Synology NAS Kantor)**: Berkas yang berumur lebih dari 90 hari diarsipkan secara aman dan terisolasi di Synology NAS kantor kami.\n\nJika Anda memerlukan kembali dokumen lama yang telah diarsipkan di Synology NAS, Anda cukup membuat tiket bantuan kategori **Permohonan Berkas Arsip** (diproses dalam SLA 1x24 jam kerja).',
    pose: 'document',
    quickActions: [
      { label: '📂 Buka Menu Dokumen', action: 'navigate', url: '/documents' },
      { label: '🎫 Permohonan Berkas Arsip', action: 'open-support-modal', category: 'Document Review', priority: 'normal' },
    ],
  },
  {
    id: 'security-data-encryption',
    title: 'Keamanan Akun, Enkripsi AES-256 & Privasi Email',
    keywords: [
      'keamanan data',
      'apakah aman',
      'enkripsi password',
      'enkripsi data',
      'aes-256',
      'jwt',
      'privasi email',
      'keamanan portal',
      'perlindungan akun',
      'keamanan akun',
    ],
    summary: 'EasyLegal Portal menerapkan standar keamanan tinggi dengan enkripsi AES-256-GCM, 2FA, dan sanitasi email.',
    content: 'EasyLegal Portal menerapkan standar perlindungan data tingkat tinggi:\n- **Enkripsi Kredensial**: Seluruh kata sandi akun dienkripsi menggunakan algoritma AES-256-GCM.\n- **Autentikasi Aman**: Didukung token JWT dengan verifikasi 2 langkah (**2FA TOTP**) via Google Authenticator.\n- **Manajemen Sesi**: Anda dapat melihat daftar perangkat login dan memutus sesi mencurigakan secara instan di menu Pengaturan.\n- **Privasi Email**: Sanitasi konten email otomatis menyaring kode asing dan memblokir *remote tracking pixel* pelacak lokasi/baca.',
    pose: 'tips',
    quickActions: [
      { label: '🔒 Pengaturan Keamanan & 2FA', action: 'navigate', url: '/settings' },
    ],
  },
  {
    id: 'portal-theme-appearance',
    title: 'Tema Tampilan: Mode Gelap & Mode Terang',
    keywords: [
      'dark mode',
      'mode gelap',
      'mode terang',
      'light mode',
      'ganti tema',
      'tampilan hitam',
      'tema tampilan',
      'ubah tema',
      'tema gelap',
    ],
    summary: 'EasyLegal Portal mendukung Mode Terang (Light Mode) dan Mode Gelap (Dark Mode) untuk kenyamanan visual.',
    content: 'EasyLegal Portal menyediakan dukungan **Mode Terang (Light Mode)** dan **Mode Gelap (Dark Mode)** demi kenyamanan visual Anda.\n\nAnda dapat mengganti tema kapan saja melalui tombol ikon matahari/bulan di bilah navigasi atas portal. Pilihan tema Anda akan otomatis tersimpan di peramban.',
    pose: 'happy',
    quickActions: [
      { label: '⚙️ Buka Pengaturan', action: 'navigate', url: '/settings' },
    ],
  },
  {
    id: 'retention-3months',
    title: 'Kebijakan Masa Aktif & Retensi Akun 3 Bulan',
    keywords: ['retensi', '3 bulan', 'masa aktif', 'kadaluarsa', 'expired', 'berapa lama', 'tenggat', 'tenggang', '90 hari'],
    summary: 'Akun dan penyimpanan data hanya bertahan selama 3 bulan (90 hari).',
    content: 'Kebijakan EasyLegal menetapkan bahwa **akun dan file penyimpanan Anda hanya bertahan selama 3 bulan (90 hari)** sejak akun dibuat. Memasuki **1 bulan terakhir (30 hari sebelum non-aktif)**, sistem akan memberikan pengingat agar Anda segera mem-backup dokumen mandiri.',
    pose: 'tips',
    quickActions: [
      { label: '📁 Cara Backup Dokumen', action: 'ask-backup' },
      { label: '🎫 Ajukan Tiket Perpanjangan', action: 'open-support-modal', category: 'Retensi & Masa Aktif Akun', priority: 'normal' },
    ],
  },
  {
    id: 'backup-files',
    title: 'Panduan Backup Berkas Mandiri',
    keywords: ['backup', 'cadangkan', 'unduh berkas', 'download file', 'simpan dokumen', 'ekspor'],
    summary: 'Langkah mem-backup berkas lampiran dan dokumen legal sebelum masa aktif berakhir.',
    content: 'Untuk mengamankan data Anda sebelum masa aktif berakhir:\n1. Buka menu **Dokumen** pada navigasi atas.\n2. Pilih berkas yang ingin disimpan dan klik tombol **Unduh**.\n3. Anda juga dapat memeriksa lampiran email di menu **Kotak Masuk** dan mengunduh berkas penting langsung ke perangkat Anda.',
    pose: 'document',
    quickActions: [
      { label: '📂 Buka Menu Dokumen', action: 'navigate', url: '/documents' },
      { label: 'ℹ️ Tanya Soal Retensi', action: 'ask-retention' },
    ],
  },
  {
    id: 'storage-quota-synology',
    title: 'Kapasitas Kuota S3 & Sinkronisasi Synology',
    keywords: ['kuota', 'storage', 'kapasitas', 'synology', 's3', 'penyimpanan penuh', 'sisa ruang', 'kuota drive'],
    summary: 'Penyimpanan utama menggunakan Object Storage S3 dengan replikasi Synology.',
    content: 'Penyimpanan portal terhubung dengan **Object Storage S3 IDCloudHost** serta replikasi **Synology Drive Mirror** (kuota standar 5 GB per customer). Kuota akun Anda dapat dipantau di menu **Pengaturan**. Jika kuota hampir penuh (>85%), unduh berkas arsip ke komputer lokal atau hubungi kami melalui tiket support.',
    pose: 'suggestion',
    quickActions: [
      { label: '⚙️ Cek Kuota di Pengaturan', action: 'navigate', url: '/settings' },
      { label: '🎫 Tiket Dukungan Kuota', action: 'open-support-modal', category: 'Storage & Drive', priority: 'normal' },
    ],
  },
  {
    id: 'support-tickets',
    title: 'Layanan Tiket Bantuan & Jaminan Respon 1x24 Jam',
    keywords: ['tiket', 'support', 'bantuan', 'cs', 'customer service', 'sla', '1x24 jam', 'kendala', 'keluhan'],
    summary: 'Solusi jika akun non-aktif atau terjadi kendala teknis dengan penanganan 1x24 jam.',
    content: 'Jika Anda mengalami kendala atau membutuhkan perpanjangan akun yang telah berstatus non-aktif, silakan buat tiket di menu **Bantuan / Support**. Tim Customer Care EasyLegal siap memproses tiket Anda dalam kurun waktu **maksimal 1x24 jam kerja** (atau kurang dari 4 jam untuk kendala urgent/darurat).',
    pose: 'enthusiastic',
    quickActions: [
      { label: '🎫 Buat Tiket Sekarang', action: 'open-support-modal' },
      { label: '📋 Riwayat Tiket Saya', action: 'navigate', url: '/support' },
    ],
  },
  {
    id: 'email-attachment-limit',
    title: 'Batas Ukuran Lampiran Email (10 MB)',
    keywords: ['lampiran', 'attachment', 'ukuran file', 'terlalu besar', '10mb', '10 mb', 'gagal kirim lampiran', 'file besar', 'batas lampiran'],
    summary: 'Batas lampiran email adalah 10 MB per berkas. Untuk berkas lebih besar, unggah ke Legal Drive S3.',
    content: 'Pengiriman lampiran email dibatasi maksimal **10 MB per berkas** (maksimal 5 berkas) sesuai protokol mail server. Jika dokumen Anda melebihi 10 MB:\n1. Unggah dokumen ke menu **Dokumen / Legal Drive** (mendukung ukuran besar di Object Storage S3).\n2. Bagikan tautan unduhan dokumen tersebut di badan email kepada penerima.',
    pose: 'suggestion',
    quickActions: [
      { label: '📂 Buka Menu Dokumen', action: 'navigate', url: '/documents' },
      { label: '✉️ Buka Kotak Masuk', action: 'navigate', url: '/inbox' },
    ],
  },
  {
    id: 'email-images-blocked',
    title: 'Gambar Email Tidak Muncul / Terblokir Privasi',
    keywords: ['gambar email', 'gambar tidak muncul', 'foto email', 'terblokir', 'remote image', 'tracking pixel', 'load image'],
    summary: 'Gambar eksternal disembunyikan untuk privasi keamanan, klik Tampilkan Gambar Asli untuk melihatnya.',
    content: 'Untuk melindungi privasi data Anda dari pelacak eksternal (*remote tracking pixel*), portal secara otomatis menyembunyikan gambar luar di email. Jika Anda mempercayai pengirim, cukup klik tombol **"Tampilkan Gambar Asli"** di bagian atas pratinjau pesan email.',
    pose: 'tips',
    quickActions: [
      { label: '✉️ Buka Kotak Masuk', action: 'navigate', url: '/inbox' },
    ],
  },
  {
    id: 'email-sync-missing',
    title: 'Email Baru Belum Masuk / Cek Sinkronisasi',
    keywords: ['email belum masuk', 'email tidak masuk', 'tidak ada email', 'sinkronisasi', 'refresh email', 'spam', 'sampah', 'imap', 'cek email'],
    summary: 'Gunakan tombol refresh atau periksa folder spam/trash jika email baru belum terlihat.',
    content: 'Jika email yang Anda tunggu belum muncul di Kotak Masuk:\n1. Klik tombol **Refresh (Segarkan)** pada bilah navigasi email.\n2. Periksa tab folder **Spam** atau **Sampah (Trash)**.\n3. Sinkronisasi IMAP server berjalan berkala. Jika pengirim mendapat balasan bounce/gagal kirim, silakan hubungi tim teknis via tiket bantuan.',
    pose: 'tips',
    quickActions: [
      { label: '🔄 Ke Kotak Masuk', action: 'navigate', url: '/inbox' },
      { label: '🎫 Lapor Masalah Email', action: 'open-support-modal', category: 'Mailbox Technical', priority: 'urgent' },
    ],
  },
  {
    id: 'session-security-2fa',
    title: 'Keamanan Akun & Hentikan Sesi Mencurigakan',
    keywords: ['sesi mencurigakan', 'perangkat asing', 'keamanan akun', 'ganti password', 'kata sandi', 'hentikan sesi', 'logout sesi'],
    summary: 'Hentikan sesi tak dikenal di Pengaturan Keamanan dan aktifkan verifikasi 2FA.',
    content: 'Jika Anda menemukan aktivitas login tak dikenal:\n1. Buka menu **Pengaturan** > tab **Keamanan**.\n2. Klik tombol **"Hentikan Seluruh Sesi Lain"** untuk memutuskan akses perangkat lain secara instan.\n3. Segera perbarui kata sandi dan aktifkan fitur verifikasi 2 langkah (**2FA**).',
    pose: 'suggestion',
    quickActions: [
      { label: '🔒 Buka Pengaturan Keamanan', action: 'navigate', url: '/settings' },
    ],
  },
  {
    id: '2fa-device-lost',
    title: 'Kehilangan HP / Akses 2FA Terkunci',
    keywords: ['hp hilang', 'perangkat hilang', 'lupa 2fa', 'hilang 2fa', 'tidak bisa 2fa', 'authenticator terhapus', 'reset 2fa', 'terkunci 2fa', 'ganti hp'],
    summary: 'Ajukan tiket darurat Access & Security dengan prioritas Urgent (< 4 jam) untuk reset 2FA.',
    content: 'Jika perangkat authenticator Anda hilang dan tidak memiliki kode cadangan, Anda tidak dapat melewati verifikasi login demi keamanan akun. Silakan ajukan **Tiket Support Darurat (Kategori: Access & Security)** dengan prioritas **Urgent**. Tim verifikasi identitas kami akan membantu pemulihan akses 2FA dalam waktu **kurang dari 4 jam kerja**.',
    pose: 'tips',
    quickActions: [
      { label: '🎫 Ajukan Tiket Reset 2FA', action: 'open-support-modal', category: 'Access & Security', priority: 'urgent' },
    ],
  },
  {
    id: 'cold-storage-restore',
    title: 'Pemulihan Dokumen > 90 Hari (Cold Storage Synology NAS)',
    keywords: ['dokumen lama', 'cold storage', 'synology', 'arsip lama', 'lebih dari 90 hari', 'pulihkan dokumen', 'restore berkas', 'arsip nas', 'dokumen terhapus'],
    summary: 'Dokumen di atas 90 hari tersimpan aman di Synology NAS kantor dan dapat dipulihkan via tiket.',
    content: 'Dokumen yang berusia lebih dari 90 hari dipindahkan secara otomatis ke **Cold Storage (Synology NAS kantor)**. Jika Anda membutuhkan dokumen arsip tersebut, silakan ajukan tiket bantuan dengan kategori **Permohonan Berkas Arsip**. Tim teknis kami akan mengambilkan berkas dari Synology NAS dan menyediakannya kembali untuk Anda (SLA 1x24 jam).',
    pose: 'document',
    quickActions: [
      { label: '🎫 Ajukan Tiket Restore Berkas', action: 'open-support-modal', category: 'Document Review', priority: 'normal' },
    ],
  },
  {
    id: 'account-reactivation',
    title: 'Reaktivasi Akun Melewati Masa Retensi 3 Bulan',
    keywords: ['reaktivasi', 'aktifkan kembali', 'akun expired', 'akun non aktif', 'lewat 90 hari', 'perpanjang akun', 'aktifkan akun'],
    summary: 'Pengaktifan kembali akun yang telah melewati masa retensi 90 hari.',
    content: 'Akun yang telah melewati masa retensi 90 hari akan berstatus non-aktif. Untuk mengaktifkan kembali akun dan memperbarui masa akses, silakan ajukan tiket support kategori **Billing & Tagihan** atau **Access & Security**. Tim kami akan memverifikasi dan mengaktifkan kembali akun Anda (SLA 1x24 jam kerja).',
    pose: 'suggestion',
    quickActions: [
      { label: '🎫 Ajukan Reaktivasi Akun', action: 'open-support-modal', category: 'Billing & Tagihan', priority: 'normal' },
    ],
  },
  {
    id: 'mail-delivery-failure',
    title: 'Email Gagal Kirim / Bounce Back Server Titan',
    keywords: ['gagal kirim', 'bounce', 'email mental', 'tidak terkirim', 'mail delivery', 'dns', 'spf', 'dkim', 'dmarc', 'domain'],
    summary: 'Penanganan kendala email keluar yang mental atau ditolak server penerima.',
    content: 'Jika email keluar Anda gagal terkirim atau menerima balasan kegagalan pengiriman (*Mail Delivery Subsystem / Bounce*), kemungkinan terdapat kendala konfigurasi DNS domain (SPF, DKIM, DMARC) atau pemblokiran reputasi IP. Silakan buka tiket bantuan kategori **Mailbox Technical** dengan prioritas **Urgent**, dan lampirkan salinan pesan error bounce tersebut.',
    pose: 'suggestion',
    quickActions: [
      { label: '🎫 Buat Tiket Mailbox', action: 'open-support-modal', category: 'Mailbox Technical', priority: 'urgent' },
    ],
  },
  {
    id: 'legal-review',
    title: 'Layanan Telaah Hukum Resmi & Legal Review',
    keywords: ['legal review', 'konsultasi hukum', 'telaah kontrak', 'perjanjian kerja', 'akta', 'opini hukum', 'klausul', 'tanya pengacara', 'advokat'],
    summary: 'Konsultasi klausul dan telaah dokumen kontrak resmi oleh tim advokat EasyLegal.',
    content: 'Sebagai asisten AI, El dapat membantu memberikan rangkuman umum seputar fitur portal, namun tidak berwenang memberikan opini hukum formal yang mengikat. Untuk analisis klausul kontrak, telaah akta perusahaan, atau konsultasi hukum resmi, Anda dapat mengajukan permohonan ke divisi **Document Review** melalui tiket support (SLA 1x24 jam kerja).',
    pose: 'enthusiastic',
    quickActions: [
      { label: '🎫 Ajukan Legal Review', action: 'open-support-modal', category: 'Document Review', priority: 'normal' },
    ],
  },
  {
    id: 'complex-backend-issues',
    title: 'Kendala Teknis Kompleks & Gangguan Backend / Server',
    keywords: [
      'backend',
      'server error',
      '500',
      'internal server error',
      'database error',
      'database bermasalah',
      'gangguan database',
      'koneksi database',
      'api error',
      'server down',
      'crash',
      'gangguan server',
      'sinkronisasi backend',
      'kegagalan sistem',
      'masalah teknis berat',
      'kendala teknis',
      'terlalu rumit',
      'terlalu kompleks',
      'masalah kompleks',
      'bug sistem',
      'error sistem',
      'sistem bermasalah',
    ],
    summary: 'Kendala sistem mendalam, bug teknis, atau error backend/server ditangani langsung oleh tim engineer via tiket support.',
    content: 'Kendala teknis yang kompleks atau berhubungan dengan backend/server (seperti error 500, kegagalan database, gangguan API, atau anomali data sistem yang tidak dapat diselesaikan secara mandiri) memerlukan penanganan dan investigasi langsung dari tim engineer teknis kami.\n\nSilakan **buat tiket bantuan (Support Ticket)** dengan mencantumkan:\n1. Deskripsi kendala dan kronologi kejadian.\n2. Kode atau pesan eror, serta tangkapan layar (*screenshot*) bila ada.\n\nTim teknis dan sysadmin kami akan segera memeriksa log server dan menyelesaikan kendala Anda (SLA 1x24 jam kerja, atau prioritas Urgent < 4 jam untuk kendala kritis).',
    pose: 'thinking',
    quickActions: [
      {
        label: '🎫 Buat Tiket Kendala Teknis',
        action: 'open-support-modal',
        category: 'Kendala Teknis & Backend',
        subject: 'Laporan Kendala Teknis / Gangguan Backend Server',
        message: 'Halo Tim Support & Engineering EasyLegal,\n\nSaya mengalami kendala teknis / gangguan backend pada akun saya dengan rincian berikut:\n- Halaman / Fitur: \n- Pesan Eror / Kode Status: \n- Kronologi Singkat: \n\nMohon bantuan investigasi log dan perbaikan sistem. Terima kasih.',
        priority: 'urgent',
      },
      { label: '📋 Riwayat Tiket', action: 'navigate', url: '/support' },
    ],
  },
];

export function findMatchingKnowledge(query: string): KnowledgeItem | null {
  const normalized = query.toLowerCase();
  let bestMatch: KnowledgeItem | null = null;
  let highestScore = 0;

  for (const item of PORTAL_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  return highestScore >= 3 ? bestMatch : null;
}
