import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encrypt } from './crypto';

const DUMMY_PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 55 >> stream
BT
/F1 14 Tf
72 700 Td
(EasyLegal Portal - Dokumen Resmi) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000293 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
400
%%EOF`;

const DUMMY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function ensureDummyStorageFiles(storageDir: string) {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const pdfFiles = [
    'invoice-2025-088.pdf',
    'perjanjian-kerjasama.pdf',
    'sk-kemenkumham-2026.pdf',
    'panduan-trial.pdf',
    'penawaran-paket-tahunan.pdf',
  ];

  for (const file of pdfFiles) {
    const target = path.join(storageDir, file);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, DUMMY_PDF, 'utf-8');
    }
  }

  const pngFiles = ['bukti-transfer-bca.png', 'scan-dokumen.png'];
  const pngBuffer = Buffer.from(DUMMY_PNG_BASE64, 'base64');
  for (const file of pngFiles) {
    const target = path.join(storageDir, file);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, pngBuffer);
    }
  }

  const xlsxTarget = path.join(storageDir, 'laporan-q3.xlsx');
  if (!fs.existsSync(xlsxTarget)) {
    fs.writeFileSync(xlsxTarget, 'EasyLegal Q3 Report Dummy Content Data\n', 'utf-8');
  }
}

export const INBOX_EMAILS = [
  {
    subject: 'Invoice #INV-2025-014 jatuh tempo',
    sender: 'billing@vendor.co.id',
    bodyText:
      'Halo, invoice INV-2025-014 sebesar Rp 4.500.000 jatuh tempo 7 hari lagi. Mohon konfirmasi pembayaran.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Halo <strong>Budi Setiawan</strong>,</p>
        <p>Invoice tagihan <strong>#INV-2025-014</strong> sebesar <strong>Rp 4.500.000</strong> akan jatuh tempo dalam <strong>7 hari lagi</strong>.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Nomor Invoice:</strong> INV-2025-014</p>
          <p style="margin: 0 0 6px 0;"><strong>Layanan:</strong> Jasa Konsultasi Legalitas & Perizinan Usaha</p>
          <p style="margin: 0 0 6px 0;"><strong>Total Tagihan:</strong> Rp 4.500.000</p>
          <p style="margin: 0;"><strong>Status:</strong> Menunggu Pembayaran</p>
        </div>
        <p>Dokumen invoice resmi telah kami lampirkan dalam format PDF di bawah ini.</p>
        <p>Salam hangat,<br/><strong>Tim Billing & Finance</strong></p>
      </div>
    `,
    isRead: false,
    isStarred: true,
    hoursAgo: 1,
    attachment: {
      filename: 'Invoice_INV-2025-014.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 180,
      path: 'invoice-2025-088.pdf',
    },
  },
  {
    subject: 'Konfirmasi jadwal meeting Senin',
    sender: 'rara@clientcorp.com',
    bodyText:
      'Selamat pagi, apakah jadwal meeting Senin jam 10.00 masih berlaku? Saya siapkan materinya.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Selamat pagi,</p>
        <p>Apakah jadwal meeting hari <strong>Senin jam 10.00 WIB</strong> masih berlaku? Saya akan siapkan materi presentasi dan draf perjanjian kerjasamanya.</p>
        <p>Agenda utama:<br/>1. Pembahasan klausul SLA distribusi<br/>2. Timeline pendaftaran hak merek dagang</p>
        <br/>
        <p>Salam,<br/><strong>Rara Amanda</strong><br/><span style="color: #64748b;">ClientCorp Partnerships</span></p>
      </div>
    `,
    isRead: false,
    isStarred: false,
    hoursAgo: 3,
  },
  {
    subject: 'Dokumen legal sudah ditandatangani',
    sender: 'legal@partner.id',
    bodyText:
      'Terlampir dokumen perjanjian kerja sama yang sudah ditandatangani kedua pihak.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Yth. Bapak Budi Setiawan,</p>
        <p>Terlampir dokumen perjanjian kerja sama resmi yang telah selesai ditandatangani secara elektronik (e-Meterai) oleh kedua belah pihak.</p>
        <p>Dokumen ini telah memiliki kekuatan hukum mengikat terhitung sejak tanggal diterbitkan.</p>
        <br/>
        <p>Hormat kami,<br/><strong>Tim Legal Partner ID</strong></p>
      </div>
    `,
    isRead: false,
    isStarred: false,
    hoursAgo: 6,
    attachment: {
      filename: 'Perjanjian_Kerjasama_Final.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 350,
      path: 'perjanjian-kerjasama.pdf',
    },
  },
  {
    subject: 'Reminder: perpanjangan domain',
    sender: 'noreply@hostinger.com',
    bodyText:
      'Domain Anda akan kedaluwarsa dalam 30 hari. Perpanjang sekarang agar layanan email tetap aktif.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Halo Pelanggan Hostinger,</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Domain:</strong> clienteasylegal.co.id (Aktif s/d 28 Mei 2027)</p>
          <p style="margin: 0 0 6px 0;"><strong>Paket:</strong> Free Business Email</p>
          <p style="margin: 0 0 6px 0;"><strong>Penggunaan Kuota:</strong> 0% (21 KB / 1.00 GB per mailbox)</p>
          <p style="margin: 0;"><strong>Status Anti-Spam / DKIM:</strong> Terverifikasi (SPF & DKIM Valid)</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">Pesan ini merupakan notifikasi otomatis dari sistem pemantauan infrastruktur Hostinger.</p>
      </div>
    `,
    isRead: false,
    isStarred: false,
    hoursAgo: 12,
  },
  {
    subject: 'Pertanyaan soal paket layanan',
    sender: 'budi.santoso@gmail.com',
    bodyText:
      'Halo, saya ingin tahu perbedaan paket Basic dan Pro. Terima kasih.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Halo Tim EasyLegal,</p>
        <p>Saya tertarik dengan layanan pembuatan PT dan mailbox profesional. Mohon informasinya apa saja perbedaan fasilitas antara paket Basic dan paket Pro?</p>
        <br/>
        <p>Terima kasih,<br/><strong>Budi Santoso</strong></p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 18,
  },
  {
    subject: 'Laporan bulanan Agustus',
    sender: 'ops@internal.co.id',
    bodyText:
      'Terlampir ringkasan operasional bulan Agustus. Highlight: 12 klien baru, 0 insiden.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Rekan-rekan sekalian,</p>
        <p>Berikut rangkuman operasional bulan Agustus:<br/>- <strong>12 klien baru</strong> berhasil onboarding<br/>- <strong>0 insiden</strong> downtime pada server mailbox<br/>- Response time rata-rata di bawah 15 menit</p>
        <br/>
        <p>Salam,<br/><strong>Operations Team</strong></p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 24,
  },
];

export const SENT_EMAILS = [
  {
    subject: 'Re: Konfirmasi jadwal meeting Senin',
    recipients: 'rara@clientcorp.com',
    bodyText: 'Betul, Senin jam 10.00 tetap jalan. Sampai ketemu.',
    bodyHtml: '<p>Betul, Senin jam 10.00 tetap jalan. Sampai ketemu.</p>',
    hoursAgo: 2,
    attachment: undefined,
  },
];

export const DRAFT_EMAILS: any[] = [];
export const TRASH_EMAILS: any[] = [];

// ─── Trial Mailbox Specific Emails ──────────────────────────────
export const TRIAL_INBOX_EMAILS = [
  {
    subject: '🎉 Selamat Datang di Masa Percobaan (Trial 14 Hari) EasyLegal',
    sender: 'onboarding@easylegal.co.id',
    bodyText:
      'Halo Pengguna Trial, selamat datang di layanan email bisnis resmi EasyLegal. Akun percobaan Anda aktif selama 14 hari dengan fasilitas lengkap.',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <div style="background: linear-gradient(135deg, #680003, #930006); color: white; padding: 22px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px;">Akun Trial 14 Hari Anda Aktif</h2>
          <p style="margin: 0; opacity: 0.9; font-size: 13px;">EasyLegal Business Mail • Domain clienteasylegal.co.id</p>
        </div>
        <p>Yth. <strong>Pengguna Layanan Percobaan</strong>,</p>
        <p>Terima kasih telah mencoba portal email profesional EasyLegal. Selama periode uji coba 14 hari ini, Anda dapat mengevaluasi seluruh keunggulan kami:</p>
        <ul>
          <li><strong>Domain Korporat:</strong> Identitas email bisnis resmi terverifikasi Hostinger Titan Mail.</li>
          <li><strong>Keamanan Enkripsi:</strong> Penyimpanan data terenkripsi AES-256-GCM dan koneksi SSL/TLS.</li>
          <li><strong>Pengiriman Dokumen:</strong> Kirim dan terima lampiran berkas resmi hingga 10 MB.</li>
          <li><strong>Dukungan Support Prioritas:</strong> Tim helpdesk siap mendampingi konfigurasi domain Anda.</li>
        </ul>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; color: #475569;">
            💡 <em>Panduan orientasi fitur dan konfigurasi IMAP/SMTP terlampir dalam file PDF di bawah ini.</em>
          </p>
        </div>
        <p>Salam sukses dan selamat beraktivitas,<br/><strong>Tim Onboarding EasyLegal</strong></p>
      </div>
    `,
    isRead: false,
    isStarred: true,
    hoursAgo: 2,
    attachment: {
      filename: 'Panduan_Memulai_Trial_EasyLegal.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 120,
      path: 'panduan-trial.pdf',
    },
  },
  {
    subject: '⏳ Pengingat: Masa Percobaan (Trial) Anda Tersisa 5 Hari Lagi',
    sender: 'billing@easylegal.co.id',
    bodyText:
      'Halo, periode trial 14 hari Anda akan berakhir dalam 5 hari. Dapatkan penawaran khusus diskon 20% untuk perpanjangan ke paket bisnis tahunan.',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <div style="border-left: 4px solid #f59e0b; background: #fffbeb; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
          <h3 style="margin: 0 0 4px 0; color: #92400e;">Pemberitahuan Status Masa Percobaan</h3>
          <p style="margin: 0; font-size: 13px; color: #b45309;">Sisa waktu trial: <strong>5 Hari</strong> (Jatuh tempo: 13 September 2026)</p>
        </div>
        <p>Halo Pengguna Trial,</p>
        <p>Kami harap Anda menikmati kemudahan dan reliabilitas portal email EasyLegal. Agar operasional dan alamat email bisnis Anda tidak terputus, Anda dapat meng-upgrade akun ke <strong>Paket Bisnis Tahunan</strong> dengan penawaran istimewa:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="font-weight: bold; color: #0f172a; font-size: 14px; margin-bottom: 6px;">Promo Konversi Trial ke Tahunan:</div>
          <p style="margin: 0; font-size: 13px; color: #334155;">Diskon <strong>20%</strong> untuk langganan tahun pertama + Bebas biaya konfigurasi MX DNS dan konsultasi awal perizinan PT.</p>
        </div>
        <p>Rincian invoice proforma dan formulir perpanjangan terlampir dalam file PDF berikut.</p>
        <br/>
        <p>Salam sukses,<br/><strong>Divisi Penjualan & Billing EasyLegal</strong></p>
      </div>
    `,
    isRead: false,
    isStarred: true,
    hoursAgo: 10,
    attachment: {
      filename: 'Penawaran_Paket_Tahunan_EasyLegal.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 210,
      path: 'penawaran-paket-tahunan.pdf',
    },
  },
  {
    subject: '📊 Ringkasan Pemakaian Kuota & Kinerja Mailbox Trial',
    sender: 'system@clienteasylegal.co.id',
    bodyText:
      'Laporan metrik mingguan: Kuota terpakai 120 KB dari 1 GB. Skor reputasi pengiriman 100%. DKIM dan SPF aktif normal.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <h3 style="color: #680003; margin-top: 0;">Laporan Kesehatan Akun Percobaan</h3>
        <p>Berikut rangkuman kinerja mailbox trial Anda selama 7 hari terakhir:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px;">
          <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;"><td style="padding: 8px 12px;"><strong>Kuota Penyimpanan:</strong></td><td style="padding: 8px 12px; text-align: right;">120 KB / 1.00 GB (0.01%)</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px;"><strong>Penyaringan Spam:</strong></td><td style="padding: 8px 12px; text-align: right; color: #16a34a; font-weight: bold;">Aktif (0 Ancaman)</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;"><td style="padding: 8px 12px;"><strong>Status Enkripsi TLS:</strong></td><td style="padding: 8px 12px; text-align: right; color: #16a34a;">Valid (TLS 1.3)</td></tr>
        </table>
        <p style="font-size: 12px; color: #64748b;">Dihasilkan otomatis oleh Hostinger Mail Telemetry Engine.</p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 24,
  },
  {
    subject: 'Jadwal Sesi Konsultasi Onboarding 1-on-1 dengan Tim Legal',
    sender: 'consultant@easylegal.co.id',
    bodyText:
      'Halo, sebagai bagian dari program trial EasyLegal, Anda berhak mendapatkan sesi konsultasi 30 menit mengenai kepatuhan hukum usaha Anda.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <p>Halo Pengguna Trial,</p>
        <p>Sebagai fasilitas evaluasi pelanggan baru, kami mengundang Anda untuk mengikuti sesi konsultasi privat 1-on-1 selama 30 menit bersama konsultan hukum korporat EasyLegal.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <strong>Topik yang dapat dikonsultasikan:</strong>
          <ul style="margin: 6px 0 0 0; padding-left: 18px; font-size: 13px;">
            <li>Struktur Anggaran Dasar dan Pembagian Saham Perusahaan</li>
            <li>Perizinan Berusaha Berbasis Risiko (OSS-RBA)</li>
            <li>Perlindungan Hak Merek Dagang & Hak Cipta Perangkat Lunak</li>
          </ul>
        </div>
        <p>Silakan balas email ini dengan preferensi hari dan jam Anda (Senin - Jumat, 09.00 - 17.00 WIB).</p>
        <br/>
        <p>Hormat kami,<br/><strong>Tim Konsultasi Legalitas EasyLegal</strong></p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 48,
  },
  {
    subject: '🔐 Panduan Praktis: Mengamankan Mailbox Bisnis dari Serangan Phishing',
    sender: 'security@easylegal.co.id',
    bodyText:
      'Tips penting menjaga kerahasiaan korespondensi korporat: kenali tautan mencurigakan, aktifkan password yang kuat, dan jangan bagikan kredensial.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <h4 style="color: #1e293b;">Security Bulletin • EasyLegal Information Security</h4>
        <p>Halo,</p>
        <p>Keamanan data korespondensi adalah prioritas utama kami. Berikut 3 langkah mudah menjaga keamanan email bisnis Anda:</p>
        <ol style="font-size: 13px;">
          <li><strong>Ganti Password Berkala:</strong> Manfaatkan menu Pengaturan Akun di pojok kanan atas untuk memperbarui password Anda.</li>
          <li><strong>Verifikasi Pengirim:</strong> Selalu periksa domain pengirim sebelum mengunduh lampiran yang tidak dikenal.</li>
          <li><strong>Jangan Bagikan Kredensial:</strong> Tim teknis EasyLegal tidak akan pernah meminta kata sandi Anda via email.</li>
        </ol>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 72,
  },
];

export const TRIAL_SENT_EMAILS = [
  {
    subject: 'Pertanyaan Upgrade Akun Percobaan ke Paket Bisnis',
    recipients: 'billing@easylegal.co.id',
    bodyText:
      'Selamat siang Tim Billing EasyLegal, kami tertarik dengan penawaran paket tahunan diskon 20%. Apakah pembayaran bisa menggunakan transfer m-Banking BCA atau kartu korporat?',
    bodyHtml:
      '<p>Selamat siang Tim Billing EasyLegal,</p><p>Kami tertarik dengan penawaran paket tahunan diskon 20% yang ditawarkan. Apakah pembayaran invoice dapat menggunakan transfer via m-Banking BCA atau kartu kredit korporat?</p><br/><p>Salam hormat,<br/><strong>User Trial</strong></p>',
    hoursAgo: 6,
  },
  {
    subject: 'Konfirmasi Jadwal Sesi Onboarding Trial',
    recipients: 'consultant@easylegal.co.id',
    bodyText:
      'Halo Tim Legal, kami ingin mengambil jadwal konsultasi hari Kamis jam 14.00 WIB. Topik utama yang ingin kami diskusikan adalah perizinan KBLI di OSS.',
    bodyHtml:
      '<p>Halo Tim Legal,</p><p>Terima kasih atas undangannya. Kami memilih jadwal <strong>Kamis jam 14.00 WIB</strong> via Google Meet. Topik yang ingin kami konsultasikan adalah perizinan sektor digital OSS.</p><br/><p>Salam,<br/><strong>User Trial</strong></p>',
    hoursAgo: 30,
  },
];

export const TRIAL_DRAFT_EMAILS = [
  {
    subject: '[Draf] Permohonan Draf Perjanjian Kerahasiaan (NDA) Rekanan',
    recipients: 'legal@easylegal.co.id',
    bodyText:
      'Dengan hormat, sehubungan dengan kerjasama vendor baru, kami ingin meminta templat NDA baku dari EasyLegal...',
    bodyHtml:
      '<p>Dengan hormat,</p><p>Sehubungan dengan kerjasama vendor baru, kami ingin meminta templat NDA standar...</p>',
    hoursAgo: 12,
  },
];

export const TRIAL_TRASH_EMAILS = [
  {
    subject: '[Promo] Penawaran Sewa Ruang Kantor & Co-Working Space Murah',
    sender: 'marketing@officepromo.id',
    bodyText:
      'Dapatkan diskon sewa meja kantor harian dan mingguan khusus startup baru.',
    bodyHtml:
      '<p>Diskon khusus ruangan kantor representatif di Jakarta Selatan.</p>',
    hoursAgo: 100,
  },
];

// ─── Additional Active Customers Emails ──────────────────────────────
export const HENDRA_EMAILS = [
  {
    subject: 'Notifikasi Penerimaan Dokumen Ekspor & Sertifikat Asal (COO)',
    sender: 'trade@kemendag.go.id',
    bodyText:
      'Pengajuan Surat Keterangan Asal (SKA / COO) untuk pengiriman komponen elektronik telah diverifikasi dan disetujui.',
    bodyHtml:
      '<p>Yth. <strong>Hendra Wijaya</strong> (PT Sinar Terang),</p><p>Pengajuan SKA/COO Form D Anda telah disetujui sistem e-SKA Kementerian Perdagangan RI dengan nomor registrasi <strong>COO-ID-2026-9901</strong>.</p>',
    isRead: false,
    isStarred: true,
    hoursAgo: 4,
  },
  {
    subject: 'Penagihan Pajak Penghasilan Badan Pasal 25 Periode Agustus',
    sender: 'billing@taxpartner.id',
    bodyText:
      'Pengingat pembayaran angsuran PPh 25 badan usaha masa Agustus 2026 telah siap dibayarkan sebelum tanggal 15.',
    bodyHtml:
      '<p>Halo Pak Hendra,</p><p>Billing kode bayar angsuran PPh Pasal 25 masa pajak Agustus telah kami terbitkan melalui DJP Online.</p>',
    isRead: true,
    isStarred: false,
    hoursAgo: 26,
  },
];

export const DEWI_EMAILS = [
  {
    subject: 'Pendaftaran Merek Dagang & Hak Cipta Perangkat Lunak Selesai',
    sender: 'ipr@dgip.go.id',
    bodyText:
      'Sertifikat Merek Dagang Kelas 42 dan Surat Pencatatan Ciptaan software ERP telah resmi diterbitkan oleh DJKI Kemenkumham.',
    bodyHtml:
      '<p>Yth. Ibu <strong>Dewi Lestari</strong> (PT Digital Solusi),</p><p>Direktorat Jenderal Kekayaan Intelektual menginformasikan bahwa sertifikat merek dagang Anda telah terbit dan dapat diunduh.</p>',
    isRead: false,
    isStarred: true,
    hoursAgo: 5,
  },
  {
    subject: 'Undangan Sosialisasi Kebijakan Kepatuhan Perlindungan Data Pribadi (UU PDP)',
    sender: 'event@kominfo.go.id',
    bodyText:
      'Kementerian Kominfo mengundang direksi perusahaan teknologi informasi dalam workshop kepatuhan UU PDP 2026.',
    bodyHtml:
      '<p>Kepada Yth. Pimpinan PT Digital Solusi Nusantara,</p><p>Kami mengundang Anda hadir pada lokakarya implementasi standar kepatuhan pengendali data pribadi.</p>',
    isRead: true,
    isStarred: false,
    hoursAgo: 32,
  },
];

export const CUSTOMERS_DATA = [
  {
    name: 'Budi Setiawan',
    personalEmail: 'budi.pribadi@gmail.com',
    localPart: 'budi',
    status: 'active',
    lastLoginMinutesAgo: 15,
    createdDaysAgo: 15, // 15 days ago -> 75 days remaining (normal active)
  },
  {
    name: 'Pengguna Trial EasyLegal',
    personalEmail: 'trial.user@solusidigital.id',
    localPart: 'trial',
    status: 'active',
    lastLoginMinutesAgo: 5,
    createdDaysAgo: 65, // 65 days ago -> 25 days remaining (warning <= 30 days)
  },
  {
    name: 'Siti Rahayu',
    personalEmail: 'siti.pribadi@gmail.com',
    localPart: 'siti',
    status: 'inactive',
    lastLoginMinutesAgo: 60 * 24 * 5,
    createdDaysAgo: 95, // 95 days ago -> expired
  },
  {
    name: 'Hendra Wijaya',
    personalEmail: 'hendra.wijaya@sinarterang.com',
    localPart: 'hendra',
    status: 'active',
    lastLoginMinutesAgo: 120,
    createdDaysAgo: 20,
  },
  {
    name: 'Dewi Lestari',
    personalEmail: 'dewi.lestari@digitalsolusi.co.id',
    localPart: 'dewi',
    status: 'active',
    lastLoginMinutesAgo: 60 * 24 * 1,
    createdDaysAgo: 30,
  },
  {
    name: 'Ahmad Fauzi, S.H.',
    personalEmail: 'notaris.ahmad@gmail.com',
    localPart: 'ahmad',
    status: 'active',
    lastLoginMinutesAgo: 60 * 24 * 3,
    createdDaysAgo: 40,
  },
  {
    name: 'Rudi Hartono',
    personalEmail: 'rudi.hartono@koperasisejahtera.id',
    localPart: 'rudi',
    status: 'active',
    lastLoginMinutesAgo: null,
    createdDaysAgo: 5,
  },
  {
    name: 'Maya Safitri',
    personalEmail: 'maya.safitri@kreatifmedia.id',
    localPart: 'maya',
    status: 'inactive',
    lastLoginMinutesAgo: null,
    createdDaysAgo: 92,
  },
  {
    name: 'Eka Pratama',
    personalEmail: 'eka.pratama@logistiknusantara.co.id',
    localPart: 'eka',
    status: 'active',
    lastLoginMinutesAgo: 60 * 24 * 4,
    createdDaysAgo: 10,
  },
];

// ─── Extended Hub Modules Data ──────────────────────────────────────
export const BUDI_LOGIN_SESSIONS = [
  {
    deviceName: 'MacBook Pro 16"',
    deviceType: 'laptop',
    browser: 'Chrome 128 (macOS)',
    ipAddress: '182.253.140.22',
    location: 'Jakarta, Indonesia',
    isCurrent: true,
    lastActiveMinutesAgo: 5,
    daysAgo: 3,
  },
  {
    deviceName: 'iPhone 14 Pro',
    deviceType: 'mobile',
    browser: 'Mobile Safari 17',
    ipAddress: '114.122.45.10',
    location: 'Jakarta, Indonesia',
    isCurrent: false,
    lastActiveMinutesAgo: 240,
    daysAgo: 7,
  },
  {
    deviceName: 'Windows Desktop',
    deviceType: 'desktop',
    browser: 'Edge 126 (Windows 11)',
    ipAddress: '180.252.88.14',
    location: 'Surabaya, Indonesia',
    isCurrent: false,
    lastActiveMinutesAgo: 2880,
    daysAgo: 14,
  },
];

export const TRIAL_LOGIN_SESSIONS = [
  {
    deviceName: 'MacBook Pro 14"',
    deviceType: 'laptop',
    browser: 'Chrome 128 (macOS)',
    ipAddress: '182.253.140.22',
    location: 'Jakarta, Indonesia',
    isCurrent: true,
    lastActiveMinutesAgo: 2,
    daysAgo: 1,
  },
  {
    deviceName: 'iPhone 15',
    deviceType: 'mobile',
    browser: 'Mobile Safari 17',
    ipAddress: '114.122.45.10',
    location: 'Jakarta, Indonesia',
    isCurrent: false,
    lastActiveMinutesAgo: 480,
    daysAgo: 5,
  },
];

export const BUDI_LEGAL_DOCUMENTS = [
  {
    title: 'SK Kemenkumham PT Maju Bersama Digital',
    category: 'Client Agreements',
    filename: 'sk-kemenkumham-2026.pdf',
    mimeType: 'application/pdf',
    size: 1024 * 240,
    path: 'sk-kemenkumham-2026.pdf',
    status: 'Approved',
    isStarred: true,
    ownerName: 'Kemenkumham RI',
    versions: [
      {
        versionNumber: 'v1.0',
        authorName: 'Notaris Ahmad Fauzi, S.H.',
        approved: true,
        notes: 'Penerbitan awal SK AHU pendirian badan hukum',
        daysAgo: 30,
      },
      {
        versionNumber: 'v2.0',
        authorName: 'Divisi Perizinan EasyLegal',
        approved: true,
        notes: 'Penyesuaian KBLI 62019 pasca migrasi OSS RBA',
        daysAgo: 14,
      },
      {
        versionNumber: 'v2.1',
        authorName: 'Sarah Jenkins, LL.M.',
        approved: true,
        notes: 'v2.1 Approved by Sarah J. - Pengesahan final dokumen legalitas',
        daysAgo: 2,
      },
    ],
  },
  {
    title: 'Perjanjian Kerjasama Investasi & Kemitraan',
    category: 'NDA Templates',
    filename: 'perjanjian-kerjasama.pdf',
    mimeType: 'application/pdf',
    size: 1024 * 350,
    path: 'perjanjian-kerjasama.pdf',
    status: 'Urgent Review',
    isStarred: true,
    ownerName: 'Legal Team',
    versions: [
      {
        versionNumber: 'v1.0',
        authorName: 'Jonathan Prakoso',
        approved: true,
        notes: 'Draf awal perjanjian investasi modal disetor',
        daysAgo: 10,
      },
      {
        versionNumber: 'v2.0',
        authorName: 'Sarah Jenkins, LL.M.',
        approved: false,
        notes: 'v2.0 Revisi klausul arbitrase SIAC & batasan tanggung jawab',
        daysAgo: 3,
      },
    ],
  },
  {
    title: 'Invoice Retainer & Perizinan 2026-088',
    category: 'Tax Filings',
    filename: 'invoice-2025-088.pdf',
    mimeType: 'application/pdf',
    size: 1024 * 180,
    path: 'invoice-2025-088.pdf',
    status: 'Reviewed',
    isStarred: false,
    ownerName: 'Finance EasyLegal',
    versions: [
      {
        versionNumber: 'v1.0',
        authorName: 'Finance Team',
        approved: true,
        notes: 'v1.0 Faktur pajak & invoice resmi terverifikasi',
        daysAgo: 5,
      },
    ],
  },
];

export const TRIAL_LEGAL_DOCUMENTS = [
  {
    title: 'Panduan Memulai Layanan EasyLegal Trial',
    category: 'Client Agreements',
    filename: 'panduan-trial.pdf',
    mimeType: 'application/pdf',
    size: 1024 * 120,
    path: 'panduan-trial.pdf',
    status: 'Approved',
    isStarred: true,
    ownerName: 'EasyLegal Onboarding',
    versions: [
      {
        versionNumber: 'v1.0',
        authorName: 'Onboarding Specialist',
        approved: true,
        notes: 'v1.0 Dokumen panduan orientasi masa percobaan',
        daysAgo: 14,
      },
    ],
  },
  {
    title: 'Penawaran Paket Tahunan EasyLegal',
    category: 'Client Agreements',
    filename: 'penawaran-paket-tahunan.pdf',
    mimeType: 'application/pdf',
    size: 1024 * 210,
    path: 'penawaran-paket-tahunan.pdf',
    status: 'Reviewed',
    isStarred: false,
    ownerName: 'Sales EasyLegal',
    versions: [
      {
        versionNumber: 'v1.0',
        authorName: 'Sales Specialist',
        approved: true,
        notes: 'v1.0 Proposal konversi paket tahunan diskon 20%',
        daysAgo: 5,
      },
    ],
  },
];

export const BUDI_SUPPORT_TICKETS = [
  {
    ticketNumber: '#TK-4920',
    subject: 'Document Review Delay',
    category: 'Document Review',
    status: 'open',
    priority: 'urgent',
    daysAgo: 2,
    messages: [
      {
        senderName: 'Budi Setiawan',
        senderRole: 'client',
        senderAvatar: null,
        message:
          'Halo Tim EasyLegal, pengajuan telaah draf Perjanjian Kerjasama Investasi kami belum ada update sejak 3 hari lalu. Mohon percepatan karena penandatanganan dijadwalkan Jumat ini.',
        isInternal: false,
        hoursAgo: 48,
      },
      {
        senderName: 'Sarah Jenkins, LL.M.',
        senderRole: 'agent',
        senderAvatar: null,
        message:
          'Internal Note: Sedang dicek silang dengan Notaris Ahmad mengenai klausul non-kompetisi pasal 12. Estimasi selesai hari ini pukul 16.00 WIB.',
        isInternal: true,
        hoursAgo: 24,
      },
      {
        senderName: 'Sarah Jenkins, LL.M.',
        senderRole: 'agent',
        senderAvatar: null,
        message:
          'Selamat siang Pak Budi, mohon maaf atas keterlambatannya. Tim legal senior kami sedang menyelesaikan verifikasi klausul non-kompetisi dan SLA. Kami pastikan draf final dapat diunduh sore ini.',
        isInternal: false,
        hoursAgo: 18,
      },
    ],
  },
  {
    ticketNumber: '#TK-4811',
    subject: 'Billing Discrepancy',
    category: 'Billing',
    status: 'resolved',
    priority: 'normal',
    daysAgo: 5,
    messages: [
      {
        senderName: 'Budi Setiawan',
        senderRole: 'client',
        senderAvatar: null,
        message:
          'Selamat pagi, pada invoice #INV-2026-088 tercantum biaya materai 2x padahal di perjanjian awal hanya 1 berkas. Mohon klarifikasinya.',
        isInternal: false,
        hoursAgo: 120,
      },
      {
        senderName: 'Finance Support',
        senderRole: 'agent',
        senderAvatar: null,
        message:
          'Halo Pak Budi, kami telah mengoreksi invoice tersebut dan menerbitkan nota kredit untuk penyesuaian biaya e-Meterai. Status tagihan sudah disesuaikan.',
        isInternal: false,
        hoursAgo: 96,
      },
      {
        senderName: 'Budi Setiawan',
        senderRole: 'client',
        senderAvatar: null,
        message: 'Terima kasih atas respons cepatnya. Pembayaran telah kami selesaikan.',
        isInternal: false,
        hoursAgo: 72,
      },
    ],
  },
  {
    ticketNumber: '#TK-4925',
    subject: 'Access Revocation Error',
    category: 'Access Revocation',
    status: 'open',
    priority: 'urgent',
    daysAgo: 1,
    messages: [
      {
        senderName: 'Budi Setiawan',
        senderRole: 'client',
        senderAvatar: null,
        message:
          "Kami mencoba menonaktifkan akses mantan staf legal kami pada drive dokumen perusahaan, namun sistem memunculkan error 'Session token still active'. Mohon bantuan tim teknis untuk terminate session terkait.",
        isInternal: false,
        hoursAgo: 6,
      },
      {
        senderName: 'IT Security Ops',
        senderRole: 'agent',
        senderAvatar: null,
        message:
          'Internal Note: Stale token terdeteksi di cache Redis. Perlu purge manual atau invalidate via security session manager.',
        isInternal: true,
        hoursAgo: 4,
      },
      {
        senderName: 'IT Security Ops',
        senderRole: 'agent',
        senderAvatar: null,
        message:
          'Halo Pak Budi, kami telah meremove sesi login perangkat terkait dari server secara paksa. Akses dokumen kini telah tertutup sepenuhnya.',
        isInternal: false,
        hoursAgo: 2,
      },
    ],
  },
];

export const TRIAL_SUPPORT_TICKETS = [
  {
    ticketNumber: '#TK-4930',
    subject: 'Permintaan Penawaran Lisensi Multi-User',
    category: 'Billing',
    status: 'open',
    priority: 'normal',
    daysAgo: 1,
    messages: [
      {
        senderName: 'Pengguna Trial EasyLegal',
        senderRole: 'client',
        senderAvatar: null,
        message:
          'Halo tim sales EasyLegal, apakah ada paket bundling 5 mailbox dengan kapasitas storage 50 GB untuk startup kami?',
        isInternal: false,
        hoursAgo: 24,
      },
      {
        senderName: 'Sales Consultant',
        senderRole: 'agent',
        senderAvatar: null,
        message:
          'Halo! Tentu ada, proposal penawaran khusus startup telah kami kirimkan ke email Anda. Silakan dicek.',
        isInternal: false,
        hoursAgo: 12,
      },
    ],
  },
];

export async function seedDemoData(prismaClient?: PrismaClient, storageDir?: string) {
  const prisma = prismaClient || new PrismaClient();
  const domain = process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id';
  const resolvedStorageDir = storageDir || path.resolve(process.env.STORAGE_DIR || './storage');

  // 0. Ensure physical dummy files exist in storage dir
  ensureDummyStorageFiles(resolvedStorageDir);

  // 1. Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.legalDocument.deleteMany();
  await prisma.loginSession.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.messageCache.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.adminUser.deleteMany();

  // 2. Buat Admin Utama & Officer Staf Legal
  const admin = await prisma.adminUser.create({
    data: {
      name: 'Admin Utama EasyLegal',
      email: `admin@${domain}`,
      passwordHash: await bcrypt.hash('Admin123!', 10),
      role: 'superadmin',
      lastLoginAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  const officer = await prisma.adminUser.create({
    data: {
      name: 'Officer Staf Legal',
      email: `officer@${domain}`,
      passwordHash: await bcrypt.hash('Officer123!', 10),
      role: 'officer',
      lastLoginAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  // 3. Buat Customer Mailbox
  const createdCustomers: Record<string, any> = {};
  for (const c of CUSTOMERS_DATA) {
    const signature =
      c.localPart === 'budi'
        ? '--\nBudi Setiawan\nDirektur Utama PT Maju Bersama Digital\nEmail: budi@clienteasylegal.co.id'
        : c.localPart === 'trial'
        ? '--\nPengguna Trial EasyLegal\nPT Solusi Digital Nusantara\nEmail: trial@clienteasylegal.co.id'
        : `--\n${c.name}\nEmail: ${c.localPart}@${domain}`;

    const createdDate = c.createdDaysAgo
      ? new Date(Date.now() - c.createdDaysAgo * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    const cust = await prisma.customer.create({
      data: {
        name: c.name,
        personalEmail: c.personalEmail,
        mailboxAddress: `${c.localPart}@${domain}`,
        passwordEnc: encrypt('Customer123!'),
        status: c.status,
        twoFactorEnabled: false,
        createdAt: createdDate,
        preferences: JSON.stringify({
          language: 'id',
          timezone: 'Asia/Jakarta',
          signature,
          notifyEmail: true,
          notifySound: c.localPart !== 'trial',
        }),
        lastLoginAt: c.lastLoginMinutesAgo
          ? new Date(Date.now() - c.lastLoginMinutesAgo * 60 * 1000)
          : null,
      },
    });
    createdCustomers[c.localPart] = cust;
  }

  let uidCounter = 2000;

  // ─── 4. Seed Emails for Budi Setiawan ──────────────────────────────
  const budi = createdCustomers['budi'];
  if (budi) {
    for (const email of INBOX_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: budi.id,
          uid: String(uidCounter),
          folder: 'INBOX',
          subject: email.subject,
          sender: email.sender,
          recipients: budi.mailboxAddress,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: email.isRead,
          isStarred: email.isStarred,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
          attachments: email.attachment
            ? {
                create: [email.attachment],
              }
            : undefined,
        },
      });
    }

    for (const email of SENT_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: budi.id,
          uid: `sent-${uidCounter}`,
          folder: 'Sent',
          subject: email.subject,
          sender: budi.mailboxAddress,
          recipients: email.recipients,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: true,
          isStarred: false,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
          attachments: email.attachment
            ? {
                create: [email.attachment],
              }
            : undefined,
        },
      });
    }

    for (const email of DRAFT_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: budi.id,
          uid: `draft-${uidCounter}`,
          folder: 'Drafts',
          subject: email.subject,
          sender: budi.mailboxAddress,
          recipients: email.recipients,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: true,
          isStarred: false,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
        },
      });
    }

    for (const email of TRASH_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: budi.id,
          uid: `trash-${uidCounter}`,
          folder: 'Trash',
          subject: email.subject,
          sender: email.sender,
          recipients: budi.mailboxAddress,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: true,
          isStarred: false,
          isDeleted: true,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
        },
      });
    }
  }

  // ─── 5. Seed Emails for Trial User ──────────────────────────────
  const trial = createdCustomers['trial'];
  if (trial) {
    for (const email of TRIAL_INBOX_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: trial.id,
          uid: `trial-${uidCounter}`,
          folder: 'INBOX',
          subject: email.subject,
          sender: email.sender,
          recipients: trial.mailboxAddress,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: email.isRead,
          isStarred: email.isStarred,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
          attachments: email.attachment
            ? {
                create: [email.attachment],
              }
            : undefined,
        },
      });
    }

    for (const email of TRIAL_SENT_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: trial.id,
          uid: `trial-sent-${uidCounter}`,
          folder: 'Sent',
          subject: email.subject,
          sender: trial.mailboxAddress,
          recipients: email.recipients,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: true,
          isStarred: false,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
        },
      });
    }

    for (const email of TRIAL_DRAFT_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: trial.id,
          uid: `trial-draft-${uidCounter}`,
          folder: 'Drafts',
          subject: email.subject,
          sender: trial.mailboxAddress,
          recipients: email.recipients,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: true,
          isStarred: false,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
        },
      });
    }

    for (const email of TRIAL_TRASH_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: trial.id,
          uid: `trial-trash-${uidCounter}`,
          folder: 'Trash',
          subject: email.subject,
          sender: email.sender,
          recipients: trial.mailboxAddress,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: true,
          isStarred: false,
          isDeleted: true,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
        },
      });
    }
  }

  // ─── 6. Seed Emails for Hendra & Dewi ──────────────────────────────
  const hendra = createdCustomers['hendra'];
  if (hendra) {
    for (const email of HENDRA_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: hendra.id,
          uid: `hendra-${uidCounter}`,
          folder: 'INBOX',
          subject: email.subject,
          sender: email.sender,
          recipients: hendra.mailboxAddress,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: email.isRead,
          isStarred: email.isStarred,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
        },
      });
    }
  }

  const dewi = createdCustomers['dewi'];
  if (dewi) {
    for (const email of DEWI_EMAILS) {
      uidCounter++;
      await prisma.messageCache.create({
        data: {
          mailboxId: dewi.id,
          uid: `dewi-${uidCounter}`,
          folder: 'INBOX',
          subject: email.subject,
          sender: email.sender,
          recipients: dewi.mailboxAddress,
          snippet: email.bodyText.slice(0, 140),
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          isRead: email.isRead,
          isStarred: email.isStarred,
          isDeleted: false,
          receivedAt: new Date(Date.now() - email.hoursAgo * 3600_000),
        },
      });
    }
  }

  // ─── 7. Masukkan Audit Logs ──────────────────────────────
  const auditEntries = [
    {
      action: 'mailbox.create',
      target: 'trial',
      daysAgo: 14,
      details: { mailboxAddress: `trial@${domain}`, initiatedBy: 'Self-Service Trial Portal' },
    },
    {
      action: 'mailbox.create',
      target: 'budi',
      daysAgo: 7,
      details: { mailboxAddress: `budi@${domain}`, initiatedBy: 'Admin Utama' },
    },
    {
      action: 'mailbox.create',
      target: 'siti',
      daysAgo: 6,
      details: { mailboxAddress: `siti@${domain}` },
    },
    {
      action: 'mailbox.create',
      target: 'hendra',
      daysAgo: 5,
      details: { mailboxAddress: `hendra@${domain}` },
    },
    {
      action: 'mailbox.deactivate',
      target: 'siti',
      daysAgo: 4,
      details: { mailboxAddress: `siti@${domain}`, reason: 'Permintaan penangguhan sementara' },
    },
    {
      action: 'mailbox.create',
      target: 'dewi',
      daysAgo: 3,
      details: { mailboxAddress: `dewi@${domain}` },
    },
    {
      action: 'mailbox.create',
      target: 'ahmad',
      daysAgo: 2,
      details: { mailboxAddress: `ahmad@${domain}` },
    },
    {
      action: 'mailbox.password_reset',
      target: 'budi',
      daysAgo: 1,
      details: { mailboxAddress: `budi@${domain}`, method: 'temporary_password' },
    },
    {
      action: 'mailbox.deactivate',
      target: 'maya',
      daysAgo: 0.2,
      details: { mailboxAddress: `maya@${domain}`, reason: 'Proses verifikasi dokumen tertunda' },
    },
  ];

  for (const entry of auditEntries) {
    const targetCustomer = createdCustomers[entry.target];
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: entry.action,
        targetType: 'customer',
        targetId: targetCustomer?.id,
        details: JSON.stringify(entry.details),
        ipAddress: '182.253.140.22',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
        createdAt: new Date(Date.now() - entry.daysAgo * 24 * 3600_000),
      },
    });
  }

  // ─── 8. Seed Login Sessions for Budi & Trial ──────────────────────
  const seedSessions = async (customerId: string, sessions: typeof BUDI_LOGIN_SESSIONS) => {
    for (const s of sessions) {
      await prisma.loginSession.create({
        data: {
          customerId,
          deviceName: s.deviceName,
          deviceType: s.deviceType,
          browser: s.browser,
          ipAddress: s.ipAddress,
          location: s.location,
          isCurrent: s.isCurrent,
          lastActiveAt: new Date(Date.now() - s.lastActiveMinutesAgo * 60 * 1000),
          createdAt: new Date(Date.now() - s.daysAgo * 24 * 3600_000),
        },
      });
    }
  };

  if (budi) {
    await seedSessions(budi.id, BUDI_LOGIN_SESSIONS);
  }
  if (trial) {
    await seedSessions(trial.id, TRIAL_LOGIN_SESSIONS);
  }

  // ─── 9. Seed Legal Documents & Version History ────────────────────
  const seedDocuments = async (customerId: string, docs: typeof BUDI_LEGAL_DOCUMENTS) => {
    for (const doc of docs) {
      await prisma.legalDocument.create({
        data: {
          customerId,
          title: doc.title,
          category: doc.category,
          filename: doc.filename,
          mimeType: doc.mimeType,
          size: doc.size,
          path: doc.path,
          status: doc.status,
          isStarred: doc.isStarred,
          ownerName: doc.ownerName,
          versions: {
            create: doc.versions.map((v) => ({
              versionNumber: v.versionNumber,
              authorName: v.authorName,
              approved: v.approved,
              notes: v.notes,
              createdAt: new Date(Date.now() - v.daysAgo * 24 * 3600_000),
            })),
          },
        },
      });
    }
  };

  if (budi) {
    await seedDocuments(budi.id, BUDI_LEGAL_DOCUMENTS);
  }
  if (trial) {
    await seedDocuments(trial.id, TRIAL_LEGAL_DOCUMENTS);
  }

  // ─── 10. Seed Support Tickets & Ticket Messages ───────────────────
  const seedTickets = async (customerId: string, tickets: typeof BUDI_SUPPORT_TICKETS) => {
    for (const ticket of tickets) {
      await prisma.supportTicket.create({
        data: {
          customerId,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          category: ticket.category,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: new Date(Date.now() - ticket.daysAgo * 24 * 3600_000),
          messages: {
            create: ticket.messages.map((m) => ({
              senderName: m.senderName,
              senderRole: m.senderRole,
              senderAvatar: m.senderAvatar,
              message: m.message,
              isInternal: m.isInternal,
              createdAt: new Date(Date.now() - m.hoursAgo * 3600_000),
            })),
          },
        },
      });
    }
  };

  if (budi) {
    await seedTickets(budi.id, BUDI_SUPPORT_TICKETS);
  }
  if (trial) {
    await seedTickets(trial.id, TRIAL_SUPPORT_TICKETS);
  }

  const totalEmails = await prisma.messageCache.count();
  const totalDocuments = await prisma.legalDocument.count();
  const totalTickets = await prisma.supportTicket.count();
  const totalSessions = await prisma.loginSession.count();

  return {
    domain,
    adminEmail: admin.email,
    customersCount: CUSTOMERS_DATA.length,
    totalEmails,
    auditLogsCount: auditEntries.length,
    totalDocuments,
    totalTickets,
    totalSessions,
  };
}
