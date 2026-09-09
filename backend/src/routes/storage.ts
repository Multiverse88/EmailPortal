import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../lib/synology-sync';
import { authenticateSuperAdmin, authenticateAdmin } from '../middleware/auth';

export default (prisma: PrismaClient) => {
  const router = Router();
  const syncService = new SynologySyncService(prisma);

  // GET /api/storage/synology-status (Admin and Superadmin)
  router.get('/synology-status', authenticateAdmin, async (_req: Request, res: Response) => {
    try {
      const status = await syncService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Synology status error:', error);
      res.status(500).json({ error: 'Gagal memeriksa status Synology Drive' });
    }
  });

  // POST /api/storage/sync-synology (Superadmin ONLY)
  router.post('/sync-synology', authenticateSuperAdmin, async (req: Request, res: Response) => {
    try {
      const dryRun = Boolean(req.body?.dryRun);
      const result = await syncService.sync({ dryRun });
      res.json(result);
    } catch (error) {
      console.error('Synology sync error:', error);
      res.status(500).json({ error: 'Gagal menyinkronkan data ke Synology Drive' });
    }
  });

  // POST /api/storage/init-synology-folder (Superadmin ONLY)
  router.post('/init-synology-folder', authenticateSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const success = syncService.initTargetFolder();
      const status = await syncService.getStatus();
      res.json({ success, status });
    } catch (error) {
      console.error('Init folder error:', error);
      res.status(500).json({ error: 'Gagal menginisialisasi folder Synology' });
    }
  });

  // GET /api/storage/overview (Superadmin ONLY: Master Storage Inspector)
  router.get('/overview', authenticateSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const customers = await prisma.customer.findMany({
        where: { status: { not: 'deleted' } },
        include: {
          documents: { select: { size: true } },
          messages: {
            include: {
              attachments: { select: { size: true } },
            },
          },
        },
      });

      let totalStorageUsedBytes = 0;
      let totalStorageQuotaBytes = 0;

      const accountStorageList = customers.map((cust) => {
        const docBytes = cust.documents.reduce((acc, d) => acc + (d.size || 0), 0);
        const attachBytes = cust.messages.reduce(
          (acc, m) => acc + m.attachments.reduce((sum, a) => sum + (a.size || 0), 0),
          0
        );
        const usedBytes = docBytes + attachBytes;
        const quotaBytes = cust.storageQuota || 5368709120;
        const percentUsed = Math.min(100, Number(((usedBytes / quotaBytes) * 100).toFixed(1)));

        totalStorageUsedBytes += usedBytes;
        totalStorageQuotaBytes += quotaBytes;

        return {
          id: cust.id,
          name: cust.name,
          mailboxAddress: cust.mailboxAddress,
          personalEmail: cust.personalEmail,
          status: cust.status,
          usedBytes,
          quotaBytes,
          percentUsed,
          warningExceeded80: percentUsed >= 80,
        };
      });

      const synologyStatus = await syncService.getStatus();

      res.json({
        totalStorageUsedBytes,
        totalStorageQuotaBytes,
        totalAccounts: customers.length,
        synology: synologyStatus,
        accounts: accountStorageList,
      });
    } catch (error) {
      console.error('Storage overview error:', error);
      res.status(500).json({ error: 'Gagal memuat ringkasan penyimpanan' });
    }
  });

  return router;
};
