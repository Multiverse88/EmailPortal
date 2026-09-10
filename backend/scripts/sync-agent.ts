import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import axios from 'axios';

const API_BASE_URL = (process.env.BACKEND_API_URL || 'https://clienteasylegal.co.id').replace(/\/+$/, '');
const RUNNER_TOKEN = process.env.SYNOLOGY_RUNNER_TOKEN || 'easylegal-synology-runner-secret-2026';
const POLL_INTERVAL_MS = 10_000;
const HOSTNAME = os.hostname();

const TARGET_DIR =
  process.env.SYNOLOGY_DIR ||
  path.join(process.env.HOME || '/home/fullstackiteasylegal', 'SynologyDrive', 'EmailPortal_ColdStorage');

interface SyncManifest {
  lastSyncAt: string | null;
  files: Record<string, { size: number; syncedAt: string; account?: string; docId?: string }>;
}

function getManifestPath(): string {
  return path.join(TARGET_DIR, '.sync-manifest.json');
}

function readLocalManifest(): SyncManifest {
  const p = getManifestPath();
  if (!fs.existsSync(p)) {
    return { lastSyncAt: null, files: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { lastSyncAt: null, files: {} };
  }
}

function writeLocalManifest(manifest: SyncManifest): void {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.writeFileSync(getManifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
}

function initTargetFolder(): boolean {
  try {
    if (!fs.existsSync(TARGET_DIR)) {
      fs.mkdirSync(TARGET_DIR, { recursive: true });
    }
    const accountsDir = path.join(TARGET_DIR, 'accounts');
    if (!fs.existsSync(accountsDir)) {
      fs.mkdirSync(accountsDir, { recursive: true });
    }
    return true;
  } catch (err: any) {
    console.warn('[Sync Agent] Warning: Gagal menginisialisasi target folder:', err.message);
    return false;
  }
}

let isRunning = true;
let isBusy = false;

async function sendHeartbeatAndPoll(): Promise<boolean> {
  if (isBusy) return false;

  try {
    initTargetFolder();
    const localManifest = readLocalManifest();
    const syncedCount = Object.keys(localManifest.files).length;
    const headers = { 'X-Runner-Secret-Token': RUNNER_TOKEN };

    const hbRes = await axios.post(
      `${API_BASE_URL}/api/storage/sync-agent/heartbeat`,
      {
        hostname: HOSTNAME,
        targetDir: TARGET_DIR,
        syncedCount,
      },
      { headers, timeout: 8000 }
    );

    if (hbRes.data?.hasPendingJob) {
      isBusy = true;
      console.log(`[Sync Agent] Tugas sinkronisasi terdeteksi dari cloud server...`);

      const pollRes = await axios.get(`${API_BASE_URL}/api/storage/sync-agent/poll`, {
        headers,
        timeout: 15000,
      });

      const { job, manifest } = pollRes.data || {};
      if (job) {
        console.log(`[Sync Agent] Memulai pengerjaan Job #${job.id} (dryRun: ${job.dryRun})...`);
        const startTime = Date.now();

        const accounts = manifest?.accounts || [];
        const files = manifest?.files || [];
        console.log(`[Sync Agent] Manifest cloud: ${accounts.length} akun, ${files.length} berkas.`);

        const result = {
          syncedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          totalBytesCopied: 0,
          errors: [] as Array<{ path: string; error: string }>,
        };

        // 1. Tulis account-info.json untuk setiap akun customer
        if (!job.dryRun) {
          for (const acc of accounts) {
            try {
              const accFolder = path.join(TARGET_DIR, 'accounts', acc.accountFolder);
              fs.mkdirSync(accFolder, { recursive: true });
              const infoPath = path.join(accFolder, 'account-info.json');
              fs.writeFileSync(infoPath, JSON.stringify(acc.info, null, 2), 'utf8');
            } catch (err: any) {
              console.warn(`[Sync Agent] Gagal menulis metadata ${acc.accountFolder}:`, err.message);
            }
          }
        }

        // 2. Download / Verifikasi berkas
        for (const file of files) {
          const destPath = path.join(TARGET_DIR, file.relPath);

          // Cek jika berkas lokal sudah ada dan ukurannya sama
          if (fs.existsSync(destPath)) {
            const stats = fs.statSync(destPath);
            if (stats.size === file.size && localManifest.files[file.relPath]) {
              result.skippedCount++;
              continue;
            }
          }

          if (job.dryRun) {
            result.syncedCount++;
            result.totalBytesCopied += file.size || 0;
            continue;
          }

          try {
            console.log(
              `[Sync Agent] Mengunduh: ${file.relPath} (${((file.size || 0) / (1024 * 1024)).toFixed(2)} MB)...`
            );
            fs.mkdirSync(path.dirname(destPath), { recursive: true });

            const dlRes = await axios.get(
              `${API_BASE_URL}/api/storage/sync-agent/download/${file.type}/${file.id}`,
              {
                headers,
                responseType: 'arraybuffer',
                timeout: 120000,
              }
            );

            const buffer = Buffer.from(dlRes.data);
            fs.writeFileSync(destPath, buffer);

            localManifest.files[file.relPath] = {
              size: buffer.length,
              syncedAt: new Date().toISOString(),
              account: file.accountFolder,
              docId: file.id,
            };

            result.syncedCount++;
            result.totalBytesCopied += buffer.length;
            console.log(`[Sync Agent] Berhasil disimpan ke Synology: ${file.relPath}`);
          } catch (dlErr: any) {
            console.error(`[Sync Agent] Gagal mengunduh ${file.relPath}:`, dlErr.message);
            result.failedCount++;
            result.errors.push({ path: file.relPath, error: dlErr.message || 'Download failed' });
          }
        }

        if (!job.dryRun) {
          localManifest.lastSyncAt = new Date().toISOString();
          writeLocalManifest(localManifest);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `[Sync Agent] Selesai dalam ${duration}s! Disalin: ${result.syncedCount}, Dilewati: ${result.skippedCount}, Gagal: ${result.failedCount}, Total: ${(result.totalBytesCopied / (1024 * 1024)).toFixed(2)} MB`
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

  initTargetFolder();
  const manifest = readLocalManifest();

  console.log(`========================================================`);
  console.log(` [EasyLegal] Synology Drive Cold Storage Laptop Runner`);
  console.log(`========================================================`);
  console.log(`Server API    : ${API_BASE_URL}`);
  console.log(`Laptop Host   : ${HOSTNAME}`);
  console.log(`Target Folder : ${TARGET_DIR}`);
  console.log(`Folder Status : ${fs.existsSync(TARGET_DIR) ? 'Siap' : 'Belum Terdeteksi'}`);
  console.log(`File Tersimpan: ${Object.keys(manifest.files).length}`);
  console.log(`Mode          : ${runOnce ? 'One-off Check' : 'Background Daemon (Loop 10s)'}\n`);

  if (runOnce) {
    await sendHeartbeatAndPoll();
    console.log(`[Sync Agent] One-off check selesai.`);
    process.exit(0);
  }

  console.log(`[Sync Agent] Runner aktif dan memantau tugas dari akun Super Admin... (Tekan Ctrl+C untuk keluar)`);

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
      process.exit(0);
    });
  }
}

main().catch((e) => {
  console.error('[Sync Agent] Fatal runner error:', e);
  process.exit(1);
});
