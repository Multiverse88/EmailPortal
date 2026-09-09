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

  it('formats account folder names with company name and email, sanitizing invalid characters', () => {
    const { getAccountFolderName, sanitizeFileName, sanitizeFolderName } = require('../src/lib/synology-sync');

    expect(getAccountFolderName({ name: 'PT Sinar Jaya', mailboxAddress: 'ptsinarjaya@clienteasylegal.co.id' }))
      .toBe('PT Sinar Jaya (ptsinarjaya@clienteasylegal.co.id)');

    expect(getAccountFolderName({ name: 'ptsinarjaya@clienteasylegal.co.id', mailboxAddress: 'ptsinarjaya@clienteasylegal.co.id' }))
      .toBe('ptsinarjaya@clienteasylegal.co.id');

    expect(getAccountFolderName({ name: 'PT/CV: Sinar * Jaya?', mailboxAddress: 'sinar@clienteasylegal.co.id' }))
      .toBe('PT_CV_ Sinar _ Jaya_ (sinar@clienteasylegal.co.id)');

    expect(getAccountFolderName({ name: null, mailboxAddress: 'budi@clienteasylegal.co.id' }))
      .toBe('budi@clienteasylegal.co.id');

    expect(sanitizeFileName('folder/sub/Akta Pendirian: PT?.pdf')).toBe('Akta Pendirian_ PT_.pdf');
    expect(sanitizeFolderName('Legal / Tax * Dept <HQ>')).toBe('Legal _ Tax _ Dept _HQ_');
  });

  it('syncs files to per-account folders and writes account-info.json in live mode', async () => {
    const fs = require('node:fs');
    const path = require('node:path');

    const result = await service.sync({ dryRun: false });
    expect(result.failedCount).toBe(0);

    const accountsDir = path.join(targetDir, 'accounts');
    expect(fs.existsSync(accountsDir)).toBe(true);

    // Verify account folders exist
    const entries = fs.readdirSync(accountsDir);
    expect(entries.length).toBeGreaterThan(0);

    // Check an account folder with account-info.json
    const accountFolders = entries.filter((e: string) => e.includes('@'));
    expect(accountFolders.length).toBeGreaterThan(0);
    const sampleAccount = accountFolders[0];
    const infoPath = path.join(accountsDir, sampleAccount, 'account-info.json');
    expect(fs.existsSync(infoPath)).toBe(true);

    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    expect(info.mailboxAddress).toBeDefined();
    expect(info.storageQuotaFormatted).toBe('5.0 GB');
  });
});
