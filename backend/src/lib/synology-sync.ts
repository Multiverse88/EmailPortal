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
  files: Record<string, { size: number; syncedAt: string }>;
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

    const [totalDocs, totalAttachments] = await Promise.all([
      this.prisma.legalDocument.count(),
      this.prisma.attachment.count({
        where: { NOT: { path: { startsWith: 'api-attach:' } } },
      }),
    ]);

    const totalRecords = totalDocs + totalAttachments;
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

    // 1. Scan legal documents
    const documents = await this.prisma.legalDocument.findMany();
    for (const doc of documents) {
      const relPath = `documents/${doc.customerId}/${doc.id}_${path.basename(doc.filename)}`;
      const destPath = path.join(this.targetDir, relPath);

      if (manifest.files[relPath] && fs.existsSync(destPath)) {
        result.skippedCount++;
        continue;
      }

      try {
        let buffer: Buffer | null = null;
        // Check new local bucket structure
        const bucketKey = `documents/${doc.customerId}/${path.basename(doc.path)}`;
        if (await storage.objectExists(bucketKey)) {
          buffer = await storage.getObject(bucketKey);
        } else {
          // Check legacy storage dir
          const legacyBase = process.env.STORAGE_DIR || './storage';
          const legacyPath = path.resolve(legacyBase, path.basename(doc.path));
          if (fs.existsSync(legacyPath)) {
            buffer = await fs.promises.readFile(legacyPath);
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
          };
        }

        result.syncedCount++;
        result.totalBytesCopied += buffer.length;
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({ path: relPath, error: err.message || 'Unknown error' });
      }
    }

    // 2. Scan attachments
    const attachments = await this.prisma.attachment.findMany({
      where: { NOT: { path: { startsWith: 'api-attach:' } } },
      include: { message: true },
    });

    for (const att of attachments) {
      const relPath = `attachments/${att.message?.mailboxId || 'general'}/${att.id}_${path.basename(att.filename)}`;
      const destPath = path.join(this.targetDir, relPath);

      if (manifest.files[relPath] && fs.existsSync(destPath)) {
        result.skippedCount++;
        continue;
      }

      try {
        let buffer: Buffer | null = null;
        const legacyBase = process.env.STORAGE_DIR || './storage';
        const legacyPath = path.resolve(legacyBase, path.basename(att.path));
        if (fs.existsSync(legacyPath)) {
          buffer = await fs.promises.readFile(legacyPath);
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
          };
        }

        result.syncedCount++;
        result.totalBytesCopied += buffer.length;
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({ path: relPath, error: err.message || 'Unknown error' });
      }
    }

    if (!dryRun) {
      manifest.lastSyncAt = new Date().toISOString();
      this.writeManifest(manifest);
    }

    return result;
  }
}
