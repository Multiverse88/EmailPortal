import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import securityRoutes from '../src/routes/security';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const prisma = new PrismaClient();

describe('Security Radar Endpoints', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/security', securityRoutes(prisma));

  let testCustomer: any;
  let adminToken: string;
  let officerToken: string;
  let customerToken: string;

  beforeAll(async () => {
    testCustomer = await prisma.customer.create({
      data: {
        name: 'PT Radar Test',
        personalEmail: 'radartest@example.com',
        mailboxAddress: 'radar@clienteasylegal.co.id',
        passwordEnc: 'mock_enc',
        status: 'active',
      },
    });

    // Create 2 sessions from different IPs for testCustomer to trigger multi-IP alert
    await prisma.loginSession.createMany({
      data: [
        {
          customerId: testCustomer.id,
          deviceName: 'Chrome on macOS',
          deviceType: 'laptop',
          browser: 'Chrome 128',
          ipAddress: '182.253.140.22',
          location: 'Jakarta, Indonesia',
          isCurrent: true,
          lastActiveAt: new Date(),
        },
        {
          customerId: testCustomer.id,
          deviceName: 'Safari on iPhone',
          deviceType: 'mobile',
          browser: 'Mobile Safari 17',
          ipAddress: '114.124.200.15',
          location: 'Surabaya, Indonesia',
          isCurrent: false,
          lastActiveAt: new Date(),
        },
      ],
    });

    adminToken = jwt.sign({ id: 'admin-1', email: 'admin@clienteasylegal.co.id', type: 'admin', role: 'superadmin' }, JWT_SECRET);
    officerToken = jwt.sign({ id: 'off-1', email: 'officer@clienteasylegal.co.id', type: 'admin', role: 'officer' }, JWT_SECRET);
    customerToken = jwt.sign({ id: testCustomer.id, email: testCustomer.mailboxAddress, type: 'customer', role: 'customer' }, JWT_SECRET);
  });

  afterAll(async () => {
    await prisma.loginSession.deleteMany({ where: { customerId: testCustomer.id } });
    await prisma.customer.delete({ where: { id: testCustomer.id } });
    await prisma.$disconnect();
  });

  it('allows Super Admin to view security radar and detects multi-IP alert', async () => {
    const res = await request(app)
      .get('/api/security/admin/radar')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.accounts).toBeDefined();
    const accountReport = res.body.accounts.find((a: any) => a.id === testCustomer.id);
    expect(accountReport).toBeDefined();
    expect(accountReport.activeSessionsCount).toBe(2);
    expect(accountReport.uniqueIps.length).toBe(2);
    expect(accountReport.isMultiIpAlert).toBe(true);
  });

  it('blocks Officer from accessing global security radar', async () => {
    const res = await request(app)
      .get('/api/security/admin/radar')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
  });

  it('blocks Customer from accessing global security radar', async () => {
    const res = await request(app)
      .get('/api/security/admin/radar')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('allows Super Admin to kick a specific session', async () => {
    const sessions = await prisma.loginSession.findMany({ where: { customerId: testCustomer.id } });
    const targetSession = sessions[0];

    const res = await request(app)
      .post(`/api/security/admin/sessions/${targetSession.id}/terminate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const check = await prisma.loginSession.findUnique({ where: { id: targetSession.id } });
    expect(check).toBeNull();
  });

  it('allows Super Admin to kick all sessions for an account', async () => {
    const res = await request(app)
      .post(`/api/security/admin/accounts/${testCustomer.id}/terminate-all`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.terminatedCount).toBeGreaterThanOrEqual(1);

    const check = await prisma.loginSession.findMany({ where: { customerId: testCustomer.id } });
    expect(check.length).toBe(0);
  });
});
