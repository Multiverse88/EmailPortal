import request from 'supertest';
import jwt from 'jsonwebtoken';
import app, { prisma } from '../src/app';

describe('Companion Routes', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/companion/status', () => {
    it('should return companion status without exposing API key', async () => {
      const res = await request(app).get('/api/companion/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
      expect(res.body).toHaveProperty('model');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('active', true);
      expect(res.body).not.toHaveProperty('apiKey');
    });
  });

  describe('POST /api/companion/chat', () => {
    const originalApiKey = process.env.NINEROUTER_API_KEY;

    beforeEach(() => {
      delete process.env.NINEROUTER_API_KEY;
    });

    afterEach(() => {
      if (originalApiKey !== undefined) {
        process.env.NINEROUTER_API_KEY = originalApiKey;
      } else {
        delete process.env.NINEROUTER_API_KEY;
      }
    });

    it('should reject request without query', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: '' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should answer retention question using knowledge base when 9router key is not set', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: 'Berapa lama masa retensi akun?' });
      expect(res.status).toBe(200);
      expect(res.body.text).toContain('3 bulan');
      expect(res.body.pose).toBe('tips');
      expect(res.body.source).toBe('local');
      expect(res.body.quickActions).toBeDefined();
    });

    it('should answer website and feature questions using knowledge base when 9router key is not set', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: 'Website ini tentang apa dan apa fungsi portal?' });
      expect(res.status).toBe(200);
      expect(res.body.text).toContain('EasyLegal Customer Portal');
      expect(res.body.text).toContain('/inbox');
      expect(res.body.source).toBe('local');
    });

    it('should answer backend architecture questions using knowledge base when 9router key is not set', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: 'Bagaimana arsitektur backend dan teknologi apa yang dipakai?' });
      expect(res.status).toBe(200);
      expect(res.body.text).toContain('Node.js');
      expect(res.body.text).toContain('Express');
      expect(res.body.text).toContain('Prisma ORM');
      expect(res.body.source).toBe('local');
    });

    it('should include live customer account context when Bearer token is provided', async () => {
      const ts = Date.now();
      const testCustomer = await prisma.customer.create({
        data: {
          name: `Test Client ${ts}`,
          personalEmail: `testclient-${ts}@example.com`,
          mailboxAddress: `client-${ts}@clienteasylegal.co.id`,
          passwordEnc: 'enc-pass',
          status: 'active',
          twoFactorEnabled: true,
        },
      });

      const token = jwt.sign(
        { id: testCustomer.id, type: 'customer', email: testCustomer.personalEmail },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/api/companion/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'Berapa sisa hari masa aktif akun saya?' });

      expect(res.status).toBe(200);
      expect(res.body.text).toContain('3 bulan');
      expect(res.body.text).toContain('Data Kondisi Akun Anda Saat Ini:');
      expect(res.body.text).toContain(testCustomer.name);
      expect(res.body.text).toContain('Sisa Masa Aktif Retensi:');
    });

    it('should provide polite fallback with quick actions for unknown queries', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: 'Pertanyaan aneh yang tidak dikenali sistem sama sekali xyz' });
      expect(res.status).toBe(200);
      expect(res.body.text).toContain('El');
      expect(res.body.quickActions.length).toBeGreaterThanOrEqual(2);
    });
  });
});
