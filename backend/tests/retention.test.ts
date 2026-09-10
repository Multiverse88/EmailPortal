import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { computeRetention } from '../src/lib/retention';
import settingsRoutes from '../src/routes/settings';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const signToken = (id: string, email: string, type: 'customer') =>
  jwt.sign({ id, email, type }, JWT_SECRET, { expiresIn: '1h' });

describe('Account Retention Utility (computeRetention)', () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const fixedNow = new Date('2026-09-09T12:00:00.000Z');

  it('calculates 90 days remaining with 0% used when created today', () => {
    const createdAt = new Date(fixedNow.getTime());
    const retention = computeRetention(createdAt, fixedNow);

    expect(retention.retentionDays).toBe(90);
    expect(retention.remainingDays).toBe(90);
    expect(retention.elapsedDays).toBe(0);
    expect(retention.percentUsed).toBe(0);
    expect(retention.isExpiringSoon).toBe(false);
    expect(retention.isExpired).toBe(false);
    expect(retention.policyNotice).toContain('3 bulan');
    expect(retention.warningNotice).toBeUndefined();
  });

  it('triggers 1-month warning when remaining days <= 30 (created 65 days ago)', () => {
    const createdAt = new Date(fixedNow.getTime() - 65 * MS_PER_DAY);
    const retention = computeRetention(createdAt, fixedNow);

    expect(retention.retentionDays).toBe(90);
    expect(retention.remainingDays).toBe(25);
    expect(retention.elapsedDays).toBe(65);
    expect(retention.isExpiringSoon).toBe(true);
    expect(retention.isExpired).toBe(false);
    expect(retention.warningNotice).toBeDefined();
    expect(retention.warningNotice).toContain('backup');
    expect(retention.warningNotice).toContain('1x24 jam');
  });

  it('flags account as expired when past 90 days (created 95 days ago)', () => {
    const createdAt = new Date(fixedNow.getTime() - 95 * MS_PER_DAY);
    const retention = computeRetention(createdAt, fixedNow);

    expect(retention.retentionDays).toBe(90);
    expect(retention.remainingDays).toBe(0);
    expect(retention.isExpired).toBe(true);
    expect(retention.isExpiringSoon).toBe(false);
    expect(retention.percentUsed).toBe(100);
    expect(retention.warningNotice).toContain('1x24 jam');
  });
});

describe('GET /api/settings retention payload integration', () => {
  const mockPrisma: any = {
    customer: {
      findUnique: jest.fn(),
    },
    legalDocument: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { size: 0 } }),
    },
    attachment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { size: 0 } }),
    },
  };

  const app = express();
  app.use(express.json());
  // Mock authenticateCustomer middleware
  app.use((req: any, _res, next) => {
    req.user = { id: 'cust-123', email: 'budi@clienteasylegal.co.id', type: 'customer' };
    next();
  });
  app.use('/api/settings', settingsRoutes(mockPrisma));

  it('returns retention payload with 3-month policy metadata in GET /api/settings', async () => {
    const createdAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust-123',
      name: 'Budi Setiawan',
      mailboxAddress: 'budi@clienteasylegal.co.id',
      companyName: 'PT Maju Bersama',
      status: 'active',
      storageQuota: 5368709120,
      createdAt,
      updatedAt: new Date(),
      preferences: null,
      avatarUrl: null,
    });

    const token = signToken('cust-123', 'budi@clienteasylegal.co.id', 'customer');
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('retention');
    expect(res.body.retention.retentionDays).toBe(90);
    expect(res.body.retention.remainingDays).toBe(70);
    expect(res.body.retention.isExpiringSoon).toBe(false);
    expect(res.body.retention).toHaveProperty('policyNotice');
  });
});
