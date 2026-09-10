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

    // Auto-mirror to Synology Drive Client folder if configured (skip tenant keys to allow human-readable account mirroring)
    if (!key.startsWith('accounts/')) {
      await this.mirrorToSynology(key, buffer);
    }
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
