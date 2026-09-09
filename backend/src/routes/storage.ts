import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../lib/synology-sync';

export default (prisma: PrismaClient) => {
  const router = Router();
  const syncService = new SynologySyncService(prisma);

  // GET /api/storage/synology-status
  router.get('/synology-status', async (_req: Request, res: Response) => {
    try {
      const status = await syncService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Synology status error:', error);
      res.status(500).json({ error: 'Gagal memeriksa status Synology Drive' });
    }
  });

  // POST /api/storage/sync-synology
  router.post('/sync-synology', async (req: Request, res: Response) => {
    try {
      const dryRun = Boolean(req.body?.dryRun);
      const result = await syncService.sync({ dryRun });
      res.json(result);
    } catch (error) {
      console.error('Synology sync error:', error);
      res.status(500).json({ error: 'Gagal menyinkronkan data ke Synology Drive' });
    }
  });

  // POST /api/storage/init-synology-folder
  router.post('/init-synology-folder', async (_req: Request, res: Response) => {
    try {
      const success = syncService.initTargetFolder();
      const status = await syncService.getStatus();
      res.json({ success, status });
    } catch (error) {
      console.error('Init folder error:', error);
      res.status(500).json({ error: 'Gagal menginisialisasi folder Synology' });
    }
  });

  return router;
};
