# Backend Storage Setup & Synology Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular storage adapter (supporting local emulated S3 bucket & production S3), an automated/on-demand Synology Drive Client mirror and sync service, admin API endpoints, CLI runner, and integration into document management with 90-day cold storage detection.

**Architecture:** A unified storage abstraction (`storage.ts`) encapsulates local filesystem and AWS S3 drivers. A synchronization service (`synology-sync.ts`) mirrors files to `SYNOLOGY_DIR` (`~/SynologyDrive/EmailPortal_ColdStorage`) with `.sync-manifest.json` tracking. Admin routes (`/api/storage/*`) and a CLI script allow monitoring and triggering synchronization. Document routes leverage the adapter and flag files older than 90 days.

**Tech Stack:** Node.js, Express, TypeScript, Prisma (SQLite), AWS SDK v2, Jest, Supertest.

## Global Constraints

- STORAGE_DRIVER defaults to 'local' for development, switchable to 's3'.
- SYNOLOGY_DIR default is `/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage`.
- Local bucket storage directory structure is `backend/storage/buckets/{S3_BUCKET}/`.
- Cold storage retention boundary is 90 days (`Date.now() - 90 * 24 * 60 * 60 * 1000`).
- No external unmocked network calls during automated test suites.
- All existing tests in `backend/tests/` must continue to pass.

---

### Task 1: Environment Variables & Storage Configuration

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: Environment variables `STORAGE_DRIVER` (`local` | `s3`) and `SYNOLOGY_DIR` (`/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage`).

- [ ] **Step 1: Update `backend/.env` with storage driver and Synology directory**

Add `STORAGE_DRIVER=local` and `SYNOLOGY_DIR` to `backend/.env`:
```bash
# Storage Driver ('local' | 's3')
STORAGE_DRIVER=local
SYNOLOGY_DIR=/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage
```

- [ ] **Step 2: Update `backend/.env.example` with documented keys**

Ensure `.env.example` documents `STORAGE_DRIVER` and `SYNOLOGY_DIR`.

- [ ] **Step 3: Commit environment configuration updates**

```bash
git add backend/.env.example
git commit -m "chore: add STORAGE_DRIVER and SYNOLOGY_DIR to environment templates"
```

---

### Task 2: Unified Storage Adapter (`backend/src/lib/storage.ts`)

**Files:**
- Create: `backend/src/lib/storage.ts`
- Test: `backend/tests/storage-adapter.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface StorageAdapter {
    putObject(key: string, buffer: Buffer, mimeType?: string): Promise<string>;
    getObject(key: string): Promise<Buffer>;
    getObjectStream(key: string): Promise<NodeJS.ReadableStream>;
    deleteObject(key: string): Promise<void>;
    objectExists(key: string): Promise<boolean>;
    getDriver(): 'local' | 's3';
    mirrorToSynology(relPath: string, buffer: Buffer): Promise<boolean>;
  }
  export const storage: StorageAdapter;
  export function getStorageRoot(): string;
  export function getSynologyDir(): string;
  ```

- [ ] **Step 1: Write failing unit test for StorageAdapter**

Create `backend/tests/storage-adapter.test.ts`:
```typescript
import fs from 'node:fs';
import path from 'node:path';
import { storage, getStorageRoot, getSynologyDir } from '../src/lib/storage';

describe('StorageAdapter (Local Driver)', () => {
  const testKey = 'test/documents/sample.txt';
  const testContent = Buffer.from('Testing storage adapter content');

  afterAll(() => {
    try {
      const fullPath = path.join(getStorageRoot(), testKey);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {
      // ignore cleanup errors
    }
  });

  it('stores and retrieves object with local driver', async () => {
    const key = await storage.putObject(testKey, testContent, 'text/plain');
    expect(key).toBe(testKey);

    const exists = await storage.objectExists(testKey);
    expect(exists).toBe(true);

    const data = await storage.getObject(testKey);
    expect(data.toString()).toBe('Testing storage adapter content');
  });

  it('deletes object correctly', async () => {
    await storage.deleteObject(testKey);
    const exists = await storage.objectExists(testKey);
    expect(exists).toBe(false);
  });

  it('mirrors file to Synology directory if configured', async () => {
    const mirrorPath = 'documents/sample-mirror.txt';
    const mirrored = await storage.mirrorToSynology(mirrorPath, testContent);
    expect(typeof mirrored).toBe('boolean');

    if (mirrored) {
      const synologyFile = path.join(getSynologyDir(), mirrorPath);
      expect(fs.existsSync(synologyFile)).toBe(true);
      expect(fs.readFileSync(synologyFile).toString()).toBe('Testing storage adapter content');
      fs.unlinkSync(synologyFile);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/storage-adapter.test.ts`
Expected: FAIL ("Cannot find module '../src/lib/storage'")

- [ ] **Step 3: Implement `backend/src/lib/storage.ts`**

Create `backend/src/lib/storage.ts`:
```typescript
import fs from 'node:fs';
import path from 'node:path';
import AWS from 'aws-sdk';

export interface StorageAdapter {
  putObject(key: string, buffer: Buffer, mimeType?: string): Promise<string>;
  getObject(key: string): Promise<Buffer>;
  getObjectStream(key: string): Promise<NodeJS.ReadableStream>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  getDriver(): 'local' | 's3';
  mirrorToSynology(relPath: string, buffer: Buffer): Promise<boolean>;
}

export function getSynologyDir(): string {
  const custom = process.env.SYNOLOGY_DIR;
  if (custom) return path.resolve(custom);
  const home = process.env.HOME || process.env.USERPROFILE || '/home/fullstackiteasylegal';
  return path.join(home, 'SynologyDrive', 'EmailPortal_ColdStorage');
}

export function getStorageRoot(): string {
  const base = process.env.STORAGE_DIR || './storage';
  const bucket = process.env.S3_BUCKET || 'emailportal';
  const resolvedBase = path.isAbsolute(base) ? base : path.resolve(process.cwd(), base);
  return path.join(resolvedBase, 'buckets', bucket);
}

class LocalStorageDriver implements StorageAdapter {
  private rootDir: string;

  constructor() {
    this.rootDir = getStorageRoot();
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  getDriver(): 'local' | 's3' {
    return 'local';
  }

  private resolvePath(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    return path.join(this.rootDir, cleanKey);
  }

  async putObject(key: string, buffer: Buffer, _mimeType?: string): Promise<string> {
    const fullPath = this.resolvePath(key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
    return key;
  }

  async getObject(key: string): Promise<Buffer> {
    const fullPath = this.resolvePath(key);
    return fs.promises.readFile(fullPath);
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    const fullPath = this.resolvePath(key);
    return fs.createReadStream(fullPath);
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    const fullPath = this.resolvePath(key);
    return fs.existsSync(fullPath);
  }

  async mirrorToSynology(relPath: string, buffer: Buffer): Promise<boolean> {
    try {
      const synologyDir = getSynologyDir();
      const targetPath = path.join(synologyDir, relPath.replace(/^\/+/, ''));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, buffer);
      return true;
    } catch (error) {
      console.warn('Failed to mirror file to Synology Drive:', error);
      return false;
    }
  }
}

class S3StorageDriver implements StorageAdapter {
  private s3: AWS.S3;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'emailportal';
    this.s3 = new AWS.S3({
      endpoint: process.env.S3_ENDPOINT || 'https://is3.cloudhost.id',
      region: process.env.S3_REGION || 'ap-southeast-3',
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
  }

  getDriver(): 'local' | 's3' {
    return 's3';
  }

  async putObject(key: string, buffer: Buffer, mimeType = 'application/octet-stream'): Promise<string> {
    await this.s3
      .upload({
        Bucket: this.bucket,
        Key: key.replace(/^\/+/, ''),
        Body: buffer,
        ContentType: mimeType,
      })
      .promise();
    return key;
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.s3
      .getObject({
        Bucket: this.bucket,
        Key: key.replace(/^\/+/, ''),
      })
      .promise();
    return res.Body as Buffer;
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    return this.s3
      .getObject({
        Bucket: this.bucket,
        Key: key.replace(/^\/+/, ''),
      })
      .createReadStream();
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: key.replace(/^\/+/, ''),
      })
      .promise();
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucket,
          Key: key.replace(/^\/+/, ''),
        })
        .promise();
      return true;
    } catch {
      return false;
    }
  }

  async mirrorToSynology(relPath: string, buffer: Buffer): Promise<boolean> {
    try {
      const synologyDir = getSynologyDir();
      const targetPath = path.join(synologyDir, relPath.replace(/^\/+/, ''));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, buffer);
      return true;
    } catch (error) {
      console.warn('Failed to mirror file to Synology Drive:', error);
      return false;
    }
  }
}

const driverType = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const isS3Configured = Boolean(
  process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
);

export const storage: StorageAdapter =
  driverType === 's3' && isS3Configured
    ? new S3StorageDriver()
    : new LocalStorageDriver();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/storage-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/storage.ts backend/tests/storage-adapter.test.ts
git commit -m "feat(storage): create unified storage adapter with local and s3 drivers"
```

---

### Task 3: Synology Synchronization Service (`backend/src/lib/synology-sync.ts`)

**Files:**
- Create: `backend/src/lib/synology-sync.ts`
- Test: `backend/tests/synology-sync.test.ts`

**Interfaces:**
- Produces:
  ```typescript
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

  export class SynologySyncService {
    constructor(prisma: PrismaClient);
    getStatus(): Promise<SynologyStatus>;
    sync(options?: { dryRun?: boolean }): Promise<SynologySyncResult>;
    initTargetFolder(): boolean;
  }
  ```

- [ ] **Step 1: Write unit test for `SynologySyncService`**

Create `backend/tests/synology-sync.test.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { SynologySyncService } from '../src/lib/synology-sync';
import { getSynologyDir } from '../src/lib/storage';

const prisma = new PrismaClient();

describe('SynologySyncService', () => {
  const service = new SynologySyncService(prisma);
  const targetDir = getSynologyDir();

  beforeAll(async () => {
    service.initTargetFolder();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/synology-sync.test.ts`
Expected: FAIL ("Cannot find module '../src/lib/synology-sync'")

- [ ] **Step 3: Implement `backend/src/lib/synology-sync.ts`**

Create `backend/src/lib/synology-sync.ts`:
```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/synology-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/synology-sync.ts backend/tests/synology-sync.test.ts
git commit -m "feat(storage): create synology sync service with manifest tracking"
```

---

### Task 4: Storage Admin Routes & App Mounting

**Files:**
- Create: `backend/src/routes/storage.ts`
- Modify: `backend/src/app.ts:16-52`
- Test: `backend/tests/storage-routes.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/storage/synology-status` (Admin only)
  - `POST /api/storage/sync-synology` (Admin only)
  - `POST /api/storage/init-synology-folder` (Admin only)

- [ ] **Step 1: Write integration tests for storage admin routes**

Create `backend/tests/storage-routes.test.ts`:
```typescript
import request from 'supertest';
import app, { prisma } from '../src/app';
import jwt from 'jsonwebtoken';

describe('Storage Admin Routes (/api/storage)', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.adminUser.findFirst();
    const adminId = admin ? admin.id : 'admin-test-id';
    adminToken = jwt.sign(
      { id: adminId, email: 'admin@clienteasylegal.co.id', role: 'SUPER_ADMIN' },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '1h' }
    );
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/storage/synology-status');
    expect(res.status).toBe(401);
  });

  it('returns synology status for admin', async () => {
    const res = await request(app)
      .get('/api/storage/synology-status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isAvailable');
    expect(res.body).toHaveProperty('targetPath');
    expect(res.body).toHaveProperty('totalSyncedFiles');
  });

  it('triggers sync via POST /api/storage/sync-synology', async () => {
    const res = await request(app)
      .post('/api/storage/sync-synology')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('syncedCount');
    expect(res.body).toHaveProperty('skippedCount');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/storage-routes.test.ts`
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Implement `backend/src/routes/storage.ts`**

Create `backend/src/routes/storage.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../lib/synology-sync';

export default (prisma: PrismaClient) => {
  const router = Router();
  const syncService = new SynologySyncService(prisma);

  // GET /api/storage/synology-status
  router.get('/synology-status', async (_req: Request, res: Response) => {
    try {
      const status = await syncService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Synology status error:', error);
      res.status(500).json({ error: 'Gagal memeriksa status Synology Drive' });
    }
  });

  // POST /api/storage/sync-synology
  router.post('/sync-synology', async (req: Request, res: Response) => {
    try {
      const dryRun = Boolean(req.body?.dryRun);
      const result = await syncService.sync({ dryRun });
      res.json(result);
    } catch (error) {
      console.error('Synology sync error:', error);
      res.status(500).json({ error: 'Gagal menyinkronkan data ke Synology Drive' });
    }
  });

  // POST /api/storage/init-synology-folder
  router.post('/init-synology-folder', async (_req: Request, res: Response) => {
    try {
      const success = syncService.initTargetFolder();
      const status = await syncService.getStatus();
      res.json({ success, status });
    } catch (error) {
      console.error('Init folder error:', error);
      res.status(500).json({ error: 'Gagal menginisialisasi folder Synology' });
    }
  });

  return router;
};
```

- [ ] **Step 4: Mount storage routes in `backend/src/app.ts`**

Import `storageRoutes` from `./routes/storage` and mount:
```typescript
app.use('/api/storage', authenticateAdmin, storageRoutes(prisma));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/storage-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/storage.ts backend/src/app.ts backend/tests/storage-routes.test.ts
git commit -m "feat(storage): mount /api/storage admin routes with synology sync endpoints"
```

---

### Task 5: Storage Adapter Integration in Documents Route & Cold Storage Age Detection

**Files:**
- Modify: `backend/src/routes/documents.ts`
- Modify: `backend/tests/documents-support.test.ts`

**Interfaces:**
- Consumes: `storage` from `backend/src/lib/storage.ts`
- Produces:
  - Document objects include `isColdStorage: boolean` computed by `(Date.now() - createdAt.getTime()) > 90 * 24 * 60 * 60 * 1000`.
  - When uploading, writes to `storage.putObject` and `storage.mirrorToSynology`.
  - When downloading, checks cold storage. If older than 90 days and missing in hot storage, returns status 404 with `{ error: 'Berkas telah diarsipkan ke Cold Storage', isColdStorage: true }`.

- [ ] **Step 1: Write test assertion for 90-day cold storage flag**

Update `backend/tests/documents-support.test.ts` to assert that documents returned by `GET /api/documents` include `isColdStorage: false` for recent documents and `isColdStorage: true` for documents older than 90 days.

- [ ] **Step 2: Update `backend/src/routes/documents.ts`**

1. Import `storage` from `../lib/storage`.
2. Compute `isColdStorage: boolean` on listed documents and document detail:
   `const isColdStorage = (Date.now() - new Date(doc.createdAt).getTime()) > 90 * 24 * 60 * 60 * 1000;`
3. In `POST /upload`:
   - Read uploaded file buffer.
   - Store into `storage.putObject(`documents/${customerId}/${file.filename}`, fileBuffer, file.mimetype)`.
   - Call `storage.mirrorToSynology(`documents/${customerId}/${file.filename}`, fileBuffer)`.
4. In `GET /:id/download`:
   - Check if document is cold storage (`> 90 days`).
   - If hot file exists via `storage.objectExists` or disk, stream file to client.
   - If missing from hot storage, return status 404 with `{ error: 'Berkas telah diarsipkan ke Cold Storage (> 3 Bulan)', isColdStorage: true }`.

- [ ] **Step 3: Run documents tests**

Run: `npx jest tests/documents-support.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/documents.ts backend/tests/documents-support.test.ts
git commit -m "feat(documents): integrate storage adapter and 90-day cold storage detection"
```

---

### Task 6: CLI Runner for Synology Synchronization

**Files:**
- Create: `backend/scripts/sync-synology.ts`
- Modify: `backend/package.json`
- Modify: `package.json`

**Interfaces:**
- Produces: Command `npm run storage:sync-synology` and `npm run storage:sync-synology -- --dry-run`.

- [ ] **Step 1: Implement `backend/scripts/sync-synology.ts`**

```typescript
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
```

- [ ] **Step 2: Add scripts to `backend/package.json` and root `package.json`**

In `backend/package.json`:
`"storage:sync-synology": "tsx scripts/sync-synology.ts"`

In root `package.json`:
`"storage:sync-synology": "cd backend && npm run storage:sync-synology"`

- [ ] **Step 3: Test running the CLI script with dry run**

Run: `npm run storage:sync-synology -- --dry-run`
Expected: Output showing Synology status and sync statistics with exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/sync-synology.ts backend/package.json package.json
git commit -m "feat(storage): add CLI runner script for synology synchronization"
```

---

### Task 7: Full System Verification & Regression Tests

**Files:**
- Test all suites: `npm run test:backend` and `npm run build:backend`

- [ ] **Step 1: Run all backend tests**

Run: `npm run test:backend`
Expected: All test suites PASS (schema, security-settings, documents-support, storage-adapter, synology-sync, storage-routes).

- [ ] **Step 2: Run TypeScript build**

Run: `npm run build:backend`
Expected: Clean build without type errors.

- [ ] **Step 3: Final commit and summary**

```bash
git add .
git commit -m "feat(storage): complete backend storage setup with synology client sync bridge"
```
