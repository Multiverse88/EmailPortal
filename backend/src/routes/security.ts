import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateCustomer, authenticateSuperAdmin } from '../middleware/auth';

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

  // POST /api/security/2fa/toggle - toggle or explicitly set 2FA status
  router.post('/2fa/toggle', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, twoFactorEnabled: true },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const nextStatus =
        typeof req.body?.enabled === 'boolean'
          ? req.body.enabled
          : !customer.twoFactorEnabled;

      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: { twoFactorEnabled: nextStatus },
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
