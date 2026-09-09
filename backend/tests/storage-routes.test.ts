import request from 'supertest';
import app, { prisma } from '../src/app';
import jwt from 'jsonwebtoken';

describe('Storage Admin Routes (/api/storage)', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.adminUser.findFirst();
    const adminId = admin ? admin.id : 'admin-test-id';
    adminToken = jwt.sign(
      { id: adminId, email: 'admin@clienteasylegal.co.id', type: 'admin', role: 'SUPER_ADMIN' },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/storage/synology-status');
    expect(res.status).toBe(401);
  });

  it('returns synology status for admin', async () => {
    const res = await request(app)
      .get('/api/storage/synology-status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isAvailable');
    expect(res.body).toHaveProperty('targetPath');
    expect(res.body).toHaveProperty('totalSyncedFiles');
  });

  it('triggers sync via POST /api/storage/sync-synology', async () => {
    const res = await request(app)
      .post('/api/storage/sync-synology')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('syncedCount');
    expect(res.body).toHaveProperty('skippedCount');
  });
});
