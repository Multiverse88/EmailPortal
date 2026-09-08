import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Seed must share the backend's ENCRYPTION_KEY or the seeded logins won't decrypt.
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/.env') });
import { PrismaClient } from '@prisma/client';
import { seedDemoData } from '../backend/src/lib/demo-data';

const prisma = new PrismaClient();
const storageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../backend/storage');

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
  console.log(`Akun Customer Demo (Budi Setiawan - PT Maju Bersama Digital):`);
  console.log(`  - URL         : http://localhost:3000/login (pilih tab Customer Mail)`);
  console.log(`  - Email       : budi@${result.domain}`);
  console.log(`  - Password    : Customer123!`);
  console.log(`  - Folder Kotak Masuk (Inbox)  : ${result.inboxCount} email`);
  console.log(`  - Folder Terkirim (Sent)      : ${result.sentCount} email`);
  console.log(`  - Folder Draf (Drafts)        : ${result.draftCount} draf`);
  console.log(`  - Folder Sampah (Trash)       : ${result.trashCount} email`);
  console.log(`  - Lampiran File Nyata (.pdf, .xlsx, .png) siap diunduh!`);
  console.log(`================================================================\n`);
}

main()
  .catch((e) => {
    console.error('Error seeding demo data:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
