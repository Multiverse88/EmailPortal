import request from 'supertest';
import jwt from 'jsonwebtoken';
import app, { prisma } from '../src/app';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('Security and Settings API Routes (TDD)', () => {
  let testCustomer: any;
  let customerToken: string;
  let otherCustomer: any;
  let adminToken: string;

  beforeAll(async () => {
    // Create dedicated test customers to prevent mutating demo seed data
    const timestamp = Date.now();
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Test Customer Security',
        personalEmail: `test-sec-${timestamp}@example.com`,
        mailboxAddress: `test-sec-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: 'dummy-encrypted-password',
        status: 'active',
        twoFactorEnabled: false,
        preferences: JSON.stringify({
          language: 'id',
          timezone: 'Asia/Jakarta',
          signature: 'Salam hangat, Test Customer',
          notifyEmail: true,
          notifySound: false,
        }),
      },
    });

    otherCustomer = await prisma.customer.create({
      data: {
        name: 'Other Customer Security',
        personalEmail: `other-sec-${timestamp}@example.com`,
        mailboxAddress: `other-sec-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: 'dummy-encrypted-password-other',
        status: 'active',
        twoFactorEnabled: false,
        preferences: JSON.stringify({ language: 'en' }),
      },
    });

    // Create sessions for testCustomer (1 current, 2 others)
    await prisma.loginSession.createMany({
      data: [
        {
          customerId: testCustomer.id,
          deviceName: 'MacBook Pro 14"',
          deviceType: 'laptop',
          browser: 'Chrome 122',
          ipAddress: '103.28.12.1',
          location: 'Jakarta, Indonesia',
          isCurrent: true,
        },
        {
          customerId: testCustomer.id,
          deviceName: 'iPhone 15 Pro',
          deviceType: 'mobile',
          browser: 'Safari 17',
          ipAddress: '182.1.22.33',
          location: 'Bandung, Indonesia',
          isCurrent: false,
        },
        {
          customerId: testCustomer.id,
          deviceName: 'Windows Office Desktop',
          deviceType: 'desktop',
          browser: 'Edge 120',
          ipAddress: '36.88.99.11',
          location: 'Surabaya, Indonesia',
          isCurrent: false,
        },
        // Session for otherCustomer
        {
          customerId: otherCustomer.id,
          deviceName: 'Other Customer Device',
          deviceType: 'laptop',
          browser: 'Firefox 120',
          ipAddress: '10.0.0.1',
          location: 'Medan, Indonesia',
          isCurrent: false,
        },
      ],
    });

    customerToken = jwt.sign(
      { id: testCustomer.id, email: testCustomer.mailboxAddress, type: 'customer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: 'admin-1', email: 'admin@easylegal.co.id', type: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up created test customers and sessions (cascade deletes sessions)
    if (testCustomer?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: testCustomer.id } });
      await prisma.customer.delete({ where: { id: testCustomer.id } }).catch(() => {});
    }
    if (otherCustomer?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: otherCustomer.id } });
      await prisma.customer.delete({ where: { id: otherCustomer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Authentication & Authorization Guards', () => {
    it('should reject unauthenticated requests to security endpoints with 401', async () => {
      const resSessions = await request(app).get('/api/security/sessions');
      expect(resSessions.status).toBe(401);

      const res2fa = await request(app).post('/api/security/2fa/toggle');
      expect(res2fa.status).toBe(401);

      const resTerminate = await request(app).post('/api/security/sessions/terminate-others');
      expect(resTerminate.status).toBe(401);
    });

    it('should reject unauthenticated requests to settings endpoints with 401', async () => {
      const resSettings = await request(app).get('/api/settings');
      expect(resSettings.status).toBe(401);

      const resUpdate = await request(app).put('/api/settings/preferences');
      expect(resUpdate.status).toBe(401);
    });

    it('should reject admin token on customer routes with 403', async () => {
      const res = await request(app)
        .get('/api/security/sessions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/security/sessions', () => {
    it('should list all active login sessions for the authenticated customer', async () => {
      const res = await request(app)
        .get('/api/security/sessions')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBe(3);

      const deviceNames = res.body.sessions.map((s: any) => s.deviceName);
      expect(deviceNames).toContain('MacBook Pro 14"');
      expect(deviceNames).toContain('iPhone 15 Pro');
      expect(deviceNames).toContain('Windows Office Desktop');
      expect(deviceNames).not.toContain('Other Customer Device');

      const currentSession = res.body.sessions.find((s: any) => s.isCurrent === true);
      expect(currentSession).toBeDefined();
      expect(currentSession.deviceName).toBe('MacBook Pro 14"');
    });
  });

  describe('POST /api/security/2fa/toggle', () => {
    it('should toggle 2FA from false to true when called without body', async () => {
      const res = await request(app)
        .post('/api/security/2fa/toggle')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('twoFactorEnabled', true);

      // Verify in database
      const customerInDb = await prisma.customer.findUnique({ where: { id: testCustomer.id } });
      expect(customerInDb?.twoFactorEnabled).toBe(true);
    });

    it('should toggle 2FA back from true to false', async () => {
      const res = await request(app)
        .post('/api/security/2fa/toggle')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('twoFactorEnabled', false);

      const customerInDb = await prisma.customer.findUnique({ where: { id: testCustomer.id } });
      expect(customerInDb?.twoFactorEnabled).toBe(false);
    });

    it('should set 2FA explicitly when enabled boolean is passed in body', async () => {
      const res = await request(app)
        .post('/api/security/2fa/toggle')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('twoFactorEnabled', true);

      const customerInDb = await prisma.customer.findUnique({ where: { id: testCustomer.id } });
      expect(customerInDb?.twoFactorEnabled).toBe(true);
    });
  });

  describe('POST /api/security/sessions/terminate-others', () => {
    it('should terminate all sessions except the current active session', async () => {
      const res = await request(app)
        .post('/api/security/sessions/terminate-others')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('terminatedCount', 2);

      // Verify session list now contains only 1 session (the current one)
      const listRes = await request(app)
        .get('/api/security/sessions')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.sessions.length).toBe(1);
      expect(listRes.body.sessions[0].deviceName).toBe('MacBook Pro 14"');
      expect(listRes.body.sessions[0].isCurrent).toBe(true);

      // Verify other customer session was not touched
      const otherSessions = await prisma.loginSession.findMany({
        where: { customerId: otherCustomer.id },
      });
      expect(otherSessions.length).toBe(1);
    });
  });

  describe('GET /api/settings', () => {
    it('should retrieve user profile and parsed preferences without passwordEnc', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('preferences');

      // User fields check
      expect(res.body.user.id).toBe(testCustomer.id);
      expect(res.body.user.name).toBe('Test Customer Security');
      expect(res.body.user.mailboxAddress).toBe(testCustomer.mailboxAddress);
      expect(res.body.user.passwordEnc).toBeUndefined();

      // Preferences check
      expect(res.body.preferences).toHaveProperty('language', 'id');
      expect(res.body.preferences).toHaveProperty('timezone', 'Asia/Jakarta');
      expect(res.body.preferences).toHaveProperty('signature', 'Salam hangat, Test Customer');
    });
  });

  describe('PUT /api/settings/preferences', () => {
    it('should update preferences and persist them merged in database', async () => {
      const res = await request(app)
        .put('/api/settings/preferences')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          preferences: {
            language: 'en',
            signature: 'Kind regards, Legal Team',
            notifySound: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('preferences');
      expect(res.body.preferences.language).toBe('en');
      expect(res.body.preferences.timezone).toBe('Asia/Jakarta'); // Preserved from previous
      expect(res.body.preferences.signature).toBe('Kind regards, Legal Team');
      expect(res.body.preferences.notifySound).toBe(true);

      // Verify in DB
      const updatedCustomer = await prisma.customer.findUnique({
        where: { id: testCustomer.id },
      });
      const storedPrefs = JSON.parse(updatedCustomer?.preferences || '{}');
      expect(storedPrefs.language).toBe('en');
      expect(storedPrefs.signature).toBe('Kind regards, Legal Team');
      expect(storedPrefs.notifySound).toBe(true);
    });

    it('should accept flat preferences payload as well', async () => {
      const res = await request(app)
        .put('/api/settings/preferences')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          timezone: 'Asia/Singapore',
        });

      expect(res.status).toBe(200);
      expect(res.body.preferences.timezone).toBe('Asia/Singapore');
      expect(res.body.preferences.language).toBe('en'); // Preserved
    });
  });
});
