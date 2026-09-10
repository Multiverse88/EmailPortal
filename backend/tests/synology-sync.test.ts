import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../src/lib/synology-sync';
import { getSynologyDir } from '../src/lib/storage';

const prisma = new PrismaClient();

describe('SynologySyncService', () => {
  const service = new SynologySyncService(prisma);
  const targetDir = getSynologyDir();

  beforeAll(async () => {
    jest.setTimeout(30000);
    service.initTargetFolder();
    await prisma.customer.upsert({
      where: { mailboxAddress: 'test-sync@clienteasylegal.co.id' },
      update: {},
      create: {
        id: 'test-sync-cust-1',
        name: 'Test Sync PT',
        personalEmail: 'test-sync@personal.com',
        mailboxAddress: 'test-sync@clienteasylegal.co.id',
        passwordEnc: 'mockpass',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({
      where: { mailboxAddress: 'test-sync@clienteasylegal.co.id' },
    });
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

  it('formats account folder names with pure email address and sanitizes invalid characters', () => {
    const { getAccountFolderName, sanitizeFileName, sanitizeFolderName } = require('../src/lib/synology-sync');

    expect(getAccountFolderName({ name: 'PT Sinar Jaya', mailboxAddress: 'ptsinarjaya@clienteasylegal.co.id' }))
      .toBe('ptsinarjaya@clienteasylegal.co.id');

    expect(getAccountFolderName({ name: 'Ahmad Subarjo', mailboxAddress: 'ahmad@clienteasylegal.co.id' }))
      .toBe('ahmad@clienteasylegal.co.id');

    expect(getAccountFolderName({ name: 'No Mailbox', personalEmail: 'personal@gmail.com' }))
      .toBe('personal@gmail.com');

    expect(getAccountFolderName(null)).toBe('general');

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
