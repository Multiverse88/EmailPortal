import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { storage, getStorageRoot } from './storage';
import { getAccountFolderName, sanitizeFileName } from './synology-sync';
import { inferAttachmentMimeType } from './attachments';

const storageBase = process.env.STORAGE_DIR || './storage';
export const STORAGE_DIR = path.isAbsolute(storageBase)
  ? storageBase
  : fs.existsSync(path.resolve(process.cwd(), storageBase))
    ? path.resolve(process.cwd(), storageBase)
    : fs.existsSync(path.resolve(process.cwd(), 'backend', storageBase))
      ? path.resolve(process.cwd(), 'backend', storageBase)
      : path.resolve(__dirname, '../../storage');

fs.mkdirSync(STORAGE_DIR, { recursive: true });

export interface SaveEmailAttachmentOptions {
  prisma: PrismaClient;
  customer: { id: string; name?: string | null; mailboxAddress: string };
  filename: string;
  buffer: Buffer;
  mimeType?: string;
  size?: number;
  subject?: string;
  senderOrRecipient: string;
  isSent?: boolean;
}

/**
 * Saves an attachment to both local storage & S3, mirrors to Synology,
 * and ensures it is auto-saved to Legal Drive under 'Lampiran Email' folder.
 */
export async function saveAttachmentToDriveAndStorage(opts: SaveEmailAttachmentOptions) {
  const {
    prisma,
    customer,
    filename,
    buffer,
    mimeType = inferAttachmentMimeType(filename),
    size = buffer.length,
    subject = '(tanpa subjek)',
    senderOrRecipient,
    isSent = false,
  } = opts;

  const accountFolder = getAccountFolderName(customer);
  const accountAttachmentsDir = path.resolve(STORAGE_DIR, 'accounts', accountFolder, 'attachments');
  fs.mkdirSync(accountAttachmentsDir, { recursive: true });

  const ext = path.extname(filename) || '';
  const safeExt = ext.slice(0, 10).replace(/[^a-zA-Z0-9._-]/g, '');
  const prefix = isSent ? 'sent' : 'att';
  const diskFilename = `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safeExt}`;
  const filePath = path.resolve(accountAttachmentsDir, diskFilename);
  const relPath = `accounts/${accountFolder}/attachments/${diskFilename}`;

  // 1. Write file to permanent disk location
  await fs.promises.writeFile(filePath, buffer);

  // 2. Put to storage adapter (S3 / Local Bucket)
  try {
    await storage.putObject(relPath, buffer, mimeType);
  } catch (storageErr) {
    console.warn(`[DriveSync] S3 / Storage putObject warning for ${relPath}:`, storageErr);
  }

  // 3. Mirror to Synology Drive for cold storage
  try {
    const synologyRelPath = `accounts/${accountFolder}/attachments/${sanitizeFileName(filename)}`;
    void storage.mirrorToSynology(synologyRelPath, buffer);
  } catch (synologyErr) {
    console.warn(`[DriveSync] Synology mirror warning:`, synologyErr);
  }

  // 4. Auto-save to LegalDocument under customer's account in 'Lampiran Email' folder
  let legalDoc = await prisma.legalDocument.findFirst({
    where: {
      customerId: customer.id,
      OR: [
        { path: relPath },
        { filename, size, category: 'Lampiran Email' },
      ],
    },
  });

  if (!legalDoc) {
    const actionLabel = isSent ? 'email keluar' : 'email masuk';
    legalDoc = await prisma.legalDocument.create({
      data: {
        customerId: customer.id,
        title: filename,
        category: 'Lampiran Email',
        filename,
        mimeType,
        size,
        path: relPath,
        status: 'Reviewed',
        ownerName: senderOrRecipient,
        versions: {
          create: [
            {
              versionNumber: 'v1.0',
              authorName: senderOrRecipient,
              approved: true,
              notes: `Otomatis tersimpan dari ${actionLabel}: ${subject}`,
            },
          ],
        },
      },
    });
  }

  return {
    diskFilename,
    relPath,
    filePath,
    legalDoc,
  };
}

/**
 * Scans all Attachment records in the database, checks if they are missing
 * from LegalDocument ('Lampiran Email'), and uploads them to S3 and Legal Drive.
 */
export async function autoSyncExistingAttachmentsToDrive(prisma: PrismaClient): Promise<number> {
  try {
    const attachments = await prisma.attachment.findMany({
      include: {
        message: {
          include: {
            mailbox: true,
          },
        },
      },
      take: 200,
      orderBy: { id: 'desc' },
    });

    let syncedCount = 0;

    for (const att of attachments) {
      if (!att.message || !att.message.mailbox) continue;
      if (att.scanStatus === 'quarantined') continue;

      const customer = att.message.mailbox;
      const accountFolder = getAccountFolderName(customer);

      // Check if already in LegalDocument
      const existingDoc = await prisma.legalDocument.findFirst({
        where: {
          customerId: customer.id,
          OR: [
            { path: att.path },
            { filename: att.filename, size: att.size, category: 'Lampiran Email' },
          ],
        },
      });

      if (existingDoc) continue;

      // Locate buffer from disk or storage adapter
      let buffer: Buffer | null = null;
      const candidates = [
        path.resolve(STORAGE_DIR, att.path),
        path.resolve(STORAGE_DIR, path.basename(att.path)),
        path.resolve(STORAGE_DIR, 'accounts', accountFolder, 'attachments', path.basename(att.path)),
        path.resolve(STORAGE_DIR, 'accounts', customer.id, 'attachments', path.basename(att.path)),
        path.join(getStorageRoot(), att.path),
        path.join(getStorageRoot(), 'accounts', accountFolder, 'attachments', path.basename(att.path)),
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            buffer = await fs.promises.readFile(p);
            break;
          } catch {}
        }
      }

      if (!buffer) {
        try {
          if (await storage.objectExists(att.path)) {
            buffer = await storage.getObject(att.path);
          }
        } catch {}
      }

      if (buffer) {
        // Ensure it's in storage adapter S3
        try {
          await storage.putObject(att.path, buffer, att.mimeType);
        } catch {}

        // Create LegalDocument
        const isSent = att.message.folder === 'Sent';
        const senderOrRecipient = isSent
          ? customer.name || customer.mailboxAddress
          : (att.message.sender || 'Email Masuk');

        await prisma.legalDocument.create({
          data: {
            customerId: customer.id,
            title: att.filename,
            category: 'Lampiran Email',
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size,
            path: att.path,
            status: 'Reviewed',
            ownerName: senderOrRecipient,
            versions: {
              create: [
                {
                  versionNumber: 'v1.0',
                  authorName: senderOrRecipient,
                  approved: true,
                  notes: `Otomatis tersinkronisasi dari ${isSent ? 'email keluar' : 'email masuk'}: ${att.message.subject || '(tanpa subjek)'}`,
                },
              ],
            },
          },
        });

        syncedCount++;
      }
    }

    return syncedCount;
  } catch (error) {
    console.warn('[DriveSync] autoSyncExistingAttachmentsToDrive error:', error);
    return 0;
  }
}
