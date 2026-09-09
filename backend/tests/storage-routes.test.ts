import request from 'supertest';
import app, { prisma } from '../src/app';
import jwt from 'jsonwebtoken';

describe('Storage Admin Routes (/api/storage)', () => {
  let superAdminToken: string;
  let officerToken: string;

  beforeAll(async () => {
    const admin = await prisma.adminUser.findFirst();
    const adminId = admin ? admin.id : 'admin-test-id';
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    
    superAdminToken = jwt.sign(
      { id: adminId, email: 'admin@clienteasylegal.co.id', type: 'admin', role: 'superadmin' },
      secret,
      { expiresIn: '1h' }
    );

    officerToken = jwt.sign(
      { id: 'off-test-id', email: 'officer@clienteasylegal.co.id', type: 'admin', role: 'officer' },
      secret,
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

  it('allows officer to view synology status but blocks from triggering sync or overview', async () => {
    const resStatus = await request(app)
      .get('/api/storage/synology-status')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(resStatus.status).toBe(200);

    const resSync = await request(app)
      .post('/api/storage/sync-synology')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ dryRun: true });
    expect(resSync.status).toBe(403);

    const resOverview = await request(app)
      .get('/api/storage/overview')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(resOverview.status).toBe(403);
  });

  it('returns synology status for super admin', async () => {
    const res = await request(app)
      .get('/api/storage/synology-status')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isAvailable');
    expect(res.body).toHaveProperty('targetPath');
    expect(res.body).toHaveProperty('totalSyncedFiles');
  });

  it('triggers sync via POST /api/storage/sync-synology for super admin', async () => {
    const res = await request(app)
      .post('/api/storage/sync-synology')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('syncedCount');
    expect(res.body).toHaveProperty('skippedCount');
  });

  it('returns global storage overview and per-account usage for super admin', async () => {
    const res = await request(app)
      .get('/api/storage/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalStorageUsedBytes');
    expect(res.body).toHaveProperty('totalStorageQuotaBytes');
    expect(res.body).toHaveProperty('accounts');
    expect(Array.isArray(res.body.accounts)).toBe(true);

    if (res.body.accounts.length > 0) {
      const first = res.body.accounts[0];
      expect(first).toHaveProperty('mailboxAddress');
      expect(first).toHaveProperty('usedBytes');
      expect(first).toHaveProperty('quotaBytes');
      expect(first).toHaveProperty('warningExceeded80');
    }
  });
});
