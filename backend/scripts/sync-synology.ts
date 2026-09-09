import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../src/lib/synology-sync';

const prisma = new PrismaClient();
const syncService = new SynologySyncService(prisma);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n========================================================`);
  console.log(` [EasyLegal] Synology Drive Cold Storage Sync`);
  console.log(`========================================================`);
  console.log(`Mode          : ${dryRun ? 'DRY-RUN (Simulasi)' : 'LIVE SYNC (Menyalin Berkas)'}`);

  const status = await syncService.getStatus();
  console.log(`Target Folder : ${status.targetPath}`);
  console.log(`Struktur      : accounts/{email_akun}/`);
  console.log(`Folder Siap   : ${status.isAvailable ? 'YA (Terdeteksi)' : 'TIDAK (Belum Terpasang)'}`);
  console.log(`File Tersinkron: ${status.totalSyncedFiles}`);
  console.log(`File Pending  : ${status.pendingFiles}\n`);

  console.log('Memulai proses sinkronisasi cold storage...');
  const startTime = Date.now();
  const result = await syncService.sync({ dryRun });
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n--- Ringkasan Hasil Sinkronisasi ---');
  console.log(`Disalin Baru : ${result.syncedCount} berkas`);
  console.log(`Dilewati     : ${result.skippedCount} berkas (sudah tersinkron)`);
  console.log(`Gagal        : ${result.failedCount} berkas`);
  console.log(`Total Data   : ${(result.totalBytesCopied / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Waktu Proses : ${duration} detik`);

  if (result.errors.length > 0) {
    console.log('\nCatatan / Kendala:');
    result.errors.forEach((e) => console.log(` - ${e.path}: ${e.error}`));
  }

  console.log('\n✓ Sinkronisasi selesai!\n');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
