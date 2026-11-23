import { Request, Response, Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { audit } from '../lib/audit';
import { purgeDummyData } from '../lib/clean-data';
import { decrypt, encrypt, generatePassword } from '../lib/crypto';
import { sendOnboardingNotice } from '../lib/mail';
import { deleteMailboxOnHostinger, findHostingerMailboxId, isProvisioningConfigured } from '../lib/hostinger';
import { LEGAL_OFFICERS } from '../lib/legal-officers';

export default (prisma: PrismaClient) => {
  const router = Router();

  // FR-4: mailbox list with usage + quota headroom.
  router.get('/', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
      const status = (req.query.status as string) || 'all';
      const search = ((req.query.search as string) || '').trim();
      const where: Prisma.CustomerWhereInput = status === 'all' ? { status: { not: 'deleted' } } : { status };
      const serviceCategory = req.query.serviceCategory ?? 'all';
      if (serviceCategory !== 'all') {
        if (typeof serviceCategory !== 'string' || !['Pendirian PT', 'Pendaftaran Merek'].includes(serviceCategory)) {
          return res.status(400).json({ error: 'Kategori layanan tidak valid' });
        }
        where.serviceCategory = serviceCategory;
      }
      const acquisitionLo = req.query.acquisitionLo ?? 'all';
      if (acquisitionLo === 'unassigned') {
        where.acquisitionLo = null;
      } else if (acquisitionLo !== 'all') {
        if (typeof acquisitionLo !== 'string' || !LEGAL_OFFICERS.includes(acquisitionLo)) {
          return res.status(400).json({ error: 'LO akuisisi tidak valid' });
        }
        where.acquisitionLo = acquisitionLo;
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { mailboxAddress: { contains: search } },
          { personalEmail: { contains: search } },
        ];
      }

      const [mailboxes, total, quotaUsed, activeTotal, inactiveTotal, coidCount, comCount, onlineCount] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true, name: true, personalEmail: true, mailboxAddress: true, serviceCategory: true,
            acquisitionLo: true,
            status: true, createdAt: true, lastLoginAt: true,
            _count: { select: { messages: true } },
          },
        }),
        prisma.customer.count({ where }),
        prisma.customer.count({ where: { status: { not: 'deleted' } } }),
        prisma.customer.count({ where: { status: 'active' } }),
        prisma.customer.count({ where: { status: 'inactive' } }),
        prisma.customer.count({ where: { status: { not: 'deleted' }, mailboxAddress: { endsWith: '@clienteasylegal.co.id' } } }),
        prisma.customer.count({ where: { status: { not: 'deleted' }, mailboxAddress: { endsWith: '@clienteasylegal.com' } } }),
        prisma.customer.count({ where: { status: { not: 'deleted' }, mailboxAddress: { endsWith: '@clienteasylegal.online' } } }),
      ]);

      const coidLimit = 100;
      const comLimit = 100;
      const onlineLimit = 100;
      let recommendedDomain = 'clienteasylegal.co.id';
      if (coidCount >= coidLimit && comCount < comLimit) {
        recommendedDomain = 'clienteasylegal.com';
      } else if (coidCount >= coidLimit && comCount >= comLimit && onlineCount < onlineLimit) {
        recommendedDomain = 'clienteasylegal.online';
      } else if (coidCount < coidLimit) {
        recommendedDomain = 'clienteasylegal.co.id';
      } else {
        recommendedDomain = comCount < onlineCount ? 'clienteasylegal.com' : 'clienteasylegal.online';
      }

      res.json({
        data: mailboxes.map(({ _count, ...m }) => ({ ...m, messageCount: _count.messages })),
        legalOfficers: LEGAL_OFFICERS,
        activeTotal,
        inactiveTotal,
        quota: {
          used: quotaUsed,
          limit: parseInt(process.env.MAILBOX_QUOTA || '300'),
          domains: {
            'clienteasylegal.co.id': { used: coidCount, limit: coidLimit, available: Math.max(0, coidLimit - coidCount), status: coidCount >= coidLimit ? 'full' : 'available' },
            'clienteasylegal.com': { used: comCount, limit: comLimit, available: Math.max(0, comLimit - comCount), status: comCount >= comLimit ? 'full' : 'available' },
            'clienteasylegal.online': { used: onlineCount, limit: onlineLimit, available: Math.max(0, onlineLimit - onlineCount), status: onlineCount >= onlineLimit ? 'full' : 'available' },
          },
          recommendedDomain,
        },
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
          acquisitionLo: true,
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

  router.patch('/:id/category', async (req: Request, res: Response) => {
    try {
      const serviceCategory = req.body?.serviceCategory;
      if (!['Pendirian PT', 'Pendaftaran Merek'].includes(serviceCategory)) {
        return res.status(400).json({ error: 'Kategori layanan tidak valid' });
      }
      const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Customer tidak ditemukan' });

      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: { serviceCategory },
        select: { id: true, serviceCategory: true },
      });
      await audit(prisma, req, 'mailbox.category', 'customer', existing.id, {
        from: existing.serviceCategory,
        to: serviceCategory,
      });
      res.json(updated);
    } catch (error) {
      console.error('Update mailbox category error:', error);
      res.status(500).json({ error: 'Gagal mengubah kategori mailbox' });
    }
  });

  router.patch('/:id/acquisition-lo', async (req: Request, res: Response) => {
    try {
      const acquisitionLo = req.body?.acquisitionLo === '' ? null : req.body?.acquisitionLo;
      if (acquisitionLo !== null && (typeof acquisitionLo !== 'string' || !LEGAL_OFFICERS.includes(acquisitionLo))) {
        return res.status(400).json({ error: 'LO akuisisi tidak valid' });
      }
      const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Customer tidak ditemukan' });
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: { acquisitionLo },
        select: { id: true, acquisitionLo: true },
      });
      await audit(prisma, req, 'mailbox.acquisition-lo', 'customer', existing.id, {
        from: existing.acquisitionLo,
        to: acquisitionLo,
      });
      res.json(updated);
    } catch (error) {
      console.error('Update acquisition LO error:', error);
      res.status(500).json({ error: 'Gagal mengubah LO akuisisi' });
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

      // 1. Sync deletion directly to Hostinger hPanel API
      if (isProvisioningConfigured()) {
        try {
          let resourceId: string | undefined = existing.mailboxResourceId ?? undefined;
          if (!resourceId) {
            resourceId = await findHostingerMailboxId(existing.mailboxAddress);
          }
          if (resourceId) {
            await deleteMailboxOnHostinger(resourceId);
            console.log(`✓ Mailbox ${existing.mailboxAddress} (${resourceId}) berhasil dihapus di Hostinger`);
          }
        } catch (hostingerError: unknown) {
          const msg = hostingerError instanceof Error ? hostingerError.message : 'Unknown error';
          console.warn(`Peringatan: Gagal menghapus mailbox di Hostinger (${existing.mailboxAddress}):`, msg);
        }
      }

      // 2. Clean associated relational data before customer deletion
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
        customer.name,
        customer.storageQuota ?? undefined
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
