import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../src/lib/synology-sync';

const prisma = new PrismaClient();
const syncService = new SynologySyncService(prisma);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n=== Synology Drive Cold Storage Sync ===`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Simulasi)' : 'LIVE SYNC'}`);

  const status = await syncService.getStatus();
  console.log(`Target Folder : ${status.targetPath}`);
  console.log(`Folder Ready  : ${status.isAvailable ? 'YES' : 'NO'}`);
  console.log(`Synced Files  : ${status.totalSyncedFiles}`);
  console.log(`Pending Files : ${status.pendingFiles}\n`);

  console.log('Memulai proses sinkronisasi...');
  const result = await syncService.sync({ dryRun });

  console.log('\n--- Hasil Sinkronisasi ---');
  console.log(`Disalin Baru : ${result.syncedCount}`);
  console.log(`Dilewati     : ${result.skippedCount}`);
  console.log(`Gagal        : ${result.failedCount}`);
  console.log(`Total Data   : ${(result.totalBytesCopied / (1024 * 1024)).toFixed(2)} MB`);

  if (result.errors.length > 0) {
    console.log('\nKendala yang ditemukan:');
    result.errors.forEach((e) => console.log(` - ${e.path}: ${e.error}`));
  }

  console.log('\n✓ Selesai.\n');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
