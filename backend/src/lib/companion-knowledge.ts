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
