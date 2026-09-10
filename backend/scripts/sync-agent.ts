import 'dotenv/config';
import os from 'node:os';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../src/lib/synology-sync';

const prisma = new PrismaClient();
const syncService = new SynologySyncService(prisma);

const API_BASE_URL = (process.env.BACKEND_API_URL || 'https://clienteasylegal.co.id').replace(/\/+$/, '');
const RUNNER_TOKEN = process.env.SYNOLOGY_RUNNER_TOKEN || 'easylegal-synology-runner-secret-2026';
const POLL_INTERVAL_MS = 10_000;
const HOSTNAME = os.hostname();

let isRunning = true;
let isBusy = false;

async function sendHeartbeatAndPoll(): Promise<boolean> {
  if (isBusy) return false;

  try {
    const status = await syncService.getStatus();
    const headers = { 'X-Runner-Secret-Token': RUNNER_TOKEN };

    const hbRes = await axios.post(
      `${API_BASE_URL}/api/storage/sync-agent/heartbeat`,
      {
        hostname: HOSTNAME,
        targetDir: status.targetPath,
        syncedCount: status.totalSyncedFiles,
      },
      { headers, timeout: 8000 }
    );

    if (hbRes.data?.hasPendingJob) {
      isBusy = true;
      console.log(`[Sync Agent] Tugas sinkronisasi terdeteksi dari cloud server...`);

      const pollRes = await axios.get(`${API_BASE_URL}/api/storage/sync-agent/poll`, {
        headers,
        timeout: 8000,
      });

      const job = pollRes.data?.job;
      if (job) {
        console.log(`[Sync Agent] Memulai pengerjaan Job #${job.id} (dryRun: ${job.dryRun})...`);
        const startTime = Date.now();
        try {
          const result = await syncService.sync({ dryRun: Boolean(job.dryRun) });
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);

          console.log(
            `[Sync Agent] Selesai dalam ${duration}s! Disalin: ${result.syncedCount}, Dilewati: ${result.skippedCount}, Gagal: ${result.failedCount}`
          );

          await axios.post(
            `${API_BASE_URL}/api/storage/sync-agent/complete`,
            {
              jobId: job.id,
              success: true,
              result,
            },
            { headers, timeout: 8000 }
          );
        } catch (syncErr: any) {
          console.error(`[Sync Agent] Gagal mengeksekusi sinkronisasi:`, syncErr.message);
          await axios.post(
            `${API_BASE_URL}/api/storage/sync-agent/complete`,
            {
              jobId: job.id,
              success: false,
              error: syncErr.message || 'Eksekusi gagal',
            },
            { headers, timeout: 8000 }
          );
        }
      }
      isBusy = false;
      return true;
    }

    return false;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.response?.status === 404) {
      console.warn(`[Sync Agent] Menghubungi ${API_BASE_URL}... (server belum merespon atau offline)`);
    } else if (err.response?.status === 401) {
      console.error(`[Sync Agent] 401 Unauthorized: Periksa kecocokan SYNOLOGY_RUNNER_TOKEN!`);
    } else {
      console.warn(`[Sync Agent] Heartbeat error:`, err.message);
    }
    isBusy = false;
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runOnce = args.includes('--once');

  console.log(`========================================================`);
  console.log(` [EasyLegal] Synology Drive Cold Storage Laptop Runner`);
  console.log(`========================================================`);
  console.log(`Server API    : ${API_BASE_URL}`);
  console.log(`Laptop Host   : ${HOSTNAME}`);
  const status = await syncService.getStatus();
  console.log(`Target Folder : ${status.targetPath}`);
  console.log(`Folder Status : ${status.isAvailable ? 'Siap' : 'Belum Terdeteksi'}`);
  console.log(`Mode          : ${runOnce ? 'One-off Check' : 'Background Daemon (Loop 10s)'}\n`);

  if (runOnce) {
    await sendHeartbeatAndPoll();
    console.log(`[Sync Agent] One-off check selesai.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`[Sync Agent] Runner aktif dan memantau tugas dari akun Super Admin... (Tekan Ctrl+C untuk keluar)`);

  // Initial heartbeat
  await sendHeartbeatAndPoll();

  const interval = setInterval(async () => {
    if (!isRunning) return;
    await sendHeartbeatAndPoll();
  }, POLL_INTERVAL_MS);

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
      console.log(`\n[Sync Agent] Menghentikan runner secara aman...`);
      isRunning = false;
      clearInterval(interval);
      await prisma.$disconnect();
      process.exit(0);
    });
  }
}

main().catch((e) => {
  console.error('[Sync Agent] Fatal runner error:', e);
  process.exit(1);
});
