import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateCustomer, authenticateSuperAdmin } from '../middleware/auth';
import { encrypt, decrypt, verifyPassword } from '../lib/crypto';
import { generateTotpSecret, generateTotpUri, verifyTotp } from '../lib/totp';

export default (prisma: PrismaClient) => {
  const router = Router();

  // GET /api/security/sessions - list active sessions for current customer
  router.get('/sessions', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const sessions = await prisma.loginSession.findMany({
        where: { customerId },
        orderBy: [{ isCurrent: 'desc' }, { lastActiveAt: 'desc' }],
      });
      res.json({ sessions });
    } catch (error) {
      console.error('List sessions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/security/2fa/setup - generate new TOTP secret & QR code uri for configuration
  router.post('/2fa/setup', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, mailboxAddress: true },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const secret = generateTotpSecret();
      const encryptedSecret = encrypt(secret);

      await prisma.customer.update({
        where: { id: customerId },
        data: { twoFactorSecret: encryptedSecret },
      });

      const otpauthUri = generateTotpUri(customer.mailboxAddress, secret, 'EasyLegal');
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`;

      res.json({
        secret,
        otpauthUri,
        qrCodeUrl,
      });
    } catch (error) {
      console.error('2FA setup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/security/2fa/verify-setup - verify user has correctly entered TOTP code before activating
  router.post('/2fa/verify-setup', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Kode verifikasi 6 digit diperlukan' });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, twoFactorSecret: true },
      });

      if (!customer || !customer.twoFactorSecret) {
        return res.status(400).json({ error: 'Konfigurasi 2FA belum dimulai. Silakan buat kode QR terlebih dahulu.' });
      }

      let secret: string;
      try {
        secret = decrypt(customer.twoFactorSecret);
      } catch (err) {
        return res.status(500).json({ error: 'Gagal mendekripsi kunci rahasia 2FA' });
      }

      const isValid = verifyTotp(code, secret);
      if (!isValid) {
        return res.status(400).json({ error: 'Kode verifikasi 2FA tidak valid atau telah kedaluwarsa' });
      }

      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: { twoFactorEnabled: true },
        select: { twoFactorEnabled: true },
      });

      res.json({
        success: true,
        twoFactorEnabled: updated.twoFactorEnabled,
        message: 'Autentikasi 2 faktor berhasil diaktifkan',
      });
    } catch (error) {
      console.error('2FA verify setup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/security/2fa/disable - safely disable 2FA with current password confirmation
  router.post('/2fa/disable', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const { currentPassword } = req.body;

      if (!currentPassword) {
        return res.status(400).json({ error: 'Kata sandi saat ini diperlukan untuk menonaktifkan 2FA' });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, passwordEnc: true },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      if (!verifyPassword(currentPassword, customer.passwordEnc)) {
        return res.status(400).json({ error: 'Kata sandi salah' });
      }

      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: { twoFactorEnabled: false },
        select: { twoFactorEnabled: true },
      });

      res.json({
        success: true,
        twoFactorEnabled: updated.twoFactorEnabled,
        message: 'Autentikasi 2 faktor dinonaktifkan',
      });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/security/2fa/toggle - toggle or explicitly set 2FA status (backward compatible)
  router.post('/2fa/toggle', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, twoFactorEnabled: true, twoFactorSecret: true },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const nextStatus =
        typeof req.body?.enabled === 'boolean'
          ? req.body.enabled
          : !customer.twoFactorEnabled;

      const updateData: { twoFactorEnabled: boolean; twoFactorSecret?: string } = {
        twoFactorEnabled: nextStatus,
      };

      if (nextStatus && !customer.twoFactorSecret) {
        const generatedSecret = generateTotpSecret();
        updateData.twoFactorSecret = encrypt(generatedSecret);
      }

      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: updateData,
        select: { twoFactorEnabled: true },
      });

      res.json({ twoFactorEnabled: updated.twoFactorEnabled });
    } catch (error) {
      console.error('Toggle 2FA error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/security/sessions/terminate-others - delete non-current sessions
  router.post('/sessions/terminate-others', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const result = await prisma.loginSession.deleteMany({
        where: {
          customerId,
          isCurrent: false,
        },
      });

      res.json({
        message: 'Other sessions terminated successfully',
        terminatedCount: result.count,
      });
    } catch (error) {
      console.error('Terminate other sessions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Super Admin Security Radar Endpoints ──────────────────────────────

  // GET /api/security/admin/radar - global radar across all customer accounts
  router.get('/admin/radar', authenticateSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const customers = await prisma.customer.findMany({
        where: { status: { not: 'deleted' } },
        select: {
          id: true,
          name: true,
          mailboxAddress: true,
          personalEmail: true,
          status: true,
          lastLoginAt: true,
          sessions: {
            orderBy: { lastActiveAt: 'desc' },
          },
        },
      });

      let totalActiveSessions = 0;
      let multiIpAlertCount = 0;

      const accountReports = customers.map((c) => {
        const activeSessions = c.sessions;
        const uniqueIps = Array.from(new Set(activeSessions.map((s) => s.ipAddress)));
        const isMultiIpAlert = uniqueIps.length > 1;

        totalActiveSessions += activeSessions.length;
        if (isMultiIpAlert) multiIpAlertCount++;

        return {
          id: c.id,
          name: c.name,
          mailboxAddress: c.mailboxAddress,
          personalEmail: c.personalEmail,
          status: c.status,
          lastLoginAt: c.lastLoginAt,
          activeSessionsCount: activeSessions.length,
          uniqueIps,
          isMultiIpAlert,
          sessions: activeSessions,
        };
      });

      // Sort accounts: multi-IP alert first, active sessions next (most recent first), inactive last
      accountReports.sort((a, b) => {
        if (a.isMultiIpAlert && !b.isMultiIpAlert) return -1;
        if (!a.isMultiIpAlert && b.isMultiIpAlert) return 1;

        if (a.activeSessionsCount > 0 && b.activeSessionsCount === 0) return -1;
        if (a.activeSessionsCount === 0 && b.activeSessionsCount > 0) return 1;

        const aLast = a.sessions[0]?.lastActiveAt ? new Date(a.sessions[0].lastActiveAt).getTime() : 0;
        const bLast = b.sessions[0]?.lastActiveAt ? new Date(b.sessions[0].lastActiveAt).getTime() : 0;
        return bLast - aLast;
      });

      res.json({
        summary: {
          totalAccounts: customers.length,
          totalActiveSessions,
          multiIpAlertCount,
        },
        accounts: accountReports,
      });
    } catch (error) {
      console.error('Admin radar error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/security/admin/sessions/:sessionId/terminate
  router.post('/admin/sessions/:sessionId/terminate', authenticateSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      await prisma.loginSession.delete({ where: { id: sessionId } });
      res.json({ message: 'Sesi berhasil diputuskan' });
    } catch (error) {
      console.error('Terminate session error:', error);
      res.status(500).json({ error: 'Gagal memutuskan sesi' });
    }
  });

  // POST /api/security/admin/accounts/:customerId/terminate-all
  router.post('/admin/accounts/:customerId/terminate-all', authenticateSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const result = await prisma.loginSession.deleteMany({ where: { customerId } });
      res.json({ message: 'Seluruh sesi akun berhasil diputuskan', terminatedCount: result.count });
    } catch (error) {
      console.error('Terminate all customer sessions error:', error);
      res.status(500).json({ error: 'Gagal memutuskan sesi akun' });
    }
  });

  return router;
};
