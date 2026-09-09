import { KnowledgeItem } from "./types";

export const PORTAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: "retention-3-months",
    title: "Kebijakan Retensi Akun & Berkas 3 Bulan",
    keywords: [
      "retensi",
      "masa aktif",
      "kadaluwarsa",
      "kedaluwarsa",
      "3 bulan",
      "tiga bulan",
      "berapa lama",
      "hapus akun",
      "sisa hari",
      "non-aktif",
      "nonaktif",
    ],
    summary: "Masa aktif akun dan penyimpanan dokumen EasyLegal adalah 3 bulan (90 hari) sejak pembuatan akun.",
    content:
      "Akun dan seluruh berkas penyimpanan Anda bertahan selama **3 bulan (90 hari)** sejak akun dibuat. Memasuki **1 bulan terakhir**, Anda akan menerima pengingat untuk segera melakukan backup data mandiri. Jika akun Anda telah non-aktif dan memerlukan bantuan pemulihan, silakan buat tiket bantuan (diproses 1x24 jam).",
    pose: "tips",
    quickActions: [
      { label: "📁 Unduh & Backup Dokumen", action: "navigate-documents", url: "/documents" },
      { label: "🎫 Buat Tiket Support", action: "open-support-modal" },
      { label: "⚙️ Cek Status di Pengaturan", action: "navigate-settings", url: "/settings" },
    ],
  },
  {
    id: "backup-documents",
    title: "Cara Backup File & Dokumen",
    keywords: [
      "backup",
      "cadangkan",
      "download berkas",
      "unduh dokumen",
      "simpan file",
      "ekspor",
      "ambil data",
    ],
    summary: "Cara mengunduh seluruh dokumen penting ke komputer atau penyimpanan pribadi.",
    content:
      "Untuk melakukan backup mandiri:\n1. Buka menu **Berkas Dokumen** di bilah atas atau navigasi.\n2. Pilih dokumen yang ingin Anda simpan.\n3. Klik tombol **Unduh / Download** untuk menyimpannya ke perangkat lokal Anda sebelum masa retensi 3 bulan berakhir.",
    pose: "document",
    quickActions: [
      { label: "📁 Buka Berkas Dokumen", action: "navigate-documents", url: "/documents" },
    ],
  },
  {
    id: "support-sla",
    title: "Bantuan & Tiket Support (SLA 1x24 Jam)",
    keywords: [
      "tiket",
      "support",
      "bantuan",
      "sla",
      "1x24",
      "customer service",
      "cs",
      "hubungi",
      "perpanjangan",
      "kendala",
    ],
    summary: "Layanan bantuan tiket support dengan respon maksimal 1x24 jam kerja.",
    content:
      "Tim EasyLegal siap membantu kendala Anda dengan jaminan respon **1x24 jam kerja**. Anda dapat membuat tiket untuk permohonan perpanjangan akun, kendala file/email, atau pertanyaan hukum lainnya langsung melalui tombol tiket.",
    pose: "enthusiastic",
    quickActions: [
      { label: "🎫 Buka Tiket Bantuan Sekarang", action: "open-support-modal" },
    ],
  },
  {
    id: "storage-synology-s3",
    title: "Penyimpanan Dokumen Cloud & Synology NAS",
    keywords: [
      "kuota",
      "storage",
      "s3",
      "synology",
      "nas",
      "kapasitas",
      "penyimpanan penuh",
      "cloud storage",
    ],
    summary: "Penyimpanan terpusat aman dengan kuota terdedikasi dan sinkronisasi berkas.",
    content:
      "Dokumen Anda tersimpan aman menggunakan enkripsi Cloud Storage S3 / Synology NAS berstandar enterprise. Anda dapat memantau penggunaan kuota penyimpanan pada ringkasan akun di menu Pengaturan.",
    pose: "suggestion",
    quickActions: [
      { label: "⚙️ Cek Kuota di Pengaturan", action: "navigate-settings", url: "/settings" },
      { label: "📁 Kelola Berkas", action: "navigate-documents", url: "/documents" },
    ],
  },
  {
    id: "email-compose-attachment",
    title: "Kirim Email & Lampiran Berkas",
    keywords: [
      "kirim email",
      "tulis email",
      "compose",
      "lampiran",
      "attachment",
      "kirim berkas",
      "pesan baru",
    ],
    summary: "Menulis pesan baru dan menyertakan dokumen pendukung.",
    content:
      "Gunakan tombol **Tulis Pesan (Compose)** di menu Kotak Masuk. Anda dapat melampirkan berkas dokumen dengan mengeklik ikon klip kertas di bagian bawah jendela penulisan.",
    pose: "waving",
    quickActions: [
      { label: "✉️ Buka Kotak Masuk", action: "navigate-inbox", url: "/inbox" },
    ],
  },
];
