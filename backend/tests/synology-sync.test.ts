import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../src/lib/synology-sync';
import { getSynologyDir } from '../src/lib/storage';

const prisma = new PrismaClient();

describe('SynologySyncService', () => {
  const service = new SynologySyncService(prisma);
  const targetDir = getSynologyDir();

  beforeAll(async () => {
    service.initTargetFolder();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports synology status', async () => {
    const status = await service.getStatus();
    expect(typeof status.isAvailable).toBe('boolean');
    expect(status.targetPath).toBe(targetDir);
    expect(typeof status.totalSyncedFiles).toBe('number');
    expect(typeof status.pendingFiles).toBe('number');
  });

  it('runs sync in dry-run mode without crashing', async () => {
    const result = await service.sync({ dryRun: true });
    expect(typeof result.syncedCount).toBe('number');
    expect(typeof result.skippedCount).toBe('number');
    expect(typeof result.failedCount).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
