import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import storageRoutes from '../src/routes/storage';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const RUNNER_TOKEN = 'test-runner-token-xyz';
process.env.SYNOLOGY_RUNNER_TOKEN = RUNNER_TOKEN;

describe('Synology Runner API', () => {
  const app = express();
  app.use(express.json());

  const mockPrisma: any = {
    legalDocument: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]) },
    attachment: { count: jest.fn().mockResolvedValue(10), findMany: jest.fn().mockResolvedValue([]) },
    customer: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
  };

  app.use('/api/storage', storageRoutes(mockPrisma));

  const superAdminToken = jwt.sign(
    { id: 'admin-1', email: 'admin@clienteasylegal.co.id', type: 'admin', role: 'superadmin' },
    JWT_SECRET
  );

  it('rejects runner heartbeat without valid runner token', async () => {
    const res = await request(app).post('/api/storage/sync-agent/heartbeat').send({ hostname: 'fedora-laptop' });
    expect(res.status).toBe(401);
  });

  it('accepts runner heartbeat with valid runner token and reports runner online', async () => {
    const hbRes = await request(app)
      .post('/api/storage/sync-agent/heartbeat')
      .set('X-Runner-Secret-Token', RUNNER_TOKEN)
      .send({ hostname: 'fedora-laptop', targetDir: '/home/test/Synology' });
    expect(hbRes.status).toBe(200);
    expect(hbRes.body.acknowledged).toBe(true);

    const statusRes = await request(app)
      .get('/api/storage/sync-agent/status')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.isOnline).toBe(true);
  });

  it('creates a sync queue job and allows runner to poll and complete it', async () => {
    const queueRes = await request(app)
      .post('/api/storage/sync-queue')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ dryRun: false });
    expect(queueRes.status).toBe(202);
    const jobId = queueRes.body.jobId;

    const pollRes = await request(app)
      .get('/api/storage/sync-agent/poll')
      .set('X-Runner-Secret-Token', RUNNER_TOKEN);
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.job?.id).toBe(jobId);

    const completeRes = await request(app)
      .post('/api/storage/sync-agent/complete')
      .set('X-Runner-Secret-Token', RUNNER_TOKEN)
      .send({
        jobId,
        success: true,
        result: { syncedCount: 3, skippedCount: 5, failedCount: 0, totalBytesCopied: 1024 },
      });
    expect(completeRes.status).toBe(200);

    const checkJobRes = await request(app)
      .get(`/api/storage/sync-queue/status/${jobId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(checkJobRes.status).toBe(200);
    expect(checkJobRes.body.status).toBe('COMPLETED');
    expect(checkJobRes.body.result.syncedCount).toBe(3);
  });
});
