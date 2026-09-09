export interface CompanionQuickAction {
  label: string;
  action: string;
  url?: string;
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
      { label: '🎫 Ajukan Tiket Perpanjangan', action: 'open-support-modal' },
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
    keywords: ['kuota', 'storage', 'kapasitas', 'synology', 's3', 'penyimpanan penuh', 'sisa ruang'],
    summary: 'Penyimpanan utama menggunakan Object Storage S3 dengan replikasi Synology.',
    content: 'Penyimpanan portal terhubung dengan **Object Storage S3 IDCloudHost** serta replikasi **Synology Drive Mirror**. Kuota akun standar Anda dapat dipantau di menu **Pengaturan**. Jika kuota hampir penuh, unduh berkas arsip atau hubungi kami melalui tiket support.',
    pose: 'suggestion',
    quickActions: [
      { label: '⚙️ Cek Kuota di Pengaturan', action: 'navigate', url: '/settings' },
      { label: '🎫 Tiket Dukungan Kuota', action: 'open-support-modal' },
    ],
  },
  {
    id: 'support-tickets',
    title: 'Layanan Tiket Bantuan & Jaminan Respon 1x24 Jam',
    keywords: ['tiket', 'support', 'bantuan', 'cs', 'customer service', 'sla', '1x24 jam', 'kendala', 'keluhan'],
    summary: 'Solusi jika akun non-aktif atau terjadi kendala teknis dengan penanganan 1x24 jam.',
    content: 'Jika Anda mengalami kendala atau membutuhkan perpanjangan akun yang telah berstatus non-aktif, silakan buat tiket di menu **Bantuan / Support**. Tim Customer Care EasyLegal siap memproses tiket Anda dalam kurun waktu **maksimal 1x24 jam kerja**.',
    pose: 'enthusiastic',
    quickActions: [
      { label: '🎫 Buat Tiket Sekarang', action: 'open-support-modal' },
      { label: '📋 Riwayat Tiket Saya', action: 'navigate', url: '/support' },
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
