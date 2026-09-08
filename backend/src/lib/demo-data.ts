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
(EasyLegal Portal - Dokumen Dummy) Tj
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
    subject: 'Invoice #INV-2026-088: Perpanjangan Izin Usaha & Virtual Office',
    sender: 'billing@easylegal.co.id',
    bodyText:
      'Halo Budi Setiawan, invoice perpanjangan izin usaha dan sewa virtual office periode 2026-2027 sebesar Rp 4.500.000 telah terbit. Jatuh tempo: 15 September 2026.',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; color: #1e3a8a; font-size: 20px;">EasyLegal Billing System</h2>
          <span style="background-color: #fef3c7; color: #92400e; font-weight: bold; font-size: 12px; padding: 4px 10px; border-radius: 9999px; border: 1px solid #fde68a;">Menunggu Pembayaran</span>
        </div>
        <p>Yth. <strong>Budi Setiawan</strong> (PT Maju Bersama Digital),</p>
        <p>Terima kasih atas kepercayaan Anda menggunakan layanan korporasi EasyLegal. Tagihan invoice perpanjangan perizinan usaha Anda telah diterbitkan dengan rincian sebagai berikut:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-align: left;">
              <th style="padding: 10px 14px;">Deskripsi Layanan</th>
              <th style="padding: 10px 14px; text-align: right;">Jumlah (IDR)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px;">Retainer Perizinan OSS-RBA Tahunan</td>
              <td style="padding: 10px 14px; text-align: right;">Rp 2.500.000</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px;">Virtual Office Dedicated Business Address (12 Bln)</td>
              <td style="padding: 10px 14px; text-align: right;">Rp 2.000.000</td>
            </tr>
            <tr style="font-weight: bold; background-color: #f8fafc;">
              <td style="padding: 12px 14px; color: #1e293b;">Total Tagihan</td>
              <td style="padding: 12px 14px; text-align: right; color: #2563eb; font-size: 16px;">Rp 4.500.000</td>
            </tr>
          </tbody>
        </table>

        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 4px 0; font-weight: bold; color: #1e40af;">Instruksi Pembayaran Transfer Bank:</p>
          <p style="margin: 0; font-size: 13px; color: #1e3a8a;">Bank Central Asia (BCA) - <strong>8830-1928-441</strong> a.n. PT Solusi Legalitas Indonesia</p>
        </div>

        <p style="font-size: 13px; color: #64748b;">Invoice resmi dalam format PDF dengan tanda tangan digital terlampir di bawah ini.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">EasyLegal Indonesia • Menara Kuningan Lt. 18, Jakarta Selatan • finance@easylegal.co.id</p>
      </div>
    `,
    isRead: false,
    isStarred: true,
    hoursAgo: 1,
    attachment: {
      filename: 'Invoice_INV-2026-088.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 180,
      path: 'invoice-2025-088.pdf',
    },
  },
  {
    subject: 'Perjanjian Kerjasama & Akta Notaris Selesai Ditandatangani',
    sender: 'legal@notaris-ahmad.co.id',
    bodyText:
      'Yth. Bapak Budi Setiawan, akta notaris perubahan anggaran dasar dan dokumen perjanjian kerjasama telah selesai ditandatangani dengan e-Meterai Peruri.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <h3 style="color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Kantor Notaris & PPAT Ahmad Fauzi, S.H., M.Kn.</h3>
        <p>Yth. Bapak <strong>Budi Setiawan</strong>,</p>
        <p>Dengan hormat, kami informasikan bahwa dokumen <strong>Akta Perjanjian Kerjasama Investasi & Kemitraan Usaha</strong> telah selesai diproses dan ditandatangani secara elektronik menggunakan <strong>e-Meterai resmi Peruri</strong>.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin: 16px 0; color: #166534;">
          <strong>✓ Status Legalisasi:</strong> Sah & Terverifikasi pada Database Kemenkumham RI.<br/>
          <strong>Nomor Registrasi Akta:</strong> 44/NOT-AF/IX/2026
        </div>
        <p>Salinan dokumen lengkap terlampir dalam email ini untuk arsip legalitas perusahaan Anda.</p>
        <br/>
        <p>Hormat kami,<br/><strong>Ahmad Fauzi, S.H., M.Kn.</strong><br/><span style="color: #64748b; font-size: 13px;">Notaris Rekanan EasyLegal</span></p>
      </div>
    `,
    isRead: false,
    isStarred: true,
    hoursAgo: 3,
    attachment: {
      filename: 'Perjanjian_Kerjasama_Final.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 350,
      path: 'perjanjian-kerjasama.pdf',
    },
  },
  {
    subject: 'Pemberitahuan: SK Kemenkumham PT Maju Bersama Digital Telah Terbit',
    sender: 'perizinan@easylegal.co.id',
    bodyText:
      'Selamat! Surat Keputusan Menteri Hukum dan HAM atas pendirian dan pengesahan badan hukum PT Maju Bersama Digital telah resmi terbit.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px;">PENGESAHAN BADAN HUKUM SELESAI</h2>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">Direktorat Jenderal Administrasi Hukum Umum (AHU) Online</p>
        </div>
        <p>Yth. <strong>Bapak Budi Setiawan</strong>,</p>
        <p>Kabar gembira! Proses verifikasi dan pengesahan badan hukum untuk <strong>PT Maju Bersama Digital</strong> telah disetujui oleh Kementerian Hukum dan HAM RI.</p>
        <ul>
          <li><strong>Nomor SK AHU:</strong> AHU-0091823.AH.01.01.TAHUN 2026</li>
          <li><strong>NIB:</strong> 0220194817291</li>
          <li><strong>Status:</strong> Efektif & Operasional</li>
        </ul>
        <p>Anda kini dapat menggunakan SK ini untuk pembukaan rekening giro korporat dan pendaftaran BPJS Ketenagakerjaan.</p>
        <p>Salam sukses,<br/><strong>Divisi Perizinan & Korporasi EasyLegal</strong></p>
      </div>
    `,
    isRead: false,
    isStarred: false,
    hoursAgo: 6,
    attachment: {
      filename: 'SK_Kemenkumham_PT_Maju_Bersama.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 240,
      path: 'sk-kemenkumham-2026.pdf',
    },
  },
  {
    subject: 'Laporan Rekonsiliasi & Audit Pajak Triwulan Q3 2026',
    sender: 'audit@taxpartner.id',
    bodyText:
      'Terlampir laporan rekonsiliasi PPh 21, PPh 23, dan PPN untuk periode Juli - September 2026. Semua status kewajiban pajak dilaporkan nihil denda.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <h3 style="color: #1e3a8a; margin-top: 0;">Laporan Pajak Triwulanan (Q3 2026)</h3>
        <p>Halo Pak Budi,</p>
        <p>Berikut rangkuman rekonsiliasi pelaporan pajak triwulan ketiga untuk PT Maju Bersama Digital:</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>SPT Masa PPh 21:</strong> Sudah lapor (NTPN: 2910481720)</li>
            <li><strong>SPT Masa PPN:</strong> Nihil kompensasi</li>
            <li><strong>Status Denda / Kurang Bayar:</strong> Rp 0 (Nihil)</li>
          </ul>
        </div>
        <p>Worksheet lengkap dan bukti penerimaan elektronik (BPE) terlampir dalam file spreadsheet berikut.</p>
        <br/>
        <p>Salam hangat,<br/><strong>Hendrik Tanuwijaya</strong><br/><span style="color: #64748b;">Senior Tax Consultant</span></p>
      </div>
    `,
    isRead: false,
    isStarred: false,
    hoursAgo: 12,
    attachment: {
      filename: 'Laporan_Audit_Pajak_Q3.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024 * 38,
      path: 'laporan-q3.xlsx',
    },
  },
  {
    subject: 'Konfirmasi Jadwal Rapat Koordinasi Direksi Hari Senin',
    sender: 'rara@clientcorp.com',
    bodyText:
      'Selamat pagi Pak Budi, apakah jadwal meeting evaluasi kemitraan hari Senin jam 10.00 WIB tetap diadakan via Zoom? Mohon konfirmasinya.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <p>Selamat pagi Pak Budi,</p>
        <p>Melanjutkan pembahasan pekan lalu, kami ingin mengonfirmasi jadwal rapat koordinasi evaluasi kemitraan strategis:</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>📅 Waktu:</strong> Senin, 14 September 2026 | 10.00 - 11.30 WIB</p>
          <p style="margin: 0 0 6px 0;"><strong>📍 Media:</strong> Google Meet / Zoom</p>
          <p style="margin: 0;"><strong>🎯 Agenda:</strong> Pembahasan timeline distribusi dan klausul SLA sistem</p>
        </div>
        <p>Jika jadwal tersebut berkenan, kami akan segera mengirimkan kalender undangan resmi dan link meeting room.</p>
        <br/>
        <p>Salam hangat,<br/><strong>Rara Amanda</strong><br/>VP of Business Partnership, ClientCorp</p>
      </div>
    `,
    isRead: false,
    isStarred: false,
    hoursAgo: 18,
  },
  {
    subject: 'Reminder: Status Domain & Layanan Mailbox clienteasylegal.co.id',
    sender: 'noreply@hostinger.com',
    bodyText:
      'Pemberitahuan otomatis: Domain clienteasylegal.co.id aktif hingga Mei 2027. Kuota mailbox saat ini 0.2% dari 100 akun.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #22c55e;"></div>
          <span style="font-weight: bold; color: #15803d; font-size: 14px;">Semua Layanan Berjalan Normal</span>
        </div>
        <p>Halo Pelanggan Hostinger,</p>
        <p>Layanan email profesional untuk domain <code>clienteasylegal.co.id</code> terpantau dalam kondisi prima dengan metrik terbaru:</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Domain:</strong> clienteasylegal.co.id (Aktif s/d 28 Mei 2027)</p>
          <p style="margin: 0 0 6px 0;"><strong>Paket:</strong> Free Business Email</p>
          <p style="margin: 0 0 6px 0;"><strong>Penggunaan Kuota:</strong> 0% (21 KB / 1.00 GB per mailbox)</p>
          <p style="margin: 0;"><strong>Status Anti-Spam / DKIM:</strong> Terverifikasi (SPF & DKIM Valid)</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">Pesan ini merupakan notifikasi otomatis dari sistem pemantauan infrastruktur Hostinger.</p>
      </div>
    `,
    isRead: true,
    isStarred: true,
    hoursAgo: 24,
  },
  {
    subject: 'Scan Kelengkapan Berkas NPWP & NIB OSS RBA',
    sender: 'ops@partnerlegal.id',
    bodyText:
      'Terlampir hasil scan dokumen perizinan NIB berbasis risiko dan NPWP cabang yang sudah disahkan dinas terkait.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <p>Halo Pak Budi,</p>
        <p>Sesuai permintaan Anda kemarin, kami kirimkan file scan resolusi tinggi untuk dokumen legalitas pendukung:</p>
        <ul>
          <li>Scan NIB OSS RBA (KBLI 62019 - Aktivitas Pemrograman Komputer)</li>
          <li>NPWP Badan Usaha Terdaftar</li>
        </ul>
        <p>Berkas fisik aslinya sudah kami simpan di brankas dokumen kantor virtual kami dan siap diambil sewaktu-waktu.</p>
        <p>Salam,<br/><strong>Operations Partner Legal</strong></p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 36,
    attachment: {
      filename: 'Scan_Dokumen_NIB.png',
      mimeType: 'image/png',
      size: 1024 * 70,
      path: 'scan-dokumen.png',
    },
  },
  {
    subject: 'Pertanyaan Konsultasi: Penambahan Modal Disetor Perusahaan',
    sender: 'investor.relations@venture.id',
    bodyText:
      'Selamat siang Pak Budi, kami dari tim penasihat investasi ingin mendiskusikan mekanisme RUPS untuk peningkatan modal disetor seri A.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <p>Selamat siang Pak Budi,</p>
        <p>Sehubungan dengan rencana injeksi pendanaan putaran awal dari sindikasi investor kami, kami membutuhkan kejelasan terkait jadwal penerbitan saham baru dalam portepel serta pelaksanaan Rapat Umum Pemegang Saham Luar Biasa (RUPS-LB).</p>
        <p>Apakah draf perubahan anggaran dasar sudah bisa kami review bersama konsultan hukum EasyLegal?</p>
        <br/>
        <p>Salam,<br/><strong>Jonathan Prakoso</strong><br/>Investment Associate</p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 48,
  },
  {
    subject: 'Tiket Bantuan #EL-9042: Konfigurasi DNS Mailbox Selesai',
    sender: 'support@easylegal.co.id',
    bodyText:
      'Tiket support Anda #EL-9042 perihal sinkronisasi domain mail clienteasylegal.co.id telah berhasil diselesaikan oleh tim teknis.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 6px 0; color: #166534;">Tiket Bantuan #EL-9042 Telah Ditutup (Resolved)</h4>
          <p style="margin: 0; font-size: 13px; color: #15803d;">Topik: Konfigurasi MX Record & Sinkronisasi Hostinger Mailbox</p>
        </div>
        <p>Halo Budi Setiawan,</p>
        <p>Tim IT EasyLegal telah menyelesaikan konfigurasi routing DNS untuk portal email Anda. Seluruh fungsionalitas pengiriman (SMTP) dan penerimaan (IMAP) saat ini telah aktif dan berjalan stabil.</p>
        <p>Jika ada kendala lebih lanjut, silakan balas email ini atau hubungi helpdesk kami.</p>
        <br/>
        <p>Salam hangat,<br/><strong>Customer Support EasyLegal</strong></p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 60,
  },
  {
    subject: 'Newsletter Legal Insight: Rangkuman Regulasi Ketenagakerjaan 2026',
    sender: 'newsletter@legalinsight.id',
    bodyText:
      'Edisi September 2026: Poin-poin penting ketentuan PKWT, kompensasi pemutusan kerja, dan standarisasi kepatuhan BPJS Ketenagakerjaan bagi startup.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Legal Insight Weekly • Edisi 38</h2>
        <p>Halo Penggiat Usaha,</p>
        <p>Kepatuhan hukum ketenagakerjaan menjadi salah satu kunci stabilitas operasional bisnis. Dalam edisi kali ini, pakar hukum ketenagakerjaan EasyLegal mengulas 3 poin utama:</p>
        <ol>
          <li>Penyesuaian klausul perjanjian kerja waktu tertentu (PKWT) pasca aturan turunan terbaru.</li>
          <li>Hak kompensasi akhir kontrak bagi karyawan kontrak di sektor digital.</li>
          <li>Integrasi sistem payroll dengan e-SPT PPh 21 Ditjen Pajak.</li>
        </ol>
        <p style="font-size: 13px; color: #64748b;">Ingin konsultasi langsung dengan konsultan hukum ketenagakerjaan kami? Balas email ini dengan subject "Konsultasi HR Legal".</p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 72,
  },
  {
    subject: 'Konfirmasi Penerimaan Berkas Tender Pengadaan IT',
    sender: 'procurement@bumn-mitra.co.id',
    bodyText:
      'Panitia tender telah menerima berkas prakualifikasi teknis dari PT Maju Bersama Digital untuk paket pengadaan sistem manajemen arsip elektronik.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <p>Kepada Yth. <strong>Direksi PT Maju Bersama Digital</strong>,</p>
        <p>Bersama ini kami sampaikan tanda terima resmi penyerahan dokumen penawaran teknis dan administrasi tender:</p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin: 14px 0; font-size: 13px;">
          <strong>Nomor Pengadaan:</strong> TDR-IT-2026-0041<br/>
          <strong>Waktu Penerimaan:</strong> Jumat, 11 September 2026 - 14.30 WIB<br/>
          <strong>Status Verifikasi Dokumen:</strong> Lengkap & Memenuhi Syarat Tahap 1
        </div>
        <p>Tahap evaluasi harga akan diumumkan melalui portal e-Procurement resmi pada hari Rabu mendatang.</p>
        <br/>
        <p>Hormat kami,<br/><strong>Sekretariat Panitia Pengadaan</strong></p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 96,
  },
  {
    subject: 'Selamat Bergabung di EasyLegal Mailbox Portal',
    sender: 'admin@clienteasylegal.co.id',
    bodyText:
      'Selamat datang di portal email khusus klien EasyLegal. Mailbox Anda telah aktif dan siap digunakan untuk komunikasi resmi perusahaan.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px;">
        <div style="background-color: #1e3a8a; color: white; padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0 0 10px 0; font-size: 24px;">Selamat Datang di EasyLegal Portal!</h1>
          <p style="margin: 0; font-size: 15px; opacity: 0.9;">Solusi Komunikasi Resmi & Aman Berbasis Domain Perusahaan</p>
        </div>
        <p>Halo <strong>Budi Setiawan</strong>,</p>
        <p>Alamat email profesional Anda <code>budi@clienteasylegal.co.id</code> telah berhasil dibuat dan diintegrasikan dengan infrastruktur Titan Mail Hostinger.</p>
        <p><strong>Tips Penggunaan:</strong></p>
        <ul>
          <li>Gunakan menu <strong>Pengaturan</strong> di pojok kanan atas untuk mengganti password kapan saja.</li>
          <li>Simpan email penting dengan menandainya menggunakan ikon <strong>Bintang</strong>.</li>
          <li>Kirim lampiran dokumen resmi hingga 10MB langsung dari tombol <strong>Tulis Email</strong>.</li>
        </ul>
        <p>Salam sukses dan selamat beraktivitas!</p>
        <br/>
        <p><strong>Tim Manajemen EasyLegal</strong></p>
      </div>
    `,
    isRead: true,
    isStarred: false,
    hoursAgo: 120,
  },
];

export const SENT_EMAILS = [
  {
    subject: 'Re: Konfirmasi Jadwal Rapat Koordinasi Direksi Hari Senin',
    recipients: 'rara@clientcorp.com',
    bodyText:
      'Halo Bu Rara, terima kasih konfirmasinya. Jadwal Senin jam 10.00 WIB sangat cocok bagi tim kami. Silakan kirimkan link Google Meet ke email ini.',
    bodyHtml:
      '<p>Halo Bu Rara,</p><p>Terima kasih atas konfirmasinya. Jadwal <strong>Senin jam 10.00 WIB</strong> sangat cocok bagi kami. Silakan kirimkan link Google Meet ke email ini, kami akan hadir bersama tim teknis.</p><br/><p>Salam,<br/><strong>Budi Setiawan</strong></p>',
    hoursAgo: 16,
  },
  {
    subject: 'Konfirmasi Pembayaran Invoice #INV-2026-088',
    recipients: 'billing@easylegal.co.id',
    bodyText:
      'Selamat siang Tim Billing EasyLegal, bersama ini kami lampirkan bukti transfer pelunasan tagihan invoice #INV-2026-088 sebesar Rp 4.500.000 via BCA. Mohon dicek.',
    bodyHtml:
      '<p>Selamat siang Tim Billing EasyLegal,</p><p>Bersama ini kami lampirkan bukti transfer pembayaran lunas untuk invoice <strong>#INV-2026-088</strong> sebesar <strong>Rp 4.500.000</strong> via transfer m-Banking BCA.</p><p>Mohon konfirmasi jika dana sudah masuk dan kwitansi resmi telah diterbitkan. Terima kasih.</p><br/><p>Salam hormat,<br/><strong>Budi Setiawan</strong><br/>PT Maju Bersama Digital</p>',
    hoursAgo: 8,
    attachment: {
      filename: 'Bukti_Transfer_BCA.png',
      mimeType: 'image/png',
      size: 1024 * 70,
      path: 'bukti-transfer-bca.png',
    },
  },
  {
    subject: 'Pengiriman Draf Perjanjian Kerjasama Kerahasiaan (NDA)',
    recipients: 'legal@notaris-ahmad.co.id',
    bodyText:
      'Yth. Notaris Ahmad Fauzi, berikut kami kirimkan revisi klausul pasal 7 terkait kerahasiaan data pengguna untuk ditinjau.',
    bodyHtml:
      '<p>Yth. Bapak Notaris Ahmad Fauzi, S.H.,</p><p>Berikut kami kirimkan penyesuaian draf pasal 7 mengenai perlindungan data pribadi dan masa retensi dokumen rahasia sesuai masukan tim kepatuhan kami.</p><br/><p>Hormat kami,<br/><strong>Budi Setiawan</strong></p>',
    hoursAgo: 28,
  },
  {
    subject: 'Data KTP & NPWP Direksi untuk Pengurusan OSS',
    recipients: 'perizinan@easylegal.co.id',
    bodyText:
      'Halo Tim Perizinan, data identitas KTP dan NPWP seluruh jajaran direksi PT Maju Bersama Digital telah kami kumpulkan dan verifikasi validitasnya.',
    bodyHtml:
      '<p>Halo Tim Perizinan EasyLegal,</p><p>Seluruh berkas identitas direksi dan komisaris untuk keperluan integrasi NIB OSS telah siap diproses.</p><br/><p>Salam,<br/><strong>Budi Setiawan</strong></p>',
    hoursAgo: 50,
  },
];

export const DRAFT_EMAILS = [
  {
    subject: '[Draf] Pengajuan Perubahan Susunan Pengurus & Anggaran Dasar',
    recipients: 'notaris@legalitas.co.id',
    bodyText:
      'Dengan hormat, sehubungan dengan keputusan RUPS tanggal 1 September mengenai pengunduran diri komisaris...',
    bodyHtml:
      '<p>Dengan hormat,</p><p>Sehubungan dengan hasil keputusan RUPS Luar Biasa tertanggal 1 September mengenai perubahan susunan dewan komisaris...</p>',
    hoursAgo: 5,
  },
  {
    subject: '[Draf] Permohonan Keringanan Biaya Konsultasi Hukum Retainer',
    recipients: 'finance@easylegal.co.id',
    bodyText:
      'Selamat pagi rekan-rekan finance, kami ingin menanyakan apakah ada skema pembayaran multi-tahap untuk retainer tahunan...',
    bodyHtml:
      '<p>Selamat pagi Tim Finance EasyLegal,</p><p>Kami ingin menanyakan terkait program kemitraan tahun kedua...</p>',
    hoursAgo: 20,
  },
];

export const TRASH_EMAILS = [
  {
    subject: '[Promo] Sewa Ruang Meeting & Virtual Office Diskon 40%',
    sender: 'promo@spaceoffice.id',
    bodyText:
      'Dapatkan diskon spesial akhir tahun untuk sewa ruang meeting di kawasan SCBD Sudirman.',
    bodyHtml:
      '<p>Dapatkan diskon 40% pemesanan ruang rapat representatif di pusat bisnis Jakarta.</p>',
    hoursAgo: 140,
  },
  {
    subject: 'Katalog Alat Tulis Kantor & Kebutuhan Printing Q4',
    sender: 'sales@stationery-murah.co.id',
    bodyText:
      'Penawaran suplai kertas HVS dan toner printer kantor dengan harga distributor langsung.',
    bodyHtml:
      '<p>Katalog perlengkapan kantor triwulan 4 siap diantar gratis ongkir se-Jabodetabek.</p>',
    hoursAgo: 160,
  },
  {
    subject: 'Undangan Survei Evaluasi Kepuasan Vendor 2026',
    sender: 'survey@research-market.id',
    bodyText:
      'Mohon luangkan waktu 3 menit untuk mengisi kuesioner evaluasi layanan vendor rekanan.',
    bodyHtml:
      '<p>Survei tahunan kepuasan mitra bisnis. Masukan Anda sangat berharga bagi kami.</p>',
    hoursAgo: 180,
  },
];

export const CUSTOMERS_DATA = [
  {
    name: 'Budi Setiawan',
    personalEmail: 'budi.pribadi@gmail.com',
    localPart: 'budi',
    status: 'active',
    lastLoginMinutesAgo: 15,
  },
  {
    name: 'Siti Rahayu',
    personalEmail: 'siti.pribadi@gmail.com',
    localPart: 'siti',
    status: 'inactive',
    lastLoginMinutesAgo: 60 * 24 * 5,
  },
  {
    name: 'Hendra Wijaya',
    personalEmail: 'hendra.wijaya@sinarterang.com',
    localPart: 'hendra',
    status: 'active',
    lastLoginMinutesAgo: 120,
  },
  {
    name: 'Dewi Lestari',
    personalEmail: 'dewi.lestari@digitalsolusi.co.id',
    localPart: 'dewi',
    status: 'active',
    lastLoginMinutesAgo: 60 * 24 * 1,
  },
  {
    name: 'Ahmad Fauzi, S.H.',
    personalEmail: 'notaris.ahmad@gmail.com',
    localPart: 'ahmad',
    status: 'active',
    lastLoginMinutesAgo: 60 * 24 * 3,
  },
  {
    name: 'Rudi Hartono',
    personalEmail: 'rudi.hartono@koperasisejahtera.id',
    localPart: 'rudi',
    status: 'active',
    lastLoginMinutesAgo: null,
  },
  {
    name: 'Maya Safitri',
    personalEmail: 'maya.safitri@kreatifmedia.id',
    localPart: 'maya',
    status: 'inactive',
    lastLoginMinutesAgo: null,
  },
  {
    name: 'Eka Pratama',
    personalEmail: 'eka.pratama@logistiknusantara.co.id',
    localPart: 'eka',
    status: 'active',
    lastLoginMinutesAgo: 60 * 24 * 4,
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
  await prisma.attachment.deleteMany();
  await prisma.messageCache.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.adminUser.deleteMany();

  // 2. Buat Admin Utama
  const admin = await prisma.adminUser.create({
    data: {
      name: 'Admin Utama EasyLegal',
      email: `admin@${domain}`,
      passwordHash: await bcrypt.hash('Admin123!', 10),
      role: 'superadmin',
      lastLoginAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  // 3. Buat Customer Mailbox
  const createdCustomers: Record<string, any> = {};
  for (const c of CUSTOMERS_DATA) {
    const cust = await prisma.customer.create({
      data: {
        name: c.name,
        personalEmail: c.personalEmail,
        mailboxAddress: `${c.localPart}@${domain}`,
        passwordEnc: encrypt('Customer123!'),
        status: c.status,
        lastLoginAt: c.lastLoginMinutesAgo
          ? new Date(Date.now() - c.lastLoginMinutesAgo * 60 * 1000)
          : null,
      },
    });
    createdCustomers[c.localPart] = cust;
  }

  const budi = createdCustomers['budi'];

  // 4. Masukkan Email INBOX untuk Budi
  let uidCounter = 2000;
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

  // 5. Masukkan Email SENT untuk Budi
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

  // 6. Masukkan Email DRAFT untuk Budi
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

  // 7. Masukkan Email TRASH untuk Budi
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

  // 8. Masukkan Audit Logs
  const auditEntries = [
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

  return {
    domain,
    adminEmail: admin.email,
    customersCount: CUSTOMERS_DATA.length,
    inboxCount: INBOX_EMAILS.length,
    sentCount: SENT_EMAILS.length,
    draftCount: DRAFT_EMAILS.length,
    trashCount: TRASH_EMAILS.length,
    auditLogsCount: auditEntries.length,
  };
}
