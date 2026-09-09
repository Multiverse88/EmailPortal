import request from 'supertest';
import jwt from 'jsonwebtoken';
import app, { prisma } from '../src/app';
import { generateTotp } from '../src/lib/totp';
import { encrypt } from '../src/lib/crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('2FA Setup, Verification and Management API', () => {
  let customer: any;
  let token: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    customer = await prisma.customer.create({
      data: {
        name: '2FA Setup Test Customer',
        personalEmail: `2fa-setup-${timestamp}@example.com`,
        mailboxAddress: `2fa-setup-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('ValidPassword123!'),
        status: 'active',
        twoFactorEnabled: false,
      },
    });
    token = jwt.sign({ id: customer.id, email: customer.mailboxAddress, type: 'customer' }, JWT_SECRET);
  });

  afterAll(async () => {
    if (customer?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('POST /api/security/2fa/setup returns secret, otpauthUri, and qrCodeUrl', async () => {
    const res = await request(app)
      .post('/api/security/2fa/setup')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('secret');
    expect(res.body).toHaveProperty('otpauthUri');
    expect(res.body).toHaveProperty('qrCodeUrl');
    expect(res.body.otpauthUri).toContain('otpauth://totp/');
  });

  it('POST /api/security/2fa/verify-setup fails with wrong code', async () => {
    const res = await request(app)
      .post('/api/security/2fa/verify-setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/security/2fa/verify-setup succeeds with valid TOTP code', async () => {
    const setupRes = await request(app)
      .post('/api/security/2fa/setup')
      .set('Authorization', `Bearer ${token}`);

    const validCode = generateTotp(setupRes.body.secret);
    const verifyRes = await request(app)
      .post('/api/security/2fa/verify-setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: validCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.twoFactorEnabled).toBe(true);

    const updatedInDb = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updatedInDb?.twoFactorEnabled).toBe(true);
    expect(updatedInDb?.twoFactorSecret).toBeDefined();
  });

  it('POST /api/security/2fa/disable turns off 2FA when valid current password is provided', async () => {
    const res = await request(app)
      .post('/api/security/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'ValidPassword123!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('twoFactorEnabled', false);

    const updatedInDb = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updatedInDb?.twoFactorEnabled).toBe(false);
  });
});
