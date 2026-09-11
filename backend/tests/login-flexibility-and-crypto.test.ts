import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import authRoutes from '../src/routes/auth';
import { encrypt, decrypt, verifyPassword, generatePassword } from '../src/lib/crypto';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes(prisma));

describe('Login Flexibility & Crypto Hardening Tests', () => {
  const testMailbox = `testflex_${Date.now()}@clienteasylegal.co.id`;
  const testPersonal = `personal_${Date.now()}@gmail.com`;
  const testPlainPassword = 'Rand0m!Password2026';
  let customerId: string;

  beforeAll(async () => {
    // Encrypt password using dokploy fallback key explicitly
    const testKey = createHash('sha256').update('easy-legal-portal-secret-key-2026').digest();
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', testKey, iv);
    const enc = Buffer.concat([c.update(testPlainPassword, 'utf8'), c.final()]);
    const storedDokployEnc = [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');

    const created = await prisma.customer.create({
      data: {
        name: 'PT Fleksibel Sukses',
        mailboxAddress: testMailbox,
        personalEmail: testPersonal,
        passwordEnc: storedDokployEnc,
        status: 'active',
      },
    });
    customerId = created.id;
  });

  afterAll(async () => {
    if (customerId) {
      await prisma.loginSession.deleteMany({ where: { customerId } });
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Crypto Decrypt & Verify Hardening', () => {
    it('decrypts passwords encrypted under dokploy secret key fallback', () => {
      const testKey = createHash('sha256').update('easy-legal-portal-secret-key-2026').digest();
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', testKey, iv);
      const enc = Buffer.concat([c.update('SecretDokploy123!', 'utf8'), c.final()]);
      const payload = [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');

      const result = decrypt(payload);
      expect(result).toBe('SecretDokploy123!');
    });

    it('verifies passwords with trailing/leading spaces (accidental email copy paste)', () => {
      const stored = encrypt('MySecretPass#1');
      expect(verifyPassword('MySecretPass#1', stored)).toBe(true);
      expect(verifyPassword(' MySecretPass#1', stored)).toBe(true);
      expect(verifyPassword('MySecretPass#1 ', stored)).toBe(true);
      expect(verifyPassword('  MySecretPass#1  ', stored)).toBe(true);
      expect(verifyPassword('WrongPass#1', stored)).toBe(false);
    });

    it('verifies passwords with HTML entities unescaped', () => {
      const stored = encrypt('Pass&123!');
      expect(verifyPassword('Pass&amp;123!', stored)).toBe(true);
    });

    it('generates HTML-safe passwords without entity corruption', () => {
      for (let i = 0; i < 20; i++) {
        const pwd = generatePassword();
        expect(pwd.length).toBe(16);
        expect(pwd).not.toContain('&');
        expect(pwd).not.toContain('<');
        expect(pwd).not.toContain('>');
      }
    });
  });

  describe('Customer Login Flexibility API', () => {
    it('logs in successfully using full mailbox address', async () => {
      const res = await request(app)
        .post('/api/auth/login/customer')
        .send({
          email: testMailbox,
          password: testPlainPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testMailbox);
    });

    it('logs in successfully using registered personal email', async () => {
      const res = await request(app)
        .post('/api/auth/login/customer')
        .send({
          email: testPersonal,
          password: testPlainPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testMailbox);
    });

    it('logs in successfully using localPart without domain', async () => {
      const localPart = testMailbox.split('@')[0];
      const res = await request(app)
        .post('/api/auth/login/customer')
        .send({
          email: localPart,
          password: testPlainPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testMailbox);
    });

    it('logs in successfully when password has trailing whitespace from copy-paste', async () => {
      const res = await request(app)
        .post('/api/auth/login/customer')
        .send({
          email: testMailbox,
          password: `  ${testPlainPassword}  \n`,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('returns 401 when password is incorrect', async () => {
      const res = await request(app)
        .post('/api/auth/login/customer')
        .send({
          email: testMailbox,
          password: 'CompletelyWrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Email atau password salah');
    });

    it('returns 403 when customer account is inactive or suspended', async () => {
      await prisma.customer.update({
        where: { id: customerId },
        data: { status: 'inactive' },
      });

      const res = await request(app)
        .post('/api/auth/login/customer')
        .send({
          email: testMailbox,
          password: testPlainPassword,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('tidak aktif');

      // Reset back to active
      await prisma.customer.update({
        where: { id: customerId },
        data: { status: 'active' },
      });
    });
  });
});
