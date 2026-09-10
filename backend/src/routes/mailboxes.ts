import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { audit } from '../lib/audit';
import { purgeDummyData } from '../lib/clean-data';
import { decrypt, encrypt, generatePassword } from '../lib/crypto';
import { sendOnboardingNotice } from '../lib/mail';

export default (prisma: PrismaClient) => {
  const router = Router();

  // FR-4: mailbox list with usage + quota headroom.
  router.get('/', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const status = (req.query.status as string) || 'all';
      const where = status === 'all' ? { status: { not: 'deleted' } } : { status };

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

  // FR-5: deactivate / reactivate / delete, all audited.
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
  
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Customer tidak ditemukan' });

      // Clean associated relational data before customer deletion
      await prisma.loginSession.deleteMany({ where: { customerId: id } });
      await prisma.ticketMessage.deleteMany({ where: { ticket: { customerId: id } } });
      await prisma.supportTicket.deleteMany({ where: { customerId: id } });
      await prisma.documentVersion.deleteMany({ where: { document: { customerId: id } } });
      await prisma.legalDocument.deleteMany({ where: { customerId: id } });
      await prisma.attachment.deleteMany({ where: { message: { mailboxId: id } } });
      await prisma.messageCache.deleteMany({ where: { mailboxId: id } });
      await prisma.customer.delete({ where: { id } });

      await audit(prisma, req, 'mailbox.delete', 'customer', id, {
        email: existing.mailboxAddress,
        name: existing.name,
      });

      res.json({ message: 'Mailbox berhasil dihapus', customerId: id, status: 'deleted' });
    } catch (error) {
      console.error('Delete mailbox error:', error);
      res.status(500).json({ error: 'Gagal menghapus mailbox' });
    }
  });

  router.post('/clean-dummy', async (req: Request, res: Response) => {
    try {
      const result = await purgeDummyData(prisma);
      res.json({ message: 'Semua data dan akun dummy berhasil dibersihkan!', result });
    } catch (error) {
      console.error('Clean dummy error:', error);
      res.status(500).json({ error: 'Gagal membersihkan data dummy' });
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

  // POST /api/mailboxes/:id/resend-credentials
  // Allows Superadmin and Officer to resend account info (email, password, login link) to customer's personal email
  router.post('/:id/resend-credentials', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) return res.status(404).json({ error: 'Customer tidak ditemukan' });

      // Decrypt stored password, or if unreadable, generate and save a new one
      let password = '';
      try {
        password = decrypt(customer.passwordEnc);
      } catch {
        password = generatePassword();
        await prisma.customer.update({
          where: { id: customer.id },
          data: { passwordEnc: encrypt(password) },
        });
      }

      const sendResult = await sendOnboardingNotice(
        customer.personalEmail,
        customer.mailboxAddress,
        password,
        customer.name
      );

      await audit(prisma, req, 'mailbox.resend_credentials', 'customer', id, {
        mailboxAddress: customer.mailboxAddress,
        personalEmail: customer.personalEmail,
        delivered: sendResult.delivered,
      });

      res.json({
        success: true,
        message: sendResult.delivered
          ? `Informasi akun dan kredensial berhasil dikirimkan ke email pribadi ${customer.personalEmail}`
          : `Informasi akun telah disiapkan untuk ${customer.name}. (Pengiriman email otomatis di-skip karena HOSTINGER_SMTP_PASS belum diset di .env)`,
        delivered: sendResult.delivered,
        name: customer.name,
        mailboxAddress: customer.mailboxAddress,
        personalEmail: customer.personalEmail,
        temporaryPassword: password,
      });
    } catch (error) {
      console.error('Resend credentials error:', error);
      res.status(500).json({ error: 'Gagal mengirim ulang informasi akun' });
    }
  });

  return router;
};
