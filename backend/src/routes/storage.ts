import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../lib/synology-sync';
import { authenticateSuperAdmin, authenticateAdmin } from '../middleware/auth';

interface SyncJob {
  id: string;
  requestedBy: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  dryRun: boolean;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: {
    syncedCount: number;
    skippedCount: number;
    failedCount: number;
    totalBytesCopied: number;
    errors?: Array<{ path: string; error: string }>;
  };
  error?: string;
}

interface RunnerState {
  lastHeartbeat: Date | null;
  hostname: string | null;
  targetDir: string | null;
  syncedCount: number;
}

let runnerState: RunnerState = {
  lastHeartbeat: null,
  hostname: null,
  targetDir: null,
  syncedCount: 0,
};

let syncJobs: SyncJob[] = [];

function isRunnerOnline(): boolean {
  if (!runnerState.lastHeartbeat) return false;
  const elapsedSeconds = (Date.now() - runnerState.lastHeartbeat.getTime()) / 1000;
  return elapsedSeconds < 30;
}

function authenticateRunner(req: Request, res: Response, next: () => void) {
  const token = req.headers['x-runner-secret-token'];
  const expected = process.env.SYNOLOGY_RUNNER_TOKEN || 'easylegal-synology-runner-secret-2026';
  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized runner token' });
  }
  next();
}

export default (prisma: PrismaClient) => {
  const router = Router();
  const syncService = new SynologySyncService(prisma);

  // ─── RUNNER AGENT & QUEUE ENDPOINTS ──────────────────────────────

  // GET /api/storage/sync-agent/status (Admin and Superadmin)
  router.get('/sync-agent/status', authenticateAdmin, async (_req: Request, res: Response) => {
    const elapsedSeconds = runnerState.lastHeartbeat
      ? Math.round((Date.now() - runnerState.lastHeartbeat.getTime()) / 1000)
      : null;
    const activeJob = syncJobs.find((j) => j.status === 'PENDING' || j.status === 'RUNNING') || null;

    res.json({
      isOnline: isRunnerOnline(),
      lastSeenSecondsAgo: elapsedSeconds,
      hostname: runnerState.hostname,
      targetDir: runnerState.targetDir,
      activeJob,
    });
  });

  // POST /api/storage/sync-queue (Superadmin ONLY: Request Laptop Sync)
  router.post('/sync-queue', authenticateSuperAdmin, async (req: Request, res: Response) => {
    try {
      const runningJob = syncJobs.find((j) => j.status === 'RUNNING');
      if (runningJob) {
        return res.status(409).json({ error: 'Sinkronisasi sedang berlangsung di laptop', jobId: runningJob.id });
      }

      const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const job: SyncJob = {
        id: jobId,
        requestedBy: (req.user as any)?.email || 'superadmin',
        status: 'PENDING',
        dryRun: Boolean(req.body?.dryRun),
        createdAt: new Date(),
      };

      syncJobs.unshift(job);
      if (syncJobs.length > 20) syncJobs.length = 20;

      res.status(202).json({
        success: true,
        jobId,
        message: 'Tugas sinkronisasi dimasukkan ke antrean runner laptop',
      });
    } catch (error) {
      console.error('Sync queue request error:', error);
      res.status(500).json({ error: 'Gagal memasukkan tugas sinkronisasi ke antrean' });
    }
  });

  // GET /api/storage/sync-queue/status/:jobId (Superadmin ONLY)
  router.get('/sync-queue/status/:jobId', authenticateSuperAdmin, async (req: Request, res: Response) => {
    const job = syncJobs.find((j) => j.id === req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Tugas sinkronisasi tidak ditemukan' });
    }
    res.json(job);
  });

  // POST /api/storage/sync-agent/heartbeat (Runner ONLY)
  router.post('/sync-agent/heartbeat', authenticateRunner, (req: Request, res: Response) => {
    runnerState = {
      lastHeartbeat: new Date(),
      hostname: req.body?.hostname || 'fedora-laptop',
      targetDir: req.body?.targetDir || null,
      syncedCount: Number(req.body?.syncedCount || 0),
    };
    const hasPendingJob = syncJobs.some((j) => j.status === 'PENDING');
    res.json({ acknowledged: true, hasPendingJob });
  });

  // GET /api/storage/sync-agent/poll (Runner ONLY)
  router.get('/sync-agent/poll', authenticateRunner, (_req: Request, res: Response) => {
    const pendingJob = syncJobs.find((j) => j.status === 'PENDING');
    if (!pendingJob) {
      return res.json({ job: null });
    }
    pendingJob.status = 'RUNNING';
    pendingJob.startedAt = new Date();
    res.json({ job: pendingJob });
  });

  // POST /api/storage/sync-agent/complete (Runner ONLY)
  router.post('/sync-agent/complete', authenticateRunner, (req: Request, res: Response) => {
    const { jobId, success, result, error } = req.body ?? {};
    const job = syncJobs.find((j) => j.id === jobId);
    if (job) {
      job.status = success ? 'COMPLETED' : 'FAILED';
      job.completedAt = new Date();
      job.result = result;
      job.error = error;
    }
    res.json({ acknowledged: true });
  });

  // ─── LEGACY DIRECT SERVER SYNC ENDPOINTS ─────────────────────────

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
