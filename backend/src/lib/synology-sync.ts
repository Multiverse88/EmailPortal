import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { getSynologyDir, storage } from './storage';

export interface SynologyStatus {
  isAvailable: boolean;
  targetPath: string;
  totalSyncedFiles: number;
  pendingFiles: number;
  lastSyncAt: string | null;
}

export interface SynologySyncResult {
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  totalBytesCopied: number;
  errors: Array<{ path: string; error: string }>;
}

interface SyncManifest {
  lastSyncAt: string | null;
  files: Record<string, { size: number; syncedAt: string; account?: string; docId?: string }>;
}

export function sanitizeFolderName(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeFileName(filename: string): string {
  return path.basename(filename).replace(/[/\\:*?"<>|]/g, '_').trim();
}

export function getAccountFolderName(
  customer?: { name?: string | null; mailboxAddress?: string | null; personalEmail?: string | null } | null
): string {
  if (!customer) return 'general';
  const email = (customer.mailboxAddress || customer.personalEmail || '').trim().toLowerCase();
  if (email) {
    return sanitizeFolderName(email);
  }
  const fallback = (customer.name || '').trim().toLowerCase();
  return sanitizeFolderName(fallback) || 'general';
}

export class SynologySyncService {
  private targetDir: string;

  constructor(private prisma: PrismaClient) {
    this.targetDir = getSynologyDir();
  }

  private getManifestPath(): string {
    return path.join(this.targetDir, '.sync-manifest.json');
  }

  private readManifest(): SyncManifest {
    const manifestPath = this.getManifestPath();
    if (!fs.existsSync(manifestPath)) {
      return { lastSyncAt: null, files: {} };
    }
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return { lastSyncAt: null, files: {} };
    }
  }

  private writeManifest(manifest: SyncManifest): void {
    const manifestPath = this.getManifestPath();
    this.initTargetFolder();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  initTargetFolder(): boolean {
    try {
      if (!fs.existsSync(this.targetDir)) {
        fs.mkdirSync(this.targetDir, { recursive: true });
      }
      const accountsDir = path.join(this.targetDir, 'accounts');
      if (!fs.existsSync(accountsDir)) {
        fs.mkdirSync(accountsDir, { recursive: true });
      }
      return true;
    } catch (error) {
      console.warn('Could not initialize Synology directory:', error);
      return false;
    }
  }

  async getStatus(): Promise<SynologyStatus> {
    const isAvailable = fs.existsSync(this.targetDir);
    const manifest = isAvailable ? this.readManifest() : { lastSyncAt: null, files: {} };
    const syncedCount = Object.keys(manifest.files).length;

    const [totalDocs, totalAttachments, totalAvatars] = await Promise.all([
      this.prisma.legalDocument.count(),
      this.prisma.attachment.count({
        where: { NOT: { path: { startsWith: 'api-attach:' } } },
      }),
      this.prisma.customer.count({
        where: { avatarUrl: { not: null } },
      }),
    ]);

    const totalRecords = totalDocs + totalAttachments + totalAvatars;
    const pendingFiles = Math.max(0, totalRecords - syncedCount);

    return {
      isAvailable,
      targetPath: this.targetDir,
      totalSyncedFiles: syncedCount,
      pendingFiles,
      lastSyncAt: manifest.lastSyncAt,
    };
  }

  async sync(options?: { dryRun?: boolean }): Promise<SynologySyncResult> {
    const dryRun = Boolean(options?.dryRun);
    this.initTargetFolder();

    const manifest = this.readManifest();
    const result: SynologySyncResult = {
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      totalBytesCopied: 0,
      errors: [],
    };

    const usedRelPaths = new Set<string>();

    // 1. Scan legal documents with customer info
    const documents = await this.prisma.legalDocument.findMany({
      include: { customer: true },
    });

    for (const doc of documents) {
      const accountFolder = getAccountFolderName(doc.customer);
      const cleanName = sanitizeFileName(doc.filename || doc.title || 'document.pdf');
      
      let relPath = `accounts/${accountFolder}/documents/${cleanName}`;
      if (usedRelPaths.has(relPath)) {
        relPath = `accounts/${accountFolder}/documents/${path.parse(cleanName).name}_${doc.id.slice(0, 6)}${path.extname(cleanName)}`;
      }
      usedRelPaths.add(relPath);

      const destPath = path.join(this.targetDir, relPath);

      if (manifest.files[relPath] && fs.existsSync(destPath)) {
        result.skippedCount++;
        continue;
      }

      try {
        let buffer: Buffer | null = null;
        
        // Priority 1: Check isolated account bucket key in storage adapter
        const accountBucketKey = `accounts/${doc.customerId}/documents/${path.basename(doc.path)}`;
        if (await storage.objectExists(accountBucketKey)) {
          buffer = await storage.getObject(accountBucketKey);
        }

        // Priority 2: Check legacy bucket key
        if (!buffer) {
          const legacyBucketKey = `documents/${doc.customerId}/${path.basename(doc.path)}`;
          if (await storage.objectExists(legacyBucketKey)) {
            buffer = await storage.getObject(legacyBucketKey);
          }
        }

        // Priority 3: Check storage directory on local disk
        if (!buffer) {
          const legacyBase = process.env.STORAGE_DIR || './storage';
          const legacyPath = path.resolve(legacyBase, path.basename(doc.path));
          if (fs.existsSync(legacyPath)) {
            buffer = await fs.promises.readFile(legacyPath);
          }
        }

        // Priority 4: Check by original filename on local disk
        if (!buffer) {
          const legacyBase = process.env.STORAGE_DIR || './storage';
          const altPath = path.resolve(legacyBase, doc.filename);
          if (fs.existsSync(altPath)) {
            buffer = await fs.promises.readFile(altPath);
          }
        }

        if (!buffer) {
          result.failedCount++;
          result.errors.push({ path: relPath, error: 'Source file not found in storage' });
          continue;
        }

        if (!dryRun) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          await fs.promises.writeFile(destPath, buffer);
          manifest.files[relPath] = {
            size: buffer.length,
            syncedAt: new Date().toISOString(),
            account: accountFolder,
            docId: doc.id,
          };
        }

        result.syncedCount++;
        result.totalBytesCopied += buffer.length;
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({ path: relPath, error: err.message || 'Unknown error' });
      }
    }

    // 2. Scan attachments with mailbox customer info
    const attachments = await this.prisma.attachment.findMany({
      where: { NOT: { path: { startsWith: 'api-attach:' } } },
      include: {
        message: {
          include: {
            mailbox: true,
          },
        },
      },
    });

    for (const att of attachments) {
      const customer = att.message?.mailbox;
      const accountFolder = getAccountFolderName(customer);
      const cleanName = sanitizeFileName(att.filename || 'attachment');
      
      let relPath = `accounts/${accountFolder}/attachments/${cleanName}`;
      if (usedRelPaths.has(relPath)) {
        relPath = `accounts/${accountFolder}/attachments/${path.parse(cleanName).name}_${att.id.slice(0, 6)}${path.extname(cleanName)}`;
      }
      usedRelPaths.add(relPath);

      const destPath = path.join(this.targetDir, relPath);

      if (manifest.files[relPath] && fs.existsSync(destPath)) {
        result.skippedCount++;
        continue;
      }

      try {
        let buffer: Buffer | null = null;
        
        // Priority 1: Check account attachments key
        if (customer) {
          const attKey = `accounts/${customer.id}/attachments/${path.basename(att.path)}`;
          if (await storage.objectExists(attKey)) {
            buffer = await storage.getObject(attKey);
          }
        }

        // Priority 2: Check legacy storage dir
        if (!buffer) {
          const legacyBase = process.env.STORAGE_DIR || './storage';
          const legacyPath = path.resolve(legacyBase, path.basename(att.path));
          if (fs.existsSync(legacyPath)) {
            buffer = await fs.promises.readFile(legacyPath);
          }
        }

        // Priority 3: Check legacy mailbox attachments key
        if (!buffer && att.message?.mailboxId) {
          const legacyKey = `attachments/${att.message.mailboxId}/${path.basename(att.path)}`;
          if (await storage.objectExists(legacyKey)) {
            buffer = await storage.getObject(legacyKey);
          }
        }

        if (!buffer) {
          result.failedCount++;
          result.errors.push({ path: relPath, error: 'Attachment source file not found' });
          continue;
        }

        if (!dryRun) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          await fs.promises.writeFile(destPath, buffer);
          manifest.files[relPath] = {
            size: buffer.length,
            syncedAt: new Date().toISOString(),
            account: accountFolder,
          };
        }

        result.syncedCount++;
        result.totalBytesCopied += buffer.length;
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({ path: relPath, error: err.message || 'Unknown error' });
      }
    }

    // 3. Scan customer avatars (company logos)
    const customersWithAvatars = await this.prisma.customer.findMany({
      where: { avatarUrl: { not: null } },
    });

    for (const cust of customersWithAvatars) {
      if (!cust.avatarUrl) continue;
      const accountFolder = getAccountFolderName(cust);
      const ext = path.extname(cust.avatarUrl).toLowerCase() || '.png';
      const relPath = `accounts/${accountFolder}/avatar/logo${ext}`;
      const destPath = path.join(this.targetDir, relPath);

      if (manifest.files[relPath] && fs.existsSync(destPath)) {
        result.skippedCount++;
        continue;
      }

      try {
        let buffer: Buffer | null = null;
        if (await storage.objectExists(cust.avatarUrl)) {
          buffer = await storage.getObject(cust.avatarUrl);
        }

        if (!buffer) {
          result.failedCount++;
          result.errors.push({ path: relPath, error: 'Avatar file not found in storage' });
          continue;
        }

        if (!dryRun) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          await fs.promises.writeFile(destPath, buffer);
          manifest.files[relPath] = {
            size: buffer.length,
            syncedAt: new Date().toISOString(),
            account: accountFolder,
          };
        }

        result.syncedCount++;
        result.totalBytesCopied += buffer.length;
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({ path: relPath, error: err.message || 'Unknown error' });
      }
    }

    // 4. Generate account summary metadata for each customer
    const allCustomers = await this.prisma.customer.findMany();
    for (const cust of allCustomers) {
      const accountFolder = getAccountFolderName(cust);
      const infoPath = path.join(this.targetDir, `accounts/${accountFolder}/account-info.json`);

      if (!dryRun) {
        try {
          fs.mkdirSync(path.dirname(infoPath), { recursive: true });
          const infoData = {
            accountId: cust.id,
            companyName: cust.name,
            mailboxAddress: cust.mailboxAddress,
            personalEmail: cust.personalEmail,
            status: cust.status,
            storageQuotaBytes: cust.storageQuota,
            storageQuotaFormatted: `${(cust.storageQuota / (1024 * 1024 * 1024)).toFixed(1)} GB`,
            lastSyncedAt: new Date().toISOString(),
          };
          fs.writeFileSync(infoPath, JSON.stringify(infoData, null, 2), 'utf8');
        } catch (infoErr) {
          console.warn(`Could not write account-info for ${accountFolder}:`, infoErr);
        }
      }
    }

    if (!dryRun) {
      manifest.lastSyncAt = new Date().toISOString();
      this.writeManifest(manifest);
    }

    return result;
  }
}

