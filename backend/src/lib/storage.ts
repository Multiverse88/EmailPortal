import 'dotenv/config';
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
  const ainanPath = path.join(home, 'SynologyDrive', 'Data Ainan', 'EmailPortal_ColdStorage');
  if (fs.existsSync(path.join(home, 'SynologyDrive', 'Data Ainan'))) {
    return ainanPath;
  }
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

export function normalizeS3Endpoint(raw?: string): string {
  if (!raw) return 'https://is3.cloudhost.id';
  let trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed.replace(/\/+$/, '');
}

export function getS3ResolvedConfig() {
  const accessKeyId = (
    process.env.S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.S3_KEY_ID ||
    process.env.S3_ACCESS_KEY ||
    process.env.AWS_ACCESS_KEY ||
    ''
  ).trim();

  const secretAccessKey = (
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_KEY ||
    process.env.S3_ACCESS_SECRET ||
    process.env.AWS_SECRET_KEY ||
    ''
  ).trim();

  const bucket = (
    process.env.S3_BUCKET ||
    process.env.AWS_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    process.env.BUCKET_NAME ||
    'emailportal'
  ).trim();

  const endpoint = normalizeS3Endpoint(
    process.env.S3_ENDPOINT ||
    process.env.AWS_ENDPOINT ||
    process.env.AWS_ENDPOINT_URL ||
    process.env.S3_HOST ||
    'https://is3.cloudhost.id'
  );

  const region = (
    process.env.S3_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    'ap-southeast-3'
  ).trim();

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region,
  };
}

export function isS3ConfiguredEnv(): boolean {
  const config = getS3ResolvedConfig();
  return Boolean(config.accessKeyId && config.secretAccessKey);
}

export class S3StorageDriver implements StorageAdapter {
  private s3: AWS.S3;
  private bucket: string;

  constructor() {
    const config = getS3ResolvedConfig();
    this.bucket = config.bucket;
    this.s3 = new AWS.S3({
      endpoint: config.endpoint,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
  }

  getDriver(): 'local' | 's3' {
    return 's3';
  }

  async putObject(key: string, buffer: Buffer, mimeType = 'application/octet-stream'): Promise<string> {
    const cleanKey = key.replace(/^\/+/, '');

    // 1. Always cache locally so local reads are instant and available offline
    try {
      const localPath = path.join(getStorageRoot(), cleanKey);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      await fs.promises.writeFile(localPath, buffer);
    } catch (localErr) {
      console.warn('[S3StorageDriver] Warning saving local disk cache:', localErr);
    }

    // 2. Upload to S3
    try {
      await this.s3
        .upload({
          Bucket: this.bucket,
          Key: cleanKey,
          Body: buffer,
          ContentType: mimeType,
        })
        .promise();
    } catch (s3Err: any) {
      console.error(`[S3StorageDriver] S3 upload failed for ${cleanKey}:`, s3Err?.message || s3Err);
    }

    // 3. Auto-mirror to Synology Drive Client folder if configured (skip tenant keys to allow human-readable account mirroring)
    if (!cleanKey.startsWith('accounts/')) {
      await this.mirrorToSynology(cleanKey, buffer);
    }
    return cleanKey;
  }

  async getObject(key: string): Promise<Buffer> {
    const cleanKey = key.replace(/^\/+/, '');

    // Check local disk cache first
    const localPath = path.join(getStorageRoot(), cleanKey);
    if (fs.existsSync(localPath)) {
      try {
        return await fs.promises.readFile(localPath);
      } catch {}
    }

    const res = await this.s3
      .getObject({
        Bucket: this.bucket,
        Key: cleanKey,
      })
      .promise();

    const buf = res.Body as Buffer;
    // Populate local cache
    try {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      await fs.promises.writeFile(localPath, buf);
    } catch {}

    return buf;
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    const cleanKey = key.replace(/^\/+/, '');

    const localPath = path.join(getStorageRoot(), cleanKey);
    if (fs.existsSync(localPath)) {
      return fs.createReadStream(localPath);
    }

    return this.s3
      .getObject({
        Bucket: this.bucket,
        Key: cleanKey,
      })
      .createReadStream();
  }

  async deleteObject(key: string): Promise<void> {
    const cleanKey = key.replace(/^\/+/, '');
    const localPath = path.join(getStorageRoot(), cleanKey);
    if (fs.existsSync(localPath)) {
      try { await fs.promises.unlink(localPath); } catch {}
    }

    try {
      await this.s3
        .deleteObject({
          Bucket: this.bucket,
          Key: cleanKey,
        })
        .promise();
    } catch {}
  }

  async objectExists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\/+/, '');
    const localPath = path.join(getStorageRoot(), cleanKey);
    if (fs.existsSync(localPath)) {
      return true;
    }

    try {
      await this.s3
        .headObject({
          Bucket: this.bucket,
          Key: cleanKey,
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

export { LocalStorageDriver };

const driverEnv = (process.env.STORAGE_DRIVER || '').trim().toLowerCase();
const isConfigured = isS3ConfiguredEnv();
// If driver explicitly set to 's3', OR S3 credentials exist and driver is NOT explicitly 'local', use S3
const shouldUseS3 = driverEnv === 's3' || (isConfigured && driverEnv !== 'local');

export const storage: StorageAdapter = shouldUseS3
  ? new S3StorageDriver()
  : new LocalStorageDriver();

if (shouldUseS3) {
  const cfg = getS3ResolvedConfig();
  console.log(`✓ Storage Driver: Cloud S3 Active (Bucket: "${cfg.bucket}", Endpoint: ${cfg.endpoint})`);
} else {
  console.log(`ℹ Storage Driver: Local Storage Active (${getStorageRoot()})`);
}

