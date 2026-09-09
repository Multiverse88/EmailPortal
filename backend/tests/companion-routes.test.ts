import request from 'supertest';
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
