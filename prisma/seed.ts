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
  ['Invoice #INV-2025-014 jatuh tempo', 'billing@vendor.co.id', 'Halo, invoice INV-2025-014 sebesar Rp 4.500.000 jatuh tempo 7 hari lagi. Mohon konfirmasi pembayaran.'],
  ['Konfirmasi jadwal meeting Senin', 'rara@clientcorp.com', 'Selamat pagi, apakah jadwal meeting Senin jam 10.00 masih berlaku? Saya siapkan materinya.'],
  ['Dokumen legal sudah ditandatangani', 'legal@partner.id', 'Terlampir dokumen perjanjian kerja sama yang sudah ditandatangani kedua pihak.'],
  ['Reminder: perpanjangan domain', 'noreply@hostinger.com', 'Domain Anda akan kedaluwarsa dalam 30 hari. Perpanjang sekarang agar layanan email tetap aktif.'],
  ['Pertanyaan soal paket layanan', 'budi.santoso@gmail.com', 'Halo, saya ingin tahu perbedaan paket Basic dan Pro. Terima kasih.'],
  ['Laporan bulanan Agustus', 'ops@internal.co.id', 'Terlampir ringkasan operasional bulan Agustus. Highlight: 12 klien baru, 0 insiden.'],
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.messageCache.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.adminUser.deleteMany();

  await prisma.adminUser.create({
    data: {
      name: 'Admin Utama',
      email: 'admin@easylegal.co.id',
      passwordHash: await bcrypt.hash('Admin123!', 10),
      role: 'superadmin',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: 'Budi Setiawan',
      personalEmail: 'budi.pribadi@gmail.com',
      mailboxAddress: 'budi@easylegal.co.id',
      passwordEnc: encrypt('Customer123!'),
      status: 'active',
    },
  });

  await prisma.customer.create({
    data: {
      name: 'Siti Rahayu',
      personalEmail: 'siti.pribadi@gmail.com',
      mailboxAddress: 'siti@easylegal.co.id',
      passwordEnc: encrypt('Customer123!'),
      status: 'inactive',
    },
  });

  await prisma.messageCache.createMany({
    data: SAMPLES.map(([subject, sender, body], i) => ({
      mailboxId: customer.id,
      uid: String(1000 + i),
      folder: 'INBOX',
      subject,
      sender,
      recipients: customer.mailboxAddress,
      snippet: body.slice(0, 140),
      bodyText: body,
      bodyHtml: `<p>${body}</p>`,
      isRead: i > 3,
      isStarred: i === 0,
      receivedAt: new Date(Date.now() - i * 3600_000),
    })),
  });

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
      isRead: true,
      receivedAt: new Date(Date.now() - 7200_000),
    },
  });

  console.log('✓ Seeded: admin@easylegal.co.id / Admin123!  |  budi@easylegal.co.id / Customer123!');
}

main().finally(() => prisma.$disconnect());
