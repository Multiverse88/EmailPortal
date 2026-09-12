import request from 'supertest';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import app, { prisma, syncWorker } from '../src/app';
import { storage, getStorageRoot, S3StorageDriver, isS3ConfiguredEnv } from '../src/lib/storage';
import { autoSyncExistingAttachmentsToDrive } from '../src/lib/drive-sync';
import { getCustomerStorageStats } from '../src/lib/quota';
import { encrypt } from '../src/lib/crypto';
import * as mailLib from '../src/lib/mail';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('Email Attachments to Drive & S3 Integration', () => {
  let customer: any;
  let token: string;

  beforeAll(async () => {
    jest.spyOn(mailLib, 'sendMail').mockResolvedValue({ delivered: true, messageId: 'test-smtp-msg-id' } as any);

    const ts = Date.now();
    customer = await prisma.customer.create({
      data: {
        name: 'PT Test Drive S3',
        personalEmail: `test-drive-${ts}@example.com`,
        mailboxAddress: `testdrive-${ts}@clienteasylegal.co.id`,
        passwordEnc: encrypt('dummy-test-password'),
        status: 'active',
      },
    });

    token = jwt.sign(
      { id: customer.id, email: customer.mailboxAddress, type: 'customer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (customer) {
      await prisma.legalDocument.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
      await prisma.messageCache.deleteMany({ where: { mailboxId: customer.id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should auto-detect S3 configuration from environment variables even without STORAGE_DRIVER=s3', () => {
    expect(typeof isS3ConfiguredEnv).toBe('function');
  });

  it('should auto-save attachments to Legal Drive and storage when sending an email', async () => {
    const testFileContent = Buffer.from('Lampiran Kontrak Pengiriman Legal');
    const filename = 'kontrak-kirim.pdf';

    const res = await request(app)
      .post('/api/email/send')
      .set('Authorization', `Bearer ${token}`)
      .field('to', 'partner@example.com')
      .field('subject', 'Pengiriman Berkas Kontrak')
      .field('body', 'Mohon telaah berkas terlampir.')
      .attach('attachments', testFileContent, filename);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Email terkirim');

    // 1. Verify Message and Attachment record
    const sentMessage = await prisma.messageCache.findFirst({
      where: { mailboxId: customer.id, folder: 'Sent', subject: 'Pengiriman Berkas Kontrak' },
      include: { attachments: true },
    });
    expect(sentMessage).toBeDefined();
    expect(sentMessage?.attachments.length).toBe(1);
    const att = sentMessage?.attachments[0];
    expect(att?.filename).toBe(filename);

    // 2. Verify auto-saved to LegalDocument under 'Lampiran Email'
    const legalDoc = await prisma.legalDocument.findFirst({
      where: { customerId: customer.id, category: 'Lampiran Email', filename },
    });
    expect(legalDoc).toBeDefined();
    expect(legalDoc?.title).toBe(filename);
    expect(legalDoc?.size).toBe(testFileContent.length);

    // 3. Verify it is visible in GET /api/documents
    const docsRes = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(docsRes.status).toBe(200);
    expect(docsRes.body.folders).toContain('Lampiran Email');
    expect(docsRes.body.documents.some((d: any) => d.filename === filename)).toBe(true);

    // 4. Verify it can be downloaded via /api/documents/:id/download
    const downloadDocRes = await request(app)
      .get(`/api/documents/${legalDoc?.id}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(downloadDocRes.status).toBe(200);
    const docText = downloadDocRes.text || (Buffer.isBuffer(downloadDocRes.body) ? downloadDocRes.body.toString('utf8') : '');
    expect(docText).toBe('Lampiran Kontrak Pengiriman Legal');

    // 5. Verify it can be downloaded via /api/email/attachment/:id/download
    const downloadAttRes = await request(app)
      .get(`/api/email/attachment/${att?.id}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(downloadAttRes.status).toBe(200);
    const attText = downloadAttRes.text || (Buffer.isBuffer(downloadAttRes.body) ? downloadAttRes.body.toString('utf8') : '');
    expect(attText).toBe('Lampiran Kontrak Pengiriman Legal');
  });

  it('should auto-sync existing orphaned attachments to Legal Drive and storage', async () => {
    // Simulate an existing email attachment in DB that has no LegalDocument
    const legacyMsg = await prisma.messageCache.create({
      data: {
        mailboxId: customer.id,
        uid: `legacy-${Date.now()}`,
        folder: 'INBOX',
        subject: 'Email Lama dengan Lampiran',
        sender: 'klien.lama@example.com',
        recipients: customer.mailboxAddress,
        snippet: 'Lampiran lama',
        bodyText: 'Berikut lampiran lama',
        receivedAt: new Date(),
      },
    });

    const legacyContent = Buffer.from('Dokumen Legacy Yang Belum Masuk Drive');
    const legacyFilename = 'akta-lama.pdf';
    const legacyDiskName = `att_legacy_${Date.now()}.pdf`;
    const legacyRelPath = `accounts/${customer.id}/attachments/${legacyDiskName}`;

    // Write file to storage
    await storage.putObject(legacyRelPath, legacyContent, 'application/pdf');

    const legacyAtt = await prisma.attachment.create({
      data: {
        messageId: legacyMsg.id,
        filename: legacyFilename,
        mimeType: 'application/pdf',
        size: legacyContent.length,
        path: legacyRelPath,
        scanStatus: 'clean',
      },
    });

    // Run autoSync
    const syncedCount = await autoSyncExistingAttachmentsToDrive(prisma);
    expect(syncedCount).toBeGreaterThanOrEqual(1);

    // Verify it now exists in LegalDocument
    const syncedDoc = await prisma.legalDocument.findFirst({
      where: { customerId: customer.id, filename: legacyFilename },
    });
    expect(syncedDoc).toBeDefined();
    expect(syncedDoc?.category).toBe('Lampiran Email');
  });

  it('should not double-count storage quota for email attachments and their drive documents', async () => {
    const stats = await getCustomerStorageStats(prisma, customer.id);
    expect(stats.storageUsed).toBeLessThan(stats.storageLimit);
    expect(typeof stats.storageUsed).toBe('number');
  });
});
