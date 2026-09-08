import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Seed must share the backend's ENCRYPTION_KEY or the seeded logins won't decrypt.
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/.env') });
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encrypt } from '../backend/src/lib/crypto';

const prisma = new PrismaClient();

const SAMPLES = [
  {
    subject: 'Invoice #INV-2025-014 jatuh tempo',
    sender: 'billing@vendor.co.id',
    bodyText: 'Halo, invoice INV-2025-014 sebesar Rp 4.500.000 jatuh tempo 7 hari lagi. Mohon konfirmasi pembayaran.',
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
    bodyText: 'Selamat pagi, apakah jadwal meeting Senin jam 10.00 masih berlaku? Saya siapkan materinya.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Selamat pagi,</p>
        <p>Apakah jadwal meeting hari <strong>Senin jam 10.00 WIB</strong> masih berlaku? Saya akan siapkan materi presentasi dan draf perjanjian kerjasamanya.</p>
        <p>Agenda utama:<br/>1. Pembahasan klausul SLA distribusi<br/>2. Timeline pendaftaran hak merek dagang</p>
        <br/>
        <p>Salam,<br/><strong>Rara Amanda</strong><br/><span style="color: #64748b;">ClientCorp Partnerships</span></p>
      </div>
    `,
  },
  {
    subject: 'Dokumen legal sudah ditandatangani',
    sender: 'legal@partner.id',
    bodyText: 'Terlampir dokumen perjanjian kerja sama yang sudah ditandatangani kedua pihak.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Yth. Bapak Budi Setiawan,</p>
        <p>Terlampir dokumen perjanjian kerja sama resmi yang telah selesai ditandatangani secara elektronik (e-Meterai) oleh kedua belah pihak.</p>
        <p>Dokumen ini telah memiliki kekuatan hukum mengikat terhitung sejak tanggal diterbitkan.</p>
        <br/>
        <p>Hormat kami,<br/><strong>Tim Legal Partner ID</strong></p>
      </div>
    `,
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
    bodyText: 'Domain Anda akan kedaluwarsa dalam 30 hari. Perpanjang sekarang agar layanan email tetap aktif.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Halo Pelanggan Hostinger,</p>
        <p>Domain <code>clienteasylegal.co.id</code> Anda akan kedaluwarsa dalam <strong>30 hari</strong>. Segera lakukan perpanjangan agar mailbox dan routing DNS email tetap beroperasi optimal.</p>
        <br/>
        <p>Salam,<br/><strong>Hostinger Billing System</strong></p>
      </div>
    `,
  },
  {
    subject: 'Pertanyaan soal paket layanan',
    sender: 'budi.santoso@gmail.com',
    bodyText: 'Halo, saya ingin tahu perbedaan paket Basic dan Pro. Terima kasih.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Halo Tim EasyLegal,</p>
        <p>Saya tertarik dengan layanan pembuatan PT dan mailbox profesional. Mohon informasinya apa saja perbedaan fasilitas antara paket Basic dan paket Pro?</p>
        <br/>
        <p>Terima kasih,<br/><strong>Budi Santoso</strong></p>
      </div>
    `,
  },
  {
    subject: 'Laporan bulanan Agustus',
    sender: 'ops@internal.co.id',
    bodyText: 'Terlampir ringkasan operasional bulan Agustus. Highlight: 12 klien baru, 0 insiden.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Rekan-rekan sekalian,</p>
        <p>Berikut rangkuman operasional bulan Agustus:<br/>- <strong>12 klien baru</strong> berhasil onboarding<br/>- <strong>0 insiden</strong> downtime pada server mailbox<br/>- Response time rata-rata di bawah 15 menit</p>
        <br/>
        <p>Salam,<br/><strong>Operations Team</strong></p>
      </div>
    `,
  },
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.messageCache.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.adminUser.deleteMany();

  const domain = process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id';

  await prisma.adminUser.create({
    data: {
      name: 'Admin Utama EasyLegal',
      email: `admin@${domain}`,
      passwordHash: await bcrypt.hash('Admin123!', 10),
      role: 'superadmin',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: 'Budi Setiawan',
      personalEmail: 'budi.pribadi@gmail.com',
      mailboxAddress: `budi@${domain}`,
      passwordEnc: encrypt('Customer123!'),
      status: 'active',
    },
  });

  await prisma.customer.create({
    data: {
      name: 'Siti Rahayu',
      personalEmail: 'siti.pribadi@gmail.com',
      mailboxAddress: `siti@${domain}`,
      passwordEnc: encrypt('Customer123!'),
      status: 'inactive',
    },
  });

  for (let i = 0; i < SAMPLES.length; i++) {
    const item = SAMPLES[i];
    await prisma.messageCache.create({
      data: {
        mailboxId: customer.id,
        uid: String(1000 + i),
        folder: 'INBOX',
        subject: item.subject,
        sender: item.sender,
        recipients: customer.mailboxAddress,
        snippet: item.bodyText.slice(0, 140),
        bodyText: item.bodyText,
        bodyHtml: item.bodyHtml,
        isRead: i > 3,
        isStarred: i === 0,
        receivedAt: new Date(Date.now() - i * 3600_000),
        attachments: item.attachment
          ? {
              create: [item.attachment],
            }
          : undefined,
      },
    });
  }

  await prisma.messageCache.create({
    data: {
      mailboxId: customer.id,
      uid: 'sent-seed-1',
      folder: 'Sent',
      subject: 'Re: Konfirmasi jadwal meeting Senin',
      sender: customer.mailboxAddress,
      recipients: 'rara@clientcorp.com',
      snippet: 'Betul, Senin jam 10.00 tetap jalan.',
      bodyText: 'Betul, Senin jam 10.00 tetap jalan. Sampai ketemu.',
      bodyHtml: '<p>Betul, Senin jam 10.00 tetap jalan. Sampai ketemu.</p>',
      isRead: true,
      receivedAt: new Date(Date.now() - 7200_000),
    },
  });

  console.log(`✓ Seeded: admin@${domain} / Admin123!  |  budi@${domain} / Customer123!`);
}

main().finally(() => prisma.$disconnect());
