import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { purgeDummyData } from '../src/lib/clean-data';
import { getSynologyDir } from '../src/lib/storage';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================================');
  console.log(' [EasyLegal] Pembersihan Total Data Dummy & Demo Awal');
  console.log('========================================================\n');

  // 1. Purge database and physical storage dummy files
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(__dirname, '../storage');

  console.log(`📁 Storage directory : ${storageDir}`);
  const result = await purgeDummyData(prisma, storageDir);

  console.log(`\n✓ Database berhasil dibersihkan:`);
  console.log(`  - Customer dihapus : ${result.deletedCustomersCount}`);
  console.log(`  - Pesan email dummy: ${result.deletedMessagesCount}`);
  console.log(`  - Tiket support    : ${result.deletedTicketsCount}`);
  console.log(`  - Dokumen dummy    : ${result.deletedDocsCount}`);
  console.log(`  - File fisik dummy : ${result.deletedFilesCount}`);
  console.log(`  - Super Admin aktif: ${result.superAdminEmail}`);
  console.log(`  - Officer aktif    : ${result.officerEmail}`);

  // 2. Clean Synology cold storage dummy accounts if folder exists
  try {
    const synologyDir = getSynologyDir();
    if (fs.existsSync(synologyDir)) {
      const accountsDir = path.join(synologyDir, 'accounts');
      if (fs.existsSync(accountsDir)) {
        console.log(`\n📁 Membersihkan folder Synology Cold Storage: ${accountsDir}...`);
        fs.rmSync(accountsDir, { recursive: true, force: true });
        fs.mkdirSync(accountsDir, { recursive: true });
        console.log(`✓ Folder accounts Synology dibersihkan.`);
      }

      // Reset manifest
      const manifestPath = path.join(synologyDir, '.sync-manifest.json');
      if (fs.existsSync(manifestPath)) {
        fs.writeFileSync(
          manifestPath,
          JSON.stringify({ lastSyncAt: new Date().toISOString(), files: {} }, null, 2),
          'utf-8'
        );
        console.log(`✓ Manifest Synology (.sync-manifest.json) di-reset.`);
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Gagal membersihkan folder Synology:', err.message);
  }

  console.log('\n========================================================');
  console.log('🎉 SEMUA DATA & AKUN DUMMY BERHASIL DIHAPUS!');
  console.log('Sistem kini dalam kondisi BERSIH (Production Ready).');
  console.log('1. Akun Super Admin:');
  console.log(`   Email    : ${result.superAdminEmail}`);
  console.log(`   Password : ${process.env.INITIAL_ADMIN_PASSWORD || 'Admin123!'}`);
  console.log('2. Akun Officer (Staf Legal):');
  console.log(`   Email    : ${result.officerEmail}`);
  console.log(`   Password : ${process.env.INITIAL_OFFICER_PASSWORD || 'Officer123!'}`);
  console.log('========================================================\n');
}

main()
  .catch((err) => {
    console.error('Error saat membersihkan data dummy:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
