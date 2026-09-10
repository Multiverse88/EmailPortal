import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { getSynologyDir, storage } from './storage';

export interface SynologyExportFile {
  id: string;
  type: 'document' | 'attachment' | 'avatar';
  accountFolder: string;
  relPath: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface SynologyExportAccount {
  accountFolder: string;
  info: {
    accountId: string;
    companyName: string;
    mailboxAddress: string;
    personalEmail: string;
    status: string;
    storageQuotaBytes: number;
    storageQuotaFormatted: string;
    lastSyncedAt: string;
  };
}

export interface SynologyExportManifest {
  generatedAt: string;
  accounts: SynologyExportAccount[];
  files: SynologyExportFile[];
}

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

  async generateExportManifest(): Promise<SynologyExportManifest> {
    const usedRelPaths = new Set<string>();
    const files: SynologyExportFile[] = [];

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

      files.push({
        id: doc.id,
        type: 'document',
        accountFolder,
        relPath,
        filename: cleanName,
        size: doc.size || 0,
        mimeType: doc.mimeType || 'application/pdf',
      });
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

      files.push({
        id: att.id,
        type: 'attachment',
        accountFolder,
        relPath,
        filename: cleanName,
        size: att.size || 0,
        mimeType: att.mimeType || 'application/octet-stream',
      });
    }

    // 3. Scan customer avatars
    const customersWithAvatars = await this.prisma.customer.findMany({
      where: { avatarUrl: { not: null } },
    });

    for (const cust of customersWithAvatars) {
      if (!cust.avatarUrl) continue;
      const accountFolder = getAccountFolderName(cust);
      const ext = path.extname(cust.avatarUrl).toLowerCase() || '.png';
      const relPath = `accounts/${accountFolder}/avatar/logo${ext}`;

      files.push({
        id: cust.id,
        type: 'avatar',
        accountFolder,
        relPath,
        filename: `logo${ext}`,
        size: 0,
        mimeType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png',
      });
    }

    // 4. Accounts metadata
    const allCustomers = await this.prisma.customer.findMany();
    const accounts: SynologyExportAccount[] = allCustomers.map((cust) => {
      const accountFolder = getAccountFolderName(cust);
      const quota = cust.storageQuota || 5368709120;
      return {
        accountFolder,
        info: {
          accountId: cust.id,
          companyName: cust.name,
          mailboxAddress: cust.mailboxAddress,
          personalEmail: cust.personalEmail,
          status: cust.status,
          storageQuotaBytes: quota,
          storageQuotaFormatted: `${(quota / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          lastSyncedAt: new Date().toISOString(),
        },
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      accounts,
      files,
    };
  }

  async getFileData(
    type: 'document' | 'attachment' | 'avatar',
    id: string
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string; size: number } | null> {
    if (type === 'document') {
      const doc = await this.prisma.legalDocument.findUnique({
        where: { id },
        include: { customer: true },
      });
      if (!doc) return null;

      const cleanName = sanitizeFileName(doc.filename || doc.title || 'document.pdf');
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

      // Priority 5: Check direct path
      if (!buffer && fs.existsSync(doc.path)) {
        buffer = await fs.promises.readFile(doc.path);
      }

      if (!buffer) return null;
      return {
        buffer,
        filename: cleanName,
        mimeType: doc.mimeType || 'application/pdf',
        size: buffer.length,
      };
    }

    if (type === 'attachment') {
      const att = await this.prisma.attachment.findUnique({
        where: { id },
        include: {
          message: {
            include: {
              mailbox: true,
            },
          },
        },
      });
      if (!att) return null;

      const customer = att.message?.mailbox;
      const cleanName = sanitizeFileName(att.filename || 'attachment');
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

      // Priority 4: Check direct path
      if (!buffer && fs.existsSync(att.path)) {
        buffer = await fs.promises.readFile(att.path);
      }

      if (!buffer) return null;
      return {
        buffer,
        filename: cleanName,
        mimeType: att.mimeType || 'application/octet-stream',
        size: buffer.length,
      };
    }

    if (type === 'avatar') {
      const cust = await this.prisma.customer.findUnique({
        where: { id },
      });
      if (!cust || !cust.avatarUrl) return null;

      const ext = path.extname(cust.avatarUrl).toLowerCase() || '.png';
      let buffer: Buffer | null = null;

      if (await storage.objectExists(cust.avatarUrl)) {
        buffer = await storage.getObject(cust.avatarUrl);
      }

      if (!buffer) {
        const legacyBase = process.env.STORAGE_DIR || './storage';
        const legacyPath = path.resolve(legacyBase, path.basename(cust.avatarUrl));
        if (fs.existsSync(legacyPath)) {
          buffer = await fs.promises.readFile(legacyPath);
        }
      }

      if (!buffer && fs.existsSync(cust.avatarUrl)) {
        buffer = await fs.promises.readFile(cust.avatarUrl);
      }

      if (!buffer) return null;
      return {
        buffer,
        filename: `logo${ext}`,
        mimeType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png',
        size: buffer.length,
      };
    }

    return null;
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

    const exportManifest = await this.generateExportManifest();

    // 1. Write account-info.json for all accounts
    if (!dryRun) {
      for (const acc of exportManifest.accounts) {
        try {
          const infoPath = path.join(this.targetDir, `accounts/${acc.accountFolder}/account-info.json`);
          fs.mkdirSync(path.dirname(infoPath), { recursive: true });
          fs.writeFileSync(infoPath, JSON.stringify(acc.info, null, 2), 'utf8');
        } catch (infoErr: any) {
          console.warn(`Could not write account-info for ${acc.accountFolder}:`, infoErr.message);
        }
      }
    }

    // 2. Sync files
    for (const file of exportManifest.files) {
      const destPath = path.join(this.targetDir, file.relPath);

      if (manifest.files[file.relPath] && fs.existsSync(destPath)) {
        result.skippedCount++;
        continue;
      }

      try {
        const fileData = await this.getFileData(file.type, file.id);
        if (!fileData) {
          result.failedCount++;
          result.errors.push({ path: file.relPath, error: 'Source file not found in storage' });
          continue;
        }

        if (!dryRun) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          await fs.promises.writeFile(destPath, fileData.buffer);
          manifest.files[file.relPath] = {
            size: fileData.buffer.length,
            syncedAt: new Date().toISOString(),
            account: file.accountFolder,
            docId: file.id,
          };
        }

        result.syncedCount++;
        result.totalBytesCopied += fileData.buffer.length;
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({ path: file.relPath, error: err.message || 'Unknown error' });
      }
    }

    if (!dryRun) {
      manifest.lastSyncAt = new Date().toISOString();
      this.writeManifest(manifest);
    }

    return result;
  }
}

