import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { audit } from '../lib/audit';
import { seedDemoData } from '../lib/demo-data';

export default (prisma: PrismaClient) => {
  const router = Router();

  // FR-4: mailbox list with usage + quota headroom.
  router.get('/', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const status = (req.query.status as string) || 'all';
      const where = status === 'all' ? {} : { status };

      const [mailboxes, total, quotaUsed] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, personalEmail: true, mailboxAddress: true,
            status: true, createdAt: true, lastLoginAt: true,
            _count: { select: { messages: true } },
          },
        }),
        prisma.customer.count({ where }),
        prisma.customer.count({ where: { status: { not: 'deleted' } } }),
      ]);

      res.json({
        data: mailboxes.map(({ _count, ...m }) => ({ ...m, messageCount: _count.messages })),
        quota: { used: quotaUsed, limit: parseInt(process.env.MAILBOX_QUOTA || '100') },
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
    } catch (error) {
      console.error('List mailboxes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
        select: {
          id: true, name: true, personalEmail: true, mailboxAddress: true,
          status: true, createdAt: true, lastLoginAt: true,
          messages: { take: 50, orderBy: { receivedAt: 'desc' } },
        },
      });
      if (!customer) return res.status(404).json({ error: 'Customer tidak ditemukan' });
      res.json(customer);
    } catch (error) {
      console.error('Get mailbox error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // FR-5: deactivate / reactivate / soft-delete, all audited.
  const setStatus = (status: string, action: string, message: string) =>
    async (req: Request, res: Response) => {
      try {
        const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Customer tidak ditemukan' });

        await prisma.customer.update({ where: { id: req.params.id }, data: { status } });
        await audit(prisma, req, action, 'customer', req.params.id, {
          from: existing.status,
          to: status,
        });
        res.json({ message, customerId: req.params.id, status });
      } catch (error) {
        console.error(`${action} error:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };

  router.post('/:id/deactivate', setStatus('inactive', 'mailbox.deactivate', 'Mailbox dinonaktifkan'));
  router.post('/:id/reactivate', setStatus('active', 'mailbox.reactivate', 'Mailbox diaktifkan'));
  router.delete('/:id', setStatus('deleted', 'mailbox.delete', 'Mailbox dihapus'));

  router.post('/seed-demo', async (req: Request, res: Response) => {
    try {
      const result = await seedDemoData(prisma);
      const newAdmin = await prisma.adminUser.findUnique({ where: { email: result.adminEmail } });
      if (newAdmin) {
        await prisma.auditLog.create({
          data: {
            actorId: newAdmin.id,
            action: 'system.seed_demo',
            targetType: 'system',
            details: JSON.stringify({ triggeredBy: req.user?.email, ...result }),
            ipAddress: req.ip,
            userAgent: (req.headers['user-agent'] as string) || null,
          },
        });
      }
      res.json({ message: 'Data demo berhasil dimuat ulang!', result });
    } catch (error) {
      console.error('Seed demo error:', error);
      res.status(500).json({ error: 'Gagal memuat data demo' });
    }
  });

  router.get('/audit/logs', async (_req: Request, res: Response) => {
    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { name: true, email: true } } },
    });
    res.json({ data: logs });
  });

  return router;
};
