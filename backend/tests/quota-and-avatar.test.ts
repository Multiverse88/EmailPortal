import request from 'supertest';
import app, { prisma } from '../src/app';
import jwt from 'jsonwebtoken';
import { storage } from '../src/lib/storage';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('Quota Enforcement & Account Isolated Storage (TDD)', () => {
  let customerA: any;
  let tokenA: string;
  let customerB: any;
  let tokenB: string;

  beforeAll(async () => {
    const ts = Date.now();
    customerA = await prisma.customer.create({
      data: {
        name: 'Perusahaan A',
        personalEmail: `perusahaana-${ts}@example.com`,
        mailboxAddress: `perusahaana-${ts}@clienteasylegal.co.id`,
        passwordEnc: 'dummy-pw-a',
        status: 'active',
        storageQuota: 5 * 1024 * 1024 * 1024, // 5 GB
      },
    });

    customerB = await prisma.customer.create({
      data: {
        name: 'Perusahaan B',
        personalEmail: `perusahaanb-${ts}@example.com`,
        mailboxAddress: `perusahaanb-${ts}@clienteasylegal.co.id`,
        passwordEnc: 'dummy-pw-b',
        status: 'active',
        storageQuota: 5 * 1024 * 1024 * 1024, // 5 GB
      },
    });

    tokenA = jwt.sign(
      { id: customerA.id, email: customerA.mailboxAddress, type: 'customer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    tokenB = jwt.sign(
      { id: customerB.id, email: customerB.mailboxAddress, type: 'customer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    try {
      await prisma.legalDocument.deleteMany({
        where: { customerId: { in: [customerA.id, customerB.id] } },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: [customerA.id, customerB.id] } },
      });
      await prisma.$disconnect();
    } catch {}
  });

  describe('Company Logo / Avatar Isolation', () => {
    it('uploads company logo to isolated storage path accounts/{customerId}/avatar/', async () => {
      const dummyPng = Buffer.from('fake-png-data');
      const res = await request(app)
        .post('/api/settings/avatar')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('avatar', dummyPng, 'logo_perusahaan.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.avatarUrl).toContain('/api/settings/avatar');

      // Verify in DB that avatarUrl uses the accounts/{customerId}/avatar/ prefix
      const updatedCust = await prisma.customer.findUnique({ where: { id: customerA.id } });
      expect(updatedCust?.avatarUrl).toMatch(new RegExp(`^accounts/${customerA.id}/avatar/logo_`));

      // Verify file exists in storage adapter
      const exists = await storage.objectExists(updatedCust!.avatarUrl!);
      expect(exists).toBe(true);
    });

    it('streams company logo via GET /api/settings/avatar', async () => {
      const res = await request(app)
        .get('/api/settings/avatar')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('image/png');
    });

    it('streams company logo publicly via GET /api/settings/avatar/:customerId without token', async () => {
      const res = await request(app)
        .get(`/api/settings/avatar/${customerA.id}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('image/png');
      expect(res.header['cache-control']).toContain('public');
    });

    it('deletes company logo and resets avatarUrl in DB and storage', async () => {
      const custBefore = await prisma.customer.findUnique({ where: { id: customerA.id } });
      const avatarKey = custBefore!.avatarUrl!;

      const res = await request(app)
        .delete('/api/settings/avatar')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const custAfter = await prisma.customer.findUnique({ where: { id: customerA.id } });
      expect(custAfter?.avatarUrl).toBeNull();

      const exists = await storage.objectExists(avatarKey);
      expect(exists).toBe(false);
    });
  });

  describe('5 GB Storage Limit Enforcement & Multi-Tenant Isolation', () => {
    it('returns default 5 GB limit in GET /api/documents', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.storageLimit).toBe(5 * 1024 * 1024 * 1024);
      expect(res.body.storageUsed).toBe(0);
      expect(res.body.isStorageFull).toBe(false);
    });

    it('blocks upload when storage limit is exceeded with 403 STORAGE_QUOTA_EXCEEDED', async () => {
      // Temporarily set customerA's quota to 100 bytes to simulate quota full
      await prisma.customer.update({
        where: { id: customerA.id },
        data: { storageQuota: 100 },
      });

      const samplePdf = Buffer.alloc(1000, 'A'); // 1000 bytes > 100 bytes
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', samplePdf, 'dokumen-rahasia.pdf')
        .field('title', 'Dokumen Melebihi Kuota');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(res.body.error).toContain('5 GB');
    });

    it('blocks sending email when storage limit is exceeded with 403 STORAGE_QUOTA_EXCEEDED', async () => {
      // customerA is still at 100 bytes quota, and we insert a document of 150 bytes to make it 100% full
      await prisma.legalDocument.create({
        data: {
          customerId: customerA.id,
          title: 'Arsip Penuh',
          category: 'Client Agreements',
          filename: 'arsip.pdf',
          size: 150,
          path: 'arsip.pdf',
        },
      });

      const res = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('to', 'mitra@example.com')
        .field('subject', 'Kontrak Kerja')
        .field('body', 'Halo mitra');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(res.body.error).toContain('5 GB');

      // Restore quota back to 5 GB
      await prisma.customer.update({
        where: { id: customerA.id },
        data: { storageQuota: 5 * 1024 * 1024 * 1024 },
      });
    });

    it('enforces multi-tenant isolation: customerB cannot see customerA documents', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const titles = res.body.documents.map((d: any) => d.title);
      expect(titles).not.toContain('Arsip Penuh');
    });
  });
});
