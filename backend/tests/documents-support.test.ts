import request from 'supertest';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import app, { prisma } from '../src/app';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('Documents & Support API Routes (TDD)', () => {
  jest.setTimeout(30000);
  let customerA: any;
  let tokenA: string;
  let customerB: any;
  let tokenB: string;
  let testDoc1: any;
  let testDoc2: any;
  let otherDoc: any;
  let testTicket: any;
  let otherTicket: any;
  const storageDir = path.resolve(__dirname, '../storage');

  beforeAll(async () => {
    fs.mkdirSync(storageDir, { recursive: true });

    // Create dummy sample file in storage for download tests if needed
    const sampleFilePath = path.join(storageDir, 'test-sample-doc.pdf');
    if (!fs.existsSync(sampleFilePath)) {
      fs.writeFileSync(sampleFilePath, 'Dummy PDF content for testing download');
    }

    const ts = Date.now();
    customerA = await prisma.customer.create({
      data: {
        name: 'Customer A',
        personalEmail: `customerA-${ts}@example.com`,
        mailboxAddress: `customera-${ts}@clienteasylegal.co.id`,
        passwordEnc: 'dummy-password-enc',
        status: 'active',
      },
    });

    customerB = await prisma.customer.create({
      data: {
        name: 'Customer B',
        personalEmail: `customerB-${ts}@example.com`,
        mailboxAddress: `customerb-${ts}@clienteasylegal.co.id`,
        passwordEnc: 'dummy-password-enc-b',
        status: 'active',
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

    // Create documents for customer A
    testDoc1 = await prisma.legalDocument.create({
      data: {
        customerId: customerA.id,
        title: 'Akta Notaris Pendirian PT',
        category: 'Client Agreements',
        filename: 'test-sample-doc.pdf',
        mimeType: 'application/pdf',
        size: 5000,
        path: 'test-sample-doc.pdf',
        status: 'Approved',
        isStarred: true,
        ownerName: 'Notaris Fauzi',
        versions: {
          create: [
            {
              versionNumber: 'v1.0',
              authorName: 'Notaris Fauzi',
              approved: true,
              notes: 'Initial draft',
              createdAt: new Date(Date.now() - 86400000),
            },
            {
              versionNumber: 'v1.1',
              authorName: 'Legal Team',
              approved: true,
              notes: 'KBLI updated',
              createdAt: new Date(),
            },
          ],
        },
      },
    });

    testDoc2 = await prisma.legalDocument.create({
      data: {
        customerId: customerA.id,
        title: 'NDA Template Karyawan',
        category: 'NDA Templates',
        filename: 'nda-template.pdf',
        mimeType: 'application/pdf',
        size: 15000,
        path: 'test-sample-doc.pdf',
        status: 'Reviewed',
        isStarred: false,
        ownerName: 'Legal Team',
        versions: {
          create: [
            {
              versionNumber: 'v1.0',
              authorName: 'Legal Team',
              approved: true,
              notes: 'Standard NDA',
            },
          ],
        },
      },
    });

    // Create document for customer B (isolation test)
    otherDoc = await prisma.legalDocument.create({
      data: {
        customerId: customerB.id,
        title: 'Rahasia Perusahaan Lain',
        category: 'Tax Filings',
        filename: 'other-doc.pdf',
        mimeType: 'application/pdf',
        size: 8000,
        path: 'test-sample-doc.pdf',
        status: 'Reviewed',
        isStarred: false,
        ownerName: 'Other Team',
      },
    });

    // Create tickets
    testTicket = await prisma.supportTicket.create({
      data: {
        customerId: customerA.id,
        ticketNumber: '#TK-1001',
        subject: 'Kendala Akses Dokumen Perizinan',
        category: 'Document Review',
        status: 'open',
        priority: 'urgent',
        messages: {
          create: [
            {
              senderName: 'Customer A',
              senderRole: 'client',
              message: 'Mohon bantuan untuk review revisi NDA kami.',
              createdAt: new Date(Date.now() - 10000),
            },
            {
              senderName: 'Sarah Jenkins, LL.M.',
              senderRole: 'agent',
              message: 'Halo, kami sedang meninjau klausul kerahasiaan Anda.',
              createdAt: new Date(Date.now() - 5000),
            },
          ],
        },
      },
    });

    otherTicket = await prisma.supportTicket.create({
      data: {
        customerId: customerB.id,
        ticketNumber: '#TK-2002',
        subject: 'Tiket Customer B',
        category: 'Billing',
        status: 'open',
        priority: 'normal',
        messages: {
          create: [
            {
              senderName: 'Customer B',
              senderRole: 'client',
              message: 'Pertanyaan invoice bulan ini.',
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up created records
    try {
      await prisma.ticketMessage.deleteMany({
        where: { ticket: { customerId: { in: [customerA.id, customerB.id] } } },
      });
      await prisma.supportTicket.deleteMany({
        where: { customerId: { in: [customerA.id, customerB.id] } },
      });
      await prisma.documentVersion.deleteMany({
        where: { document: { customerId: { in: [customerA.id, customerB.id] } } },
      });
      await prisma.legalDocument.deleteMany({
        where: { customerId: { in: [customerA.id, customerB.id] } },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: [customerA.id, customerB.id] } },
      });
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  // ==========================================
  // Authentication & Authorization Guards
  // ==========================================
  describe('Authentication guards', () => {
    it('rejects GET /api/documents without token', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.status).toBe(401);
    });

    it('rejects GET /api/support/tickets without token', async () => {
      const res = await request(app).get('/api/support/tickets');
      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // Legal Documents Endpoints (/api/documents)
  // ==========================================
  describe('GET /api/documents', () => {
    it('returns customer documents, folders, storageUsed, and storageLimit', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('documents');
      expect(Array.isArray(res.body.documents)).toBe(true);
      expect(res.body.documents.length).toBe(2);

      // Verify isolated: customerB doc is not returned
      const docIds = res.body.documents.map((d: any) => d.id);
      expect(docIds).toContain(testDoc1.id);
      expect(docIds).toContain(testDoc2.id);
      expect(docIds).not.toContain(otherDoc.id);

      // Verify folders
      expect(res.body).toHaveProperty('folders');
      expect(Array.isArray(res.body.folders)).toBe(true);
      expect(res.body.folders).toContain('Client Agreements');
      expect(res.body.folders).toContain('NDA Templates');

      // Verify storage stats
      expect(res.body).toHaveProperty('storageUsed');
      expect(res.body.storageUsed).toBe(5000 + 15000);
      expect(res.body).toHaveProperty('storageLimit');
      expect(res.body.storageLimit).toBe(15 * 1024 * 1024 * 1024);
    });

    it('filters documents by category/folder', async () => {
      const res = await request(app)
        .get('/api/documents?folder=Client Agreements')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(1);
      expect(res.body.documents[0].id).toBe(testDoc1.id);
    });

    it('filters documents by search query', async () => {
      const res = await request(app)
        .get('/api/documents?search=Akta Notaris')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(1);
      expect(res.body.documents[0].id).toBe(testDoc1.id);
    });

    it('filters documents by isStarred=true', async () => {
      const res = await request(app)
        .get('/api/documents?isStarred=true')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(1);
      expect(res.body.documents[0].id).toBe(testDoc1.id);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('returns document with versions ordered by createdAt desc', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc1.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('document');
      expect(res.body.document.id).toBe(testDoc1.id);
      expect(res.body).toHaveProperty('versions');
      expect(Array.isArray(res.body.versions)).toBe(true);
      expect(res.body.versions.length).toBe(2);
      expect(res.body.versions[0].versionNumber).toBe('v1.1');
      expect(res.body.versions[1].versionNumber).toBe('v1.0');
    });

    it('returns 404 for document belonging to another customer', async () => {
      const res = await request(app)
        .get(`/api/documents/${otherDoc.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent document id', async () => {
      const res = await request(app)
        .get('/api/documents/non-existent-uuid')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/documents/:id/download', () => {
    it('streams file with correct Content-Type and Content-Disposition using Bearer auth', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc1.id}/download`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/pdf/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      const content = res.text || res.body?.toString?.('utf-8') || '';
      expect(content).toContain('Dummy PDF content for testing download');
    });

    it('allows download using ?token= query parameter', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc1.id}/download?token=${tokenA}`);

      expect(res.status).toBe(200);
      const content = res.text || res.body?.toString?.('utf-8') || '';
      expect(content).toContain('Dummy PDF content for testing download');
    });

    it('returns 404 when trying to download another customer document', async () => {
      const res = await request(app)
        .get(`/api/documents/${otherDoc.id}/download`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/documents/upload', () => {
    it('uploads a new document, saves file to storage, and creates initial version v1.0', async () => {
      const dummyBuffer = Buffer.from('Contract agreement content for test upload');

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('title', 'Perjanjian Kerjasama Baru')
        .field('category', 'Client Agreements')
        .attach('file', dummyBuffer, 'perjanjian-baru.pdf');

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('document');
      expect(res.body.document.title).toBe('Perjanjian Kerjasama Baru');
      expect(res.body.document.category).toBe('Client Agreements');
      expect(res.body.document.filename).toBe('perjanjian-baru.pdf');

      // Verify in DB and initial version
      const created = await prisma.legalDocument.findUnique({
        where: { id: res.body.document.id },
        include: { versions: true },
      });
      expect(created).toBeDefined();
      expect(created?.customerId).toBe(customerA.id);
      expect(created?.versions.length).toBe(1);
      expect(created?.versions[0].versionNumber).toBe('v1.0');

      // Clean up uploaded file from storage
      if (created?.path) {
        const filePath = path.resolve(storageDir, path.basename(created.path));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });
  });

  describe('PATCH /api/documents/:id/star', () => {
    it('toggles document star state', async () => {
      expect(testDoc2.isStarred).toBe(false);

      // First toggle -> true
      const res1 = await request(app)
        .patch(`/api/documents/${testDoc2.id}/star`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res1.status).toBe(200);
      expect(res1.body.isStarred).toBe(true);

      // Verify in DB
      const docAfterFirst = await prisma.legalDocument.findUnique({ where: { id: testDoc2.id } });
      expect(docAfterFirst?.isStarred).toBe(true);

      // Second toggle -> false
      const res2 = await request(app)
        .patch(`/api/documents/${testDoc2.id}/star`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res2.status).toBe(200);
      expect(res2.body.isStarred).toBe(false);
    });

    it('returns 404 when toggling star on document of another customer', async () => {
      const res = await request(app)
        .patch(`/api/documents/${otherDoc.id}/star`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('deletes document and associated versions', async () => {
      const docToDelete = await prisma.legalDocument.create({
        data: {
          customerId: customerA.id,
          title: 'Dokumen Sementara',
          category: 'Tax Filings',
          filename: 'temp-doc.pdf',
          path: 'temp-doc.pdf',
          versions: {
            create: [
              {
                versionNumber: 'v1.0',
                authorName: 'Temp Author',
              },
            ],
          },
        },
      });

      const res = await request(app)
        .delete(`/api/documents/${docToDelete.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify DB removal
      const checkDoc = await prisma.legalDocument.findUnique({ where: { id: docToDelete.id } });
      expect(checkDoc).toBeNull();

      const checkVersions = await prisma.documentVersion.findMany({ where: { documentId: docToDelete.id } });
      expect(checkVersions.length).toBe(0);
    });

    it('returns 404 when deleting document of another customer', async () => {
      const res = await request(app)
        .delete(`/api/documents/${otherDoc.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // Support Helpdesk Endpoints (/api/support)
  // ==========================================
  describe('GET /api/support/tickets', () => {
    it('returns customer tickets sorted by updatedAt desc with messages or count', async () => {
      const res = await request(app)
        .get('/api/support/tickets')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tickets');
      expect(Array.isArray(res.body.tickets)).toBe(true);
      expect(res.body.tickets.length).toBe(1);
      expect(res.body.tickets[0].id).toBe(testTicket.id);
      expect(res.body.tickets[0].ticketNumber).toBe('#TK-1001');

      // Customer B ticket should not appear
      const ticketIds = res.body.tickets.map((t: any) => t.id);
      expect(ticketIds).not.toContain(otherTicket.id);
    });
  });

  describe('GET /api/support/tickets/:id', () => {
    it('returns ticket detail with conversation messages ordered by createdAt asc', async () => {
      const res = await request(app)
        .get(`/api/support/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ticket');
      expect(res.body.ticket.id).toBe(testTicket.id);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBe(2);
      expect(res.body.messages[0].senderRole).toBe('client');
      expect(res.body.messages[1].senderRole).toBe('agent');
    });

    it('returns 404 for ticket of another customer', async () => {
      const res = await request(app)
        .get(`/api/support/tickets/${otherTicket.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/support/tickets', () => {
    it('creates a new support ticket with initial message', async () => {
      const res = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Pertanyaan Perubahan Alamat NPWP',
          category: 'Tax Filings',
          priority: 'urgent',
          message: 'Bagaimana prosedur perubahan alamat domisili pajak PT kami?',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('ticket');
      expect(res.body.ticket.subject).toBe('Pertanyaan Perubahan Alamat NPWP');
      expect(res.body.ticket.category).toBe('Tax Filings');
      expect(res.body.ticket.priority).toBe('urgent');
      expect(res.body.ticket.status).toBe('open');
      expect(res.body.ticket.ticketNumber).toMatch(/^#TK-/);

      // Verify ticket and message in DB
      const createdTicket = await prisma.supportTicket.findUnique({
        where: { id: res.body.ticket.id },
        include: { messages: true },
      });
      expect(createdTicket).toBeDefined();
      expect(createdTicket?.customerId).toBe(customerA.id);
      expect(createdTicket?.messages.length).toBe(1);
      expect(createdTicket?.messages[0].message).toBe('Bagaimana prosedur perubahan alamat domisili pajak PT kami?');
      expect(createdTicket?.messages[0].senderRole).toBe('client');
      expect(createdTicket?.messages[0].senderName).toBe('Customer A');
    });
  });

  describe('POST /api/support/tickets/:id/reply', () => {
    it('appends a client reply message to the ticket', async () => {
      const res = await request(app)
        .post(`/api/support/tickets/${testTicket.id}/reply`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          message: 'Terima kasih atas tanggapannya, kami tunggu kabarnya.',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message.message).toBe('Terima kasih atas tanggapannya, kami tunggu kabarnya.');
      expect(res.body.message.senderRole).toBe('client');
      expect(res.body.message.senderName).toBe('Customer A');

      // Verify in DB
      const messages = await prisma.ticketMessage.findMany({
        where: { ticketId: testTicket.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(messages.length).toBe(3);
      expect(messages[2].message).toBe('Terima kasih atas tanggapannya, kami tunggu kabarnya.');
    });

    it('returns 404 when replying to ticket belonging to another customer', async () => {
      const res = await request(app)
        .post(`/api/support/tickets/${otherTicket.id}/reply`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          message: 'Unauthorized reply attempt',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/support/tickets/:id/close', () => {
    it('closes the ticket and updates status to resolved', async () => {
      const res = await request(app)
        .post(`/api/support/tickets/${testTicket.id}/close`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ticket');
      expect(res.body.ticket.status).toBe('resolved');

      // Verify in DB
      const updated = await prisma.supportTicket.findUnique({
        where: { id: testTicket.id },
      });
      expect(updated?.status).toBe('resolved');
    });

    it('returns 404 when closing another customer ticket', async () => {
      const res = await request(app)
        .post(`/api/support/tickets/${otherTicket.id}/close`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // Cold Storage 90-Day Retention Detection
  // ==========================================
  describe('Cold Storage 90-day retention detection', () => {
    let oldDoc: any;

    beforeAll(async () => {
      oldDoc = await prisma.legalDocument.create({
        data: {
          customerId: customerA.id,
          title: 'Arsip Dokumen Lama (> 90 Hari)',
          category: 'Client Agreements',
          filename: 'arsip-lama.pdf',
          mimeType: 'application/pdf',
          size: 12000,
          path: 'non-existent-old-doc.pdf',
          status: 'Approved',
          isStarred: false,
          createdAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
        },
      });
    });

    afterAll(async () => {
      try {
        await prisma.legalDocument.delete({ where: { id: oldDoc.id } });
      } catch {}
    });

    it('flags documents older than 90 days as isColdStorage: true in GET /api/documents', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const docs = res.body.documents;
      const recent = docs.find((d: any) => d.id === testDoc1.id);
      const old = docs.find((d: any) => d.id === oldDoc.id);

      expect(recent).toBeDefined();
      expect(recent.isColdStorage).toBe(false);
      expect(old).toBeDefined();
      expect(old.isColdStorage).toBe(true);
    });

    it('flags document in GET /api/documents/:id detail', async () => {
      const res = await request(app)
        .get(`/api/documents/${oldDoc.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.document.isColdStorage).toBe(true);
    });

    it('returns cold storage notification when downloading missing hot file older than 90 days', async () => {
      const res = await request(app)
        .get(`/api/documents/${oldDoc.id}/download`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.isColdStorage).toBe(true);
      expect(res.body.error).toMatch(/Cold Storage/i);
    });
  });
});

