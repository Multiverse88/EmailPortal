import request from 'supertest';
import app, { prisma } from '../src/app';
import { encrypt } from '../src/lib/crypto';
import { generateTotpSecret, generateTotp } from '../src/lib/totp';

describe('Customer Login 2FA Challenge and Verification Flow', () => {
  let customerWith2FA: any;
  let customerWithout2FA: any;
  let secret: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    secret = generateTotpSecret();

    customerWith2FA = await prisma.customer.create({
      data: {
        name: 'Customer With 2FA',
        personalEmail: `login-2fa-${timestamp}@example.com`,
        mailboxAddress: `login-2fa-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('Secret123!'),
        status: 'active',
        twoFactorEnabled: true,
        twoFactorSecret: encrypt(secret),
      },
    });

    customerWithout2FA = await prisma.customer.create({
      data: {
        name: 'Customer Without 2FA',
        personalEmail: `login-no2fa-${timestamp}@example.com`,
        mailboxAddress: `login-no2fa-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('Secret123!'),
        status: 'active',
        twoFactorEnabled: false,
      },
    });
  });

  afterAll(async () => {
    if (customerWith2FA?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customerWith2FA.id } });
      await prisma.customer.delete({ where: { id: customerWith2FA.id } }).catch(() => {});
    }
    if (customerWithout2FA?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customerWithout2FA.id } });
      await prisma.customer.delete({ where: { id: customerWithout2FA.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('allows direct login when 2FA is disabled', async () => {
    const res = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWithout2FA.mailboxAddress, password: 'Secret123!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.requires2FA).toBeUndefined();
  });

  it('returns challengeToken and requires2FA: true when 2FA is enabled', async () => {
    const res = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWith2FA.mailboxAddress, password: 'Secret123!' });

    expect(res.status).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body).toHaveProperty('challengeToken');
    expect(res.body.token).toBeUndefined();
  });

  it('rejects 2FA verification with invalid OTP code', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWith2FA.mailboxAddress, password: 'Secret123!' });

    const verifyRes = await request(app)
      .post('/api/auth/login/customer/2fa-verify')
      .send({ challengeToken: loginRes.body.challengeToken, code: '000000' });

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.error).toContain('Kode 2FA salah');
  });

  it('completes login upon valid 6-digit TOTP code', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWith2FA.mailboxAddress, password: 'Secret123!' });

    const validOtp = generateTotp(secret);
    const verifyRes = await request(app)
      .post('/api/auth/login/customer/2fa-verify')
      .send({ challengeToken: loginRes.body.challengeToken, code: validOtp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body).toHaveProperty('token');
    expect(verifyRes.body.user.email).toBe(customerWith2FA.mailboxAddress);

    // Verify session was created
    const session = await prisma.loginSession.findFirst({
      where: { customerId: customerWith2FA.id, isCurrent: true },
    });
    expect(session).toBeDefined();
  });
});
