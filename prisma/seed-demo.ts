import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Seed must share the backend's ENCRYPTION_KEY or the seeded logins won't decrypt.
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/.env') });
import { PrismaClient } from '@prisma/client';
import { seedDemoData } from '../backend/src/lib/demo-data';

const prisma = new PrismaClient();
const storageDir = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../backend/storage');

async function main() {
  console.log('🌱 Menyiapkan database dengan Data Demo Lengkap untuk evaluasi UI & Live testing...');
  const result = await seedDemoData(prisma, storageDir);

  console.log(`\n================================================================`);
  console.log(`✅ DATA DUMMY BERHASIL DIBUAT DENGAN LENGKAP!`);
  console.log(`================================================================`);
  console.log(`Akun Admin EasyLegal:`);
  console.log(`  - URL         : http://localhost:3000/login (pilih tab Administrator)`);
  console.log(`  - Email       : admin@${result.domain}`);
  console.log(`  - Password    : Admin123!`);
  console.log(`  - Total Mailbox: ${result.customersCount} customer (6 aktif, 2 nonaktif)`);
  console.log(`  - Audit Logs  : ${result.auditLogsCount} entri riwayat aktivitas admin\n`);
  console.log(`Akun Customer Demo (Budi Setiawan - PT Maju Bersama Digital):
  - URL         : http://localhost:3000/login (pilih tab Customer Mail)
  - Email       : budi@${result.domain}
  - Password    : Customer123!
  - Total Email : 21 email (12 inbox, 4 sent, 2 draf, 3 trash)
  - Dokumen Hub : ${result.totalDocuments} dokumen legal dengan riwayat versi
  - Tiket Hub   : ${result.totalTickets} tiket support aktif & thread percakapan
  - Sesi Login  : ${result.totalSessions} sesi login audit perangkat
  - Lampiran File Nyata (.pdf, .xlsx, .png) siap diunduh!

Akun Trial Demo (Masa Percobaan 14 Hari):
  - URL         : http://localhost:3000/login (pilih tab Customer Mail)
  - Email       : trial@${result.domain}
  - Password    : Customer123!
  - Total Email : 9 email (5 inbox trial, 2 sent, 1 draf, 1 trash)
  - Lampiran File Nyata: Panduan_Memulai_Trial.pdf & Penawaran_Paket_Tahunan.pdf
===============================================================================\n`);
}

main()
  .catch((e) => {
    console.error('Error seeding demo data:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
