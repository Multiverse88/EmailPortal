# Super Admin Synology Laptop Sync Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan Super Admin memicu sinkronisasi berkas dokumen & lampiran ke folder Synology Drive di laptop Fedora Super Admin langsung dari web dashboard (`https://clienteasylegal.co.id/admin`), di mana eksekusi aktual dijalankan oleh runner daemon lokal di laptop.

**Architecture:** 
Backend menyediakan antrean tugas (`SyncJob`) dan endpoint deteksi *heartbeat* status runner.
Laptop menjalankan daemon ringan (`sync-agent.ts`) via Fedora `systemd --user` yang melakukan polling dan sinkronisasi S3 ke `~/SynologyDrive/EmailPortal_ColdStorage`.
Web UI di `/admin` memantau status online runner dan menyediakan tombol trigger yang aman khusus akun Super Admin.

**Tech Stack:** Express.js, TypeScript, Next.js 14, Axios, Tailwind CSS, Fedora systemd user service.

## Global Constraints
- File dokumentasi dan catatan markdown selalu disimpan di dalam direktori `docs/`.
- Endpoint trigger hanya dapat diakses oleh role `superadmin` (`authenticateSuperAdmin`).
- Endpoint runner dilindungi oleh token rahasia `SYNOLOGY_RUNNER_TOKEN`.
- Path target Synology di laptop: `/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage`.
- Struktur arsip Synology: `accounts/{email_klien}/documents/` dan `accounts/{email_klien}/attachments/`.

---

### Task 1: Backend Sync Queue & Runner Heartbeat Endpoints

**Files:**
- Modify: `backend/src/routes/storage.ts`
- Create: `backend/tests/synology-runner-api.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/storage/sync-agent/status` -> `{ isOnline: boolean, lastSeenSecondsAgo: number, activeJob: SyncJob | null }`
  - `POST /api/storage/sync-queue` -> `{ success: boolean, jobId: string }`
  - `GET /api/storage/sync-queue/status/:jobId` -> `{ status: string, result?: any }`
  - `POST /api/storage/sync-agent/heartbeat` -> `{ acknowledged: true, hasPendingJob: boolean }`
  - `GET /api/storage/sync-agent/poll` -> `{ job: SyncJob | null }`
  - `POST /api/storage/sync-agent/complete` -> `{ acknowledged: true }`

- [ ] **Step 1: Tulis unit test untuk runner API**

Buat berkas `backend/tests/synology-runner-api.test.ts`:
```typescript
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import storageRoutes from '../src/routes/storage';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const RUNNER_TOKEN = 'test-runner-token-xyz';
process.env.SYNOLOGY_RUNNER_TOKEN = RUNNER_TOKEN;

describe('Synology Runner API', () => {
  const app = express();
  app.use(express.json());

  const mockPrisma: any = {
    legalDocument: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]) },
    attachment: { count: jest.fn().mockResolvedValue(10), findMany: jest.fn().mockResolvedValue([]) },
    customer: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
  };

  app.use('/api/storage', storageRoutes(mockPrisma));

  const superAdminToken = jwt.sign(
    { id: 'admin-1', email: 'admin@clienteasylegal.co.id', type: 'admin', role: 'superadmin' },
    JWT_SECRET
  );

  it('rejects runner heartbeat without valid runner token', async () => {
    const res = await request(app).post('/api/storage/sync-agent/heartbeat').send({ hostname: 'fedora-laptop' });
    expect(res.status).toBe(401);
  });

  it('accepts runner heartbeat with valid runner token and reports runner online', async () => {
    const hbRes = await request(app)
      .post('/api/storage/sync-agent/heartbeat')
      .set('X-Runner-Secret-Token', RUNNER_TOKEN)
      .send({ hostname: 'fedora-laptop', targetDir: '/home/test/Synology' });
    expect(hbRes.status).toBe(200);
    expect(hbRes.body.acknowledged).toBe(true);

    const statusRes = await request(app)
      .get('/api/storage/sync-agent/status')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.isOnline).toBe(true);
  });

  it('creates a sync queue job and allows runner to poll and complete it', async () => {
    const queueRes = await request(app)
      .post('/api/storage/sync-queue')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ dryRun: false });
    expect(queueRes.status).toBe(202);
    const jobId = queueRes.body.jobId;

    const pollRes = await request(app)
      .get('/api/storage/sync-agent/poll')
      .set('X-Runner-Secret-Token', RUNNER_TOKEN);
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.job?.id).toBe(jobId);

    const completeRes = await request(app)
      .post('/api/storage/sync-agent/complete')
      .set('X-Runner-Secret-Token', RUNNER_TOKEN)
      .send({
        jobId,
        success: true,
        result: { syncedCount: 3, skippedCount: 5, failedCount: 0, totalBytesCopied: 1024 },
      });
    expect(completeRes.status).toBe(200);

    const checkJobRes = await request(app)
      .get(`/api/storage/sync-queue/status/${jobId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(checkJobRes.status).toBe(200);
    expect(checkJobRes.body.status).toBe('COMPLETED');
    expect(checkJobRes.body.result.syncedCount).toBe(3);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memverifikasi kegagalan awal**

Jalankan: `npx jest backend/tests/synology-runner-api.test.ts`
Ekspektasi: FAIL (endpoint belum terdefinisi).

- [ ] **Step 3: Implementasikan Queue & Heartbeat Handler di `backend/src/routes/storage.ts`**

Perbarui `backend/src/routes/storage.ts` dengan data queue in-memory, middleware verifikasi `X-Runner-Secret-Token`, dan rute terkait.

- [ ] **Step 4: Jalankan test ulang untuk verifikasi kelulusan**

Jalankan: `npx jest backend/tests/synology-runner-api.test.ts`
Ekspektasi: PASS (semua 3 pengujian berhasil).

- [ ] **Step 5: Commit perubahan Task 1**

```bash
git add backend/src/routes/storage.ts backend/tests/synology-runner-api.test.ts
git commit -m "feat(storage): add sync queue and runner heartbeat endpoints"
```

---

### Task 2: Laptop Local Runner Daemon (`backend/scripts/sync-agent.ts`)

**Files:**
- Create: `backend/scripts/sync-agent.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes:
  - `SynologySyncService` from `backend/src/lib/synology-sync.ts`
  - Backend API: `/api/storage/sync-agent/*`
- Produces:
  - CLI script: `npm --prefix backend run storage:agent`

- [ ] **Step 1: Buat script runner daemon `backend/scripts/sync-agent.ts`**

Mekanisme runner:
1. Membaca `BACKEND_API_URL` (default: `https://clienteasylegal.co.id`) dan `SYNOLOGY_RUNNER_TOKEN`.
2. Heartbeat interval: setiap 10 detik.
3. Saat `hasPendingJob: true`:
   - Ambil job via `/api/storage/sync-agent/poll`.
   - Jalankan `syncService.sync({ dryRun })`.
   - Laporkan hasil ke `/api/storage/sync-agent/complete`.
4. Penanganan sinyal `SIGINT` / `SIGTERM` yang bersih.

- [ ] **Step 2: Tambahkan script ke `backend/package.json`**

Tambahkan baris script:
```json
"storage:agent": "tsx scripts/sync-agent.ts"
```

- [ ] **Step 3: Uji jalankan runner sekali secara lokal dengan flag `--once` atau test run**

Jalankan: `npm --prefix backend run storage:agent -- --once`
Ekspektasi: Menghubungi API, melaporkan status, dan selesai tanpa error.

- [ ] **Step 4: Commit perubahan Task 2**

```bash
git add backend/scripts/sync-agent.ts backend/package.json
git commit -m "feat(storage): create laptop background sync agent script"
```

---

### Task 3: Fedora Systemd User Service Installer

**Files:**
- Create: `scripts/install-synology-runner.sh`
- Create: `docs/SYNOLOGY_RUNNER_SETUP.md`

**Interfaces:**
- Systemd Service: `easylegal-synology-runner.service`
- Path: `~/.config/systemd/user/easylegal-synology-runner.service`

- [ ] **Step 1: Buat installer script `scripts/install-synology-runner.sh`**

Script otomatis yang:
1. Menyiapkan direktori `~/.config/systemd/user/`.
2. Menulis unit file `easylegal-synology-runner.service`.
3. Menjalankan `systemctl --user daemon-reload`.
4. Mengaktifkan dan menyalakan service: `systemctl --user enable --now easylegal-synology-runner`.
5. Menampilkan status `systemctl --user status easylegal-synology-runner`.

- [ ] **Step 2: Buat panduan dokumentasi di `docs/SYNOLOGY_RUNNER_SETUP.md`**

Menjelaskan cara cek status service, cara restart, dan cara melihat log lewat `journalctl --user -u easylegal-synology-runner -f`.

- [ ] **Step 3: Commit perubahan Task 3**

```bash
git add scripts/install-synology-runner.sh docs/SYNOLOGY_RUNNER_SETUP.md
git commit -m "feat(systemd): add systemd user service installer for laptop sync runner"
```

---

### Task 4: Frontend Super Admin UI Integration (`frontend/src/app/admin/page.tsx`)

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/storage/sync-agent/status`
  - `POST /api/storage/sync-queue`
  - `GET /api/storage/sync-queue/status/:jobId`

- [ ] **Step 1: Tambahkan state runner ke komponen Admin**

- `runnerOnline`: boolean
- `activeSyncJobId`: string | null
- `syncProgressMessage`: string

- [ ] **Step 2: Update kartu Synology di Tab "Synology & Storage Inspector"**

- Badge status live:
  - Hijau: `🟢 Laptop Terhubung (Synology Drive Online)`
  - Abu-abu/Kuning: `⚪ Laptop Offline (Nyalakan Laptop Anda)`
- Tombol:
  - Jika runner offline: Tombol disabled dengan keterangan `"Sinkronisasi hanya dapat dipicu saat laptop Anda aktif"`.
  - Jika runner online: Tombol aktif biru/hijau **"Sinkronkan ke Synology Sekarang"**.
- Saat diklik:
  - Mengirim `POST /api/storage/sync-queue`.
  - Polling status job sampai `COMPLETED` atau `FAILED`.
  - Menampilkan toast hasil: `"✅ Berhasil! 3 berkas baru tersinkronkan ke Synology laptop Anda."`

- [ ] **Step 3: Uji build frontend**

Jalankan: `npm run build:frontend`
Ekspektasi: Build berhasil tanpa error TypeScript.

- [ ] **Step 4: Commit perubahan Task 4**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat(admin): integrate laptop runner live status and trigger into dashboard"
```

---

### Task 5: End-to-End Verification & Deploy ke VPS Dokploy

**Files:**
- Modify: `docker-compose.dokploy.yml` (Tambahkan `SYNOLOGY_RUNNER_TOKEN`)

- [ ] **Step 1: Tambahkan `SYNOLOGY_RUNNER_TOKEN` ke `docker-compose.dokploy.yml`**
- [ ] **Step 2: Jalankan seluruh test suite backend**
- [ ] **Step 3: Push commit ke branch `feat/ai-companion-el` di GitHub**
- [ ] **Step 4: Jalankan installer di laptop Fedora pengguna untuk mengaktifkan systemd runner**
- [ ] **Step 5: Verifikasi live trigger dari web browser `https://clienteasylegal.co.id/admin`**
