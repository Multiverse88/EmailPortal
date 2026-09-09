import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import {
  encrypt,
  verifyPassword,
  validatePasswordStrength,
  generatePassword,
} from '../lib/crypto';
import { sendOnboardingNotice } from '../lib/mail';
import { audit } from '../lib/audit';
import { authenticateAdmin, authenticateCustomer, authenticateOfficerOrAdmin, UserRole } from '../middleware/auth';
import {
  isMailApiConfigured,
  isProvisioningConfigured,
  resolveResourceId,
  resolveOrderResourceId,
  createMailboxOnHostinger,
  changeMailboxPasswordOnHostinger,
} from '../lib/hostinger';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const sign = (id: string, email: string, type: 'customer' | 'admin', role?: UserRole) =>
  jwt.sign({ id, email, type, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

function parseClientInfo(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Unknown Device';
  
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipad/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/macintosh|windows|linux/i.test(ua)) {
    deviceType = 'laptop';
  }

  let browser = 'Browser Web';
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';

  return { ipAddress, deviceName: `${browser} on ${deviceType}`, deviceType, browser, location: 'Indonesia' };
}

// FR-8: brute-force guard on the login endpoints only.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT || '10'),
  message: { error: 'Terlalu banyak percobaan login, coba lagi nanti' },
  standardHeaders: true,
  legacyHeaders: false,
});

export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/login/customer', loginLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

      const customer = await prisma.customer.findUnique({ where: { mailboxAddress: email } });
      if (!customer || customer.status !== 'active' || !verifyPassword(password, customer.passwordEnc)) {
        return res.status(401).json({ error: 'Email atau password salah' });
      }

      await prisma.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } });

      const clientInfo = parseClientInfo(req);
      await prisma.loginSession.updateMany({
        where: { customerId: customer.id },
        data: { isCurrent: false },
      });
      await prisma.loginSession.create({
        data: {
          customerId: customer.id,
          deviceName: clientInfo.deviceName,
          deviceType: clientInfo.deviceType,
          browser: clientInfo.browser,
          ipAddress: clientInfo.ipAddress,
          location: clientInfo.location,
          isCurrent: true,
          lastActiveAt: new Date(),
        },
      });

      res.json({
        token: sign(customer.id, customer.mailboxAddress, 'customer', 'customer'),
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.mailboxAddress,
          type: 'customer',
          role: 'customer',
          avatarUrl: customer.avatarUrl,
          storageQuota: customer.storageQuota,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/login/admin', loginLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

      const admin = await prisma.adminUser.findUnique({ where: { email } });
      if (!admin || !admin.isActive || !(await bcrypt.compare(password, admin.passwordHash))) {
        return res.status(401).json({ error: 'Email atau password salah' });
      }

      await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
      res.json({
        token: sign(admin.id, admin.email, 'admin', admin.role as UserRole),
        user: { id: admin.id, name: admin.name, email: admin.email, type: 'admin', role: admin.role },
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // FR-1..FR-3, FR-6: admin-only mailbox provisioning (Officer or Admin).
  router.post('/register', authenticateOfficerOrAdmin, async (req: Request, res: Response) => {
    try {
      const { name, personalEmail, localPart } = req.body ?? {};
      if (!name || !personalEmail || !localPart) {
        return res.status(400).json({ error: 'Nama, email pribadi, dan local part wajib diisi' });
      }
      if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(localPart)) {
        return res.status(400).json({ error: 'Local part tidak valid (huruf, angka, . _ -)' });
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(personalEmail)) {
        return res.status(400).json({ error: 'Email pribadi tidak valid' });
      }

      // FR-2: refuse before hitting the mail provider when the plan is full.
      const quota = parseInt(process.env.MAILBOX_QUOTA || '100');
      const used = await prisma.customer.count({ where: { status: { not: 'deleted' } } });
      if (used >= quota) {
        return res.status(409).json({ error: `Kuota mailbox penuh (${used}/${quota}). Upgrade paket dulu.` });
      }

      const domain = process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id';
      const mailboxAddress = `${localPart.toLowerCase()}@${domain}`;

      if (await prisma.customer.findUnique({ where: { mailboxAddress } })) {
        return res.status(409).json({ error: 'Alamat email sudah dipakai' });
      }
      if (await prisma.customer.findUnique({ where: { personalEmail } })) {
        return res.status(409).json({ error: 'Email pribadi sudah terdaftar' });
      }

      const tempPassword = generatePassword();
      const customer = await prisma.customer.create({
        data: { name, personalEmail, mailboxAddress, passwordEnc: encrypt(tempPassword), status: 'active' },
      });

      // ─── Real provisioning via hPanel API ──────────────────────────────
      // Creates the mailbox on Hostinger so it can actually send/receive.
      // Falls back to the old warn-and-continue behavior when no token.
      if (isProvisioningConfigured()) {
        try {
          // orderId comes from the Mail API /v1/me when available; otherwise
          // it must be provided via env (hPanel → Email → API).
          const orderId = process.env.HOSTINGER_ORDER_ID
            || await resolveOrderResourceId().catch(() => undefined);
          if (!orderId) {
            throw new Error('Order ID Hostinger tidak ditemukan. Cantumkan HOSTINGER_ORDER_ID di backend/.env atau pastikan token memiliki akses ke order email.');
          } else {
            const mailbox = await createMailboxOnHostinger(orderId, localPart.toLowerCase(), tempPassword);
            await prisma.customer.update({
              where: { id: customer.id },
              data: { mailboxResourceId: mailbox.id },
            });
          }
        } catch (e: any) {
          const msg = e?.response?.data?.message || (e as Error).message;
          console.error(`register: Hostinger provisioning failed for ${mailboxAddress}:`, msg);
          // Roll back the DB record so a failed provisioning does not leave
          // a customer that can log in to a mailbox that does not exist.
          await prisma.customer.delete({ where: { id: customer.id } });
          const conflict = e?.response?.status === 409 || /exists|already/i.test(msg);
          return res.status(conflict ? 409 : 502).json({
            error: conflict
              ? 'Alamat email sudah ada di Hostinger'
              : `Provisioning Hostinger gagal: ${msg}`,
          });
        }
      }

      // Link to Hostinger Mail API resourceId if the API token is configured.
      // ponytail: real provisioning (creating the mailbox on Hostinger) happens
      // in hPanel; this SDK covers mail operations, not mailbox creation.
      if (isMailApiConfigured()) {
        try {
          const resourceId = await resolveResourceId(mailboxAddress);
          if (resourceId) {
            await prisma.customer.update({ where: { id: customer.id }, data: { mailboxResourceId: resourceId } });
          } else {
            console.warn(`register: ${mailboxAddress} not visible via Mail API yet (still provisioning in hPanel)`);
          }
        } catch (e) {
          console.warn('register: resourceId lookup failed:', (e as Error).message);
        }
      }

      try {
        await sendOnboardingNotice(personalEmail, mailboxAddress);
      } catch (noticeErr) {
        console.warn('register: onboarding notice failed:', (noticeErr as Error).message);
      }
      await audit(prisma, req, 'mailbox.create', 'customer', customer.id, { mailboxAddress });

      res.status(201).json({
        customerId: customer.id,
        mailboxAddress,
        temporaryPassword: tempPassword, // shown once; admin relays via WA/telepon
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Gagal membuat mailbox' });
    }
  });

  // FR-9/FR-10: customer changes own password, current password required.
  router.post('/change-password', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body ?? {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
      }

      const customer = await prisma.customer.findUnique({ where: { id: req.user!.id } });
      if (!customer) return res.status(404).json({ error: 'Mailbox tidak ditemukan' });
      // 400, not 401: the bearer token is valid, the submitted field is wrong.
      // A 401 here would trip the client's "session expired" handler.
      if (!verifyPassword(currentPassword, customer.passwordEnc)) {
        return res.status(400).json({ error: 'Password saat ini salah' });
      }

      const weak = validatePasswordStrength(newPassword);
      if (weak) return res.status(400).json({ error: weak });

      if (customer.mailboxResourceId && isProvisioningConfigured()) {
        try {
          await changeMailboxPasswordOnHostinger(customer.mailboxResourceId, newPassword);
        } catch (hErr: any) {
          const hMsg = hErr?.response?.data?.message || (hErr as Error).message;
          console.error('change-password Hostinger update failed:', hMsg);
          return res.status(502).json({
            error: `Gagal memperbarui password di Hostinger: ${hMsg}`,
          });
        }
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordEnc: encrypt(newPassword) },
      });
      res.json({ message: 'Password berhasil diubah' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/me', authenticateCustomer, async (req: Request, res: Response) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, mailboxAddress: true, personalEmail: true, status: true },
    });
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(customer);
  });

  return router;
};
