import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';

export default (prisma: PrismaClient) => {
  const router = Router();

  // GET /api/security/sessions - list active sessions for current customer
  router.get('/sessions', async (req: Request, res: Response) => {
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
  router.post('/2fa/toggle', async (req: Request, res: Response) => {
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
  router.post('/sessions/terminate-others', async (req: Request, res: Response) => {
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

  return router;
};
