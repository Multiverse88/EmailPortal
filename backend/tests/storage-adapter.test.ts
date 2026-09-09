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
