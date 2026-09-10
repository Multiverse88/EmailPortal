import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import app, { prisma } from '../src/app';
import { extractTextFromPdfBuffer, parseIndonesianLegalText, saveDocumentMetadataToPersistentMemory } from '../src/lib/document-extractor';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const signAdminToken = (id: string, email: string, role: 'superadmin' | 'officer') =>
  jwt.sign({ id, email, type: 'admin', role }, JWT_SECRET, { expiresIn: '1h' });

const signCustomerToken = (id: string, email: string) =>
  jwt.sign({ id, email, type: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

describe('Zero-Leakage Local Legal PDF Metadata Extractor & Super Admin Support Desk', () => {
  let superAdminToken: string;
  let officerToken: string;
  let customerToken: string;
  let testCustomerId: string;
  let testTicketId: string;

  beforeAll(async () => {
    superAdminToken = signAdminToken('admin-super-1', 'admin@clienteasylegal.co.id', 'superadmin');
    officerToken = signAdminToken('officer-1', 'officer@clienteasylegal.co.id', 'officer');

    const customer = await prisma.customer.findFirst({
      where: { mailboxAddress: { startsWith: 'budi@' } },
    });
    testCustomerId = customer?.id || 'dummy-cust-id';
    customerToken = signCustomerToken(testCustomerId, customer?.mailboxAddress || 'budi@clienteasylegal.co.id');

    // Create a test ticket for Super Admin tests
    const ticket = await prisma.supportTicket.create({
      data: {
        customerId: testCustomerId,
        ticketNumber: `#TK-${Math.floor(10000 + Math.random() * 90000)}`,
        subject: 'Permohonan pemulihan berkas kontrak 2025 dari Cold Storage Synology',
        category: 'Permohonan Berkas Arsip',
        priority: 'urgent',
        status: 'open',
        messages: {
          create: [
            {
              senderName: customer?.name || 'Budi Setiawan',
              senderRole: 'client',
              message: 'Halo Super Admin, kami memerlukan arsip kontrak kerjasama PT Maju Bersama tahun lalu yang telah masuk cold storage (> 90 hari). Mohon bantuan pemulihannya.',
            },
          ],
        },
      },
    });
    testTicketId = ticket.id;
  });

  afterAll(async () => {
    if (testTicketId) {
      try {
        await prisma.supportTicket.delete({ where: { id: testTicketId } });
      } catch {}
    }
    await prisma.$disconnect();
  });

  describe('1. Zero-Leakage In-Memory Extraction & Persistent Memory Storage', () => {
    it('extracts Indonesian legal metadata locally with zero data leakage', async () => {
      const samplePdfPath = path.resolve(__dirname, '../../storage/sk-kemenkumham-2026.pdf');
      const buffer = fs.readFileSync(samplePdfPath);

      // In-memory text extraction
      const extractedText = await extractTextFromPdfBuffer(buffer);
      expect(typeof extractedText).toBe('string');

      // Rule-based heuristic legal parsing
      const metadata = parseIndonesianLegalText(extractedText, 'sk-kemenkumham-2026.pdf');
      expect(metadata.docType).toBe('SK Kemenkumham');
      expect(metadata.companyName).toBeDefined();
      expect(metadata.documentNumber).toBeDefined();
      expect(metadata.effectiveDate).toBeDefined();
      expect(metadata.summary).toBeDefined();
      expect(metadata.confidenceScore).toBeGreaterThanOrEqual(0.7);

      // Persist to local SQLite persistent memory (DocumentMetadata table)
      const persisted = await saveDocumentMetadataToPersistentMemory(prisma, {
        customerId: testCustomerId,
        metadata,
        verifiedBy: 'officer@clienteasylegal.co.id',
      });

      expect(persisted.id).toBeDefined();
      expect(persisted.docType).toBe('SK Kemenkumham');
      expect(persisted.customerId).toBe(testCustomerId);

      // Verify it exists in SQLite database
      const fetched = await prisma.documentMetadata.findUnique({
        where: { id: persisted.id },
      });
      expect(fetched).not.toBeNull();
      expect(fetched?.verifiedBy).toBe('officer@clienteasylegal.co.id');

      // Cleanup test metadata
      await prisma.documentMetadata.delete({ where: { id: persisted.id } });
    });
  });

  describe('2. Officer Document Metadata API Endpoints', () => {
    it('allows Officer to list and query document metadata', async () => {
      const res = await request(app)
        .get('/api/admin/documents/metadata')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('metadata');
      expect(Array.isArray(res.body.metadata)).toBe(true);
    });

    it('allows Officer to upload and extract PDF with zero leakage', async () => {
      const samplePdfPath = path.resolve(__dirname, '../../storage/sk-kemenkumham-2026.pdf');

      const res = await request(app)
        .post('/api/admin/documents/extract')
        .set('Authorization', `Bearer ${officerToken}`)
        .attach('file', samplePdfPath)
        .field('customerId', testCustomerId);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.privacy.zeroDataLeakage).toBe(true);
      expect(res.body.privacy.storageMode).toBe('persistent_sqlite_memory');
      expect(res.body.data.id).toBeDefined();

      // Cleanup
      if (res.body.data?.id) {
        await prisma.documentMetadata.delete({ where: { id: res.body.data.id } });
      }
    });

    it('rejects unauthenticated requests to /api/admin/documents', async () => {
      const res = await request(app).get('/api/admin/documents/metadata');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Super Admin Exclusive Support Ticket Desk & AI Resolution Copilot', () => {
    it('allows Super Admin to list all customer tickets with diagnostic stats', async () => {
      const res = await request(app)
        .get('/api/admin/support/tickets')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tickets');
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('open');
      expect(res.body.stats).toHaveProperty('resolved');
    });

    it('allows Super Admin to retrieve ticket details and live customer diagnostic context', async () => {
      const res = await request(app)
        .get(`/api/admin/support/tickets/${testTicketId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ticket.id).toBe(testTicketId);
      expect(res.body).toHaveProperty('customerContext');
      expect(res.body.customerContext).toHaveProperty('retention');
      expect(res.body.customerContext).toHaveProperty('storageStats');
    });

    it('generates context-aware AI Suggested Resolution for Super Admin (Synology Cold Storage recovery)', async () => {
      const res = await request(app)
        .post(`/api/admin/support/tickets/${testTicketId}/suggest-reply`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestedReply');
      expect(res.body).toHaveProperty('categoryInsight');
      expect(res.body).toHaveProperty('recommendedActions');
      expect(res.body.suggestedReply).toContain('Cold Storage');
      expect(res.body.recommendedActions.length).toBeGreaterThan(0);
    });

    it('allows Super Admin to reply to client ticket and mark as resolved', async () => {
      const res = await request(app)
        .post(`/api/admin/support/tickets/${testTicketId}/reply`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          message: 'Permohonan pemulihan berkas telah diproses oleh Super Admin.',
          status: 'resolved',
        });

      expect(res.status).toBe(201);
      expect(res.body.message.senderRole).toBe('agent');
      expect(res.body.ticket.status).toBe('resolved');
    });

    it('prevents Officer from accessing Super Admin ticket support endpoints (RBAC separation)', async () => {
      // Officer role must NOT have access to Super Admin ticket desk
      const res = await request(app)
        .get('/api/admin/support/tickets')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Super Admin');
    });
  });
});
