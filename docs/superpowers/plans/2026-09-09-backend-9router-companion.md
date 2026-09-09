# Backend 9router AI Companion Integration & Frontend UI Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 9router AI integration from frontend local storage to a secure backend proxy endpoint (`/api/companion/chat` and `/api/companion/status`) with `.env` configuration and local fallback, removing all API key inputs from the frontend widget while displaying real-time AI status.

**Architecture:** The backend Express server manages 9router credentials (`NINEROUTER_API_KEY`, `NINEROUTER_BASE_URL`, `NINEROUTER_MODEL`) and proxies requests server-to-server with optional customer context injection (name, retention status). When the API key is absent or on network error, the backend falls back to internal knowledge items (retention policy, backup steps, storage quota, support SLA). The frontend widget strips the settings modal and gear icon, connects to the backend endpoints, and displays dynamic status badges ("El AI Aktif" / "El Asisten Portal").

**Tech Stack:** Node.js, Express, TypeScript, Jest, Supertest, Next.js 14, Zustand, Axios, Tailwind CSS.

## Global Constraints

- No API keys or secret credentials exposed in frontend client code or browser local storage.
- Backward compatibility: If 9router is not configured or fails, local knowledge base continues to answer immediately.
- Backend rate limits and input validation must protect `/api/companion/chat`.
- All backend tests and frontend tests must pass cleanly.

---

### Task 1: Environment Variables & Backend Companion Knowledge Base

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/.env`
- Create: `backend/src/lib/companion-knowledge.ts`
- Test: `backend/tests/companion-knowledge.test.ts`

**Interfaces:**
- Produces:
  - `PORTAL_KNOWLEDGE_BASE`: array of knowledge items.
  - `findMatchingKnowledge(query: string)`: returns matched `KnowledgeItem | null`.

- [ ] **Step 1: Write unit test for backend companion knowledge base**

```typescript
// backend/tests/companion-knowledge.test.ts
import { findMatchingKnowledge, PORTAL_KNOWLEDGE_BASE } from '../src/lib/companion-knowledge';

describe('Backend Companion Knowledge Base', () => {
  it('should contain all required portal topics', () => {
    expect(PORTAL_KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(4);
    const ids = PORTAL_KNOWLEDGE_BASE.map(k => k.id);
    expect(ids).toContain('retention-3months');
    expect(ids).toContain('backup-files');
    expect(ids).toContain('storage-quota-synology');
    expect(ids).toContain('support-tickets');
  });

  it('should match retention query accurately', () => {
    const match = findMatchingKnowledge('berapa lama masa retensi akun?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('retention-3months');
    expect(match?.pose).toBe('tips');
  });

  it('should match backup query accurately', () => {
    const match = findMatchingKnowledge('bagaimana cara backup berkas dokumen saya?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('backup-files');
    expect(match?.pose).toBe('document');
  });

  it('should return null for unmatched random query', () => {
    const match = findMatchingKnowledge('siapa presiden pertama indonesia?');
    expect(match).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/companion-knowledge.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/companion-knowledge'"

- [ ] **Step 3: Add env vars and create backend companion knowledge base**

In `backend/.env.example` and `backend/.env`:
```env
# 9router AI Companion
NINEROUTER_API_KEY=
NINEROUTER_BASE_URL=https://api.9router.com/v1
NINEROUTER_MODEL=gpt-4o-mini
```

Create `backend/src/lib/companion-knowledge.ts`:
```typescript
export interface CompanionQuickAction {
  label: string;
  action: string;
  url?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  content: string;
  pose: 'greeting' | 'thinking' | 'document' | 'tips' | 'suggestion' | 'happy' | 'enthusiastic';
  quickActions?: CompanionQuickAction[];
}

export const PORTAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: 'retention-3months',
    title: 'Kebijakan Masa Aktif & Retensi Akun 3 Bulan',
    keywords: ['retensi', '3 bulan', 'masa aktif', 'kadaluarsa', 'expired', 'berapa lama', 'tenggat', 'tenggang', '90 hari'],
    summary: 'Akun dan penyimpanan data hanya bertahan selama 3 bulan (90 hari).',
    content: 'Kebijakan EasyLegal menetapkan bahwa **akun dan file penyimpanan Anda hanya bertahan selama 3 bulan (90 hari)** sejak akun dibuat. Memasuki **1 bulan terakhir (30 hari sebelum non-aktif)**, sistem akan memberikan pengingat agar Anda segera mem-backup dokumen mandiri.',
    pose: 'tips',
    quickActions: [
      { label: '📁 Cara Backup Dokumen', action: 'ask-backup' },
      { label: '🎫 Ajukan Tiket Perpanjangan', action: 'open-support-modal' },
    ],
  },
  {
    id: 'backup-files',
    title: 'Panduan Backup Berkas Mandiri',
    keywords: ['backup', 'cadangkan', 'unduh berkas', 'download file', 'simpan dokumen', 'ekspor'],
    summary: 'Langkah mem-backup berkas lampiran dan dokumen legal sebelum masa aktif berakhir.',
    content: 'Untuk mengamankan data Anda sebelum masa aktif berakhir:\n1. Buka menu **Dokumen** pada navigasi atas.\n2. Pilih berkas yang ingin disimpan dan klik tombol **Unduh**.\n3. Anda juga dapat memeriksa lampiran email di menu **Kotak Masuk** dan mengunduh berkas penting langsung ke perangkat Anda.',
    pose: 'document',
    quickActions: [
      { label: '📂 Buka Menu Dokumen', action: 'navigate', url: '/documents' },
      { label: 'ℹ️ Tanya Soal Retensi', action: 'ask-retention' },
    ],
  },
  {
    id: 'storage-quota-synology',
    title: 'Kapasitas Kuota S3 & Sinkronisasi Synology',
    keywords: ['kuota', 'storage', 'kapasitas', 'synology', 's3', 'penyimpanan penuh', 'sisa ruang'],
    summary: 'Penyimpanan utama menggunakan Object Storage S3 dengan replikasi Synology.',
    content: 'Penyimpanan portal terhubung dengan **Object Storage S3 IDCloudHost** serta replikasi **Synology Drive Mirror**. Kuota akun standar Anda dapat dipantau di menu **Pengaturan**. Jika kuota hampir penuh, unduh berkas arsip atau hubungi kami melalui tiket support.',
    pose: 'suggestion',
    quickActions: [
      { label: '⚙️ Cek Kuota di Pengaturan', action: 'navigate', url: '/settings' },
      { label: '🎫 Tiket Dukungan Kuota', action: 'open-support-modal' },
    ],
  },
  {
    id: 'support-tickets',
    title: 'Layanan Tiket Bantuan & Jaminan Respon 1x24 Jam',
    keywords: ['tiket', 'support', 'bantuan', 'cs', 'customer service', 'sla', '1x24 jam', 'kendala', 'keluhan'],
    summary: 'Solusi jika akun non-aktif atau terjadi kendala teknis dengan penanganan 1x24 jam.',
    content: 'Jika Anda mengalami kendala atau membutuhkan perpanjangan akun yang telah berstatus non-aktif, silakan buat tiket di menu **Bantuan / Support**. Tim Customer Care EasyLegal siap memproses tiket Anda dalam kurun waktu **maksimal 1x24 jam kerja**.',
    pose: 'enthusiastic',
    quickActions: [
      { label: '🎫 Buat Tiket Sekarang', action: 'open-support-modal' },
      { label: '📋 Riwayat Tiket Saya', action: 'navigate', url: '/support' },
    ],
  },
];

export function findMatchingKnowledge(query: string): KnowledgeItem | null {
  const normalized = query.toLowerCase();
  let bestMatch: KnowledgeItem | null = null;
  let highestScore = 0;

  for (const item of PORTAL_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  return highestScore >= 3 ? bestMatch : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/companion-knowledge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add backend/src/lib/companion-knowledge.ts backend/tests/companion-knowledge.test.ts backend/.env backend/.env.example
git commit -m "feat(backend): add companion knowledge base and 9router env vars"
```

---

### Task 2: Backend Companion Routes (`/api/companion/status` & `/api/companion/chat`)

**Files:**
- Create: `backend/src/routes/companion.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/companion-routes.test.ts`

**Interfaces:**
- `GET /api/companion/status`:
  - Returns: `{ configured: boolean, model: string, provider: '9router' | 'local', status: 'online' | 'local', active: true }`
- `POST /api/companion/chat`:
  - Body: `{ query: string, history?: Array<{ role: string; content: string }>, currentRoute?: string }`
  - Returns: `{ text: string, pose: string, quickActions?: Array<{ label: string; action: string; url?: string }>, source: '9router' | 'local' }`

- [ ] **Step 1: Write integration tests for companion routes**

```typescript
// backend/tests/companion-routes.test.ts
import request from 'supertest';
import app from '../src/app';

describe('Companion Routes', () => {
  describe('GET /api/companion/status', () => {
    it('should return companion status without exposing API key', async () => {
      const res = await request(app).get('/api/companion/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
      expect(res.body).toHaveProperty('model');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('active', true);
      expect(res.body).not.toHaveProperty('apiKey');
    });
  });

  describe('POST /api/companion/chat', () => {
    it('should reject request without query', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: '' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should answer retention question using knowledge base when 9router key is not set', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: 'Berapa lama masa retensi akun?' });
      expect(res.status).toBe(200);
      expect(res.body.text).toContain('3 bulan');
      expect(res.body.pose).toBe('tips');
      expect(res.body.source).toBe('local');
      expect(res.body.quickActions).toBeDefined();
    });

    it('should provide polite fallback with quick actions for unknown queries', async () => {
      const res = await request(app)
        .post('/api/companion/chat')
        .send({ query: 'Pertanyaan aneh yang tidak dikenali sistem sama sekali xyz' });
      expect(res.status).toBe(200);
      expect(res.body.text).toContain('El');
      expect(res.body.quickActions.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/companion-routes.test.ts`
Expected: FAIL with 404 (route not mounted)

- [ ] **Step 3: Implement companion route handler and mount in app.ts**

Create `backend/src/routes/companion.ts`:
```typescript
import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth';
import { findMatchingKnowledge } from '../lib/companion-knowledge';
import { computeRetention } from '../lib/retention';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    const apiKey = process.env.NINEROUTER_API_KEY?.trim();
    const model = process.env.NINEROUTER_MODEL?.trim() || 'gpt-4o-mini';
    const isConfigured = Boolean(apiKey && apiKey.length > 0);

    res.json({
      configured: isConfigured,
      model,
      provider: isConfigured ? '9router' : 'local',
      status: isConfigured ? 'online' : 'local',
      active: true,
    });
  });

  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { query, history, currentRoute } = req.body;
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const trimmedQuery = query.trim();
      const localMatch = findMatchingKnowledge(trimmedQuery);

      // Extract customer context if valid token provided
      let customerContext = '';
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const payload = verifyToken(token);
          if (payload?.type === 'customer') {
            const customer = await prisma.customer.findUnique({
              where: { id: payload.id },
              select: { name: true, mailboxAddress: true, createdAt: true },
            });
            if (customer) {
              const ret = computeRetention(customer.createdAt);
              customerContext = `Nama Customer: ${customer.name}, Email: ${customer.mailboxAddress}, Sisa Waktu Retensi: ${ret.remainingDays} hari (${ret.isExpiringSoon ? 'PERINGATAN: sisa < 30 hari' : 'aktif normal'}).`;
            }
          }
        } catch {
          // Token invalid or expired: proceed without personal context
        }
      }

      const apiKey = process.env.NINEROUTER_API_KEY?.trim();
      const baseUrl = process.env.NINEROUTER_BASE_URL?.trim() || 'https://api.9router.com/v1';
      const model = process.env.NINEROUTER_MODEL?.trim() || 'gpt-4o-mini';

      if (apiKey && apiKey.length > 0) {
        try {
          const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
          const systemPrompt = `Anda adalah "El", AI Companion cerdas, ramah, dan solutif untuk portal email & dokumen EasyLegal.
Karakter Anda ramah, sopan, bersahabat, dan menggunakan bahasa Indonesia yang hangat dan jelas.
Konteks portal EasyLegal saat ini:
- Rute halaman pengguna: ${currentRoute || '/inbox'}
${customerContext ? `- Data pengguna saat ini: ${customerContext}` : ''}
- Kebijakan retensi akun: Akun & file penyimpanan hanya bertahan 3 bulan (90 hari) sejak akun dibuat.
- Pengingat 1 bulan terakhir: Pengguna wajib mem-backup berkas dokumen mandiri sebelum akun non-aktif.
- Layanan Tiket Support: Jaminan tanggapan SLA 1x24 jam kerja untuk kendala akun non-aktif atau perpanjangan.
${localMatch ? `Informasi relevan dari sistem: ${localMatch.content}` : ''}
Jawablah dengan ringkas, jelas, dan ramah (maksimal 2-3 paragraf). Berikan langkah praktis jika ditanya panduan.`;

          const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6) : []),
            { role: 'user', content: trimmedQuery },
          ];

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const aiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: messagesPayload,
              temperature: 0.7,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (aiRes.ok) {
            const data: any = await aiRes.json();
            const reply = data?.choices?.[0]?.message?.content;
            if (reply && typeof reply === 'string' && reply.trim()) {
              return res.json({
                text: reply.trim(),
                pose: localMatch?.pose || 'happy',
                quickActions: localMatch?.quickActions,
                source: '9router',
              });
            }
          }
        } catch (apiErr) {
          console.warn('Backend 9router call failed, falling back to local engine:', apiErr);
        }
      }

      // Local Fallback
      if (localMatch) {
        return res.json({
          text: localMatch.content,
          pose: localMatch.pose,
          quickActions: localMatch.quickActions,
          source: 'local',
        });
      }

      return res.json({
        text: 'Halo! Saya El. Saya siap membantu Anda seputar **kebijakan retensi 3 bulan**, **cara backup berkas**, **kuota penyimpanan**, atau **tiket support (SLA 1x24 jam)**. Ada yang ingin Anda tanyakan?',
        pose: 'greeting',
        quickActions: [
          { label: 'ℹ️ Kebijakan 3 Bulan', action: 'ask-retention' },
          { label: '📁 Cara Backup Berkas', action: 'ask-backup' },
          { label: '🎫 Info Tiket Support', action: 'ask-support' },
        ],
        source: 'local',
      });
    } catch (err: any) {
      console.error('Companion chat route error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
```

In `backend/src/app.ts`:
Mount `app.use('/api/companion', companionRoutes(prisma));`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/companion-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add backend/src/routes/companion.ts backend/src/app.ts backend/tests/companion-routes.test.ts
git commit -m "feat(backend): implement companion status and chat proxy routes"
```

---

### Task 3: Frontend AI Engine & Companion Store Refactor

**Files:**
- Modify: `frontend/src/lib/companion/types.ts`
- Modify: `frontend/src/lib/companion/ai-engine.ts`
- Modify: `frontend/src/lib/companion/companion-store.ts`
- Test: `frontend/src/lib/companion/__tests__/ai-engine.test.ts`
- Test: `frontend/src/lib/companion/__tests__/companion-store.test.ts`

**Interfaces:**
- `getCompanionStatus()`: calls `GET /api/companion/status`
- `queryCompanion(query, history, portalContext)`: calls `POST /api/companion/chat`
- Remove `apiKey`, `baseUrl`, and `model` from frontend user configuration.
- Keep `status: { configured: boolean; model: string; status: string }`.

- [ ] **Step 1: Write/update frontend unit tests**

Update `frontend/src/lib/companion/__tests__/ai-engine.test.ts` to test calling the backend API with local fallback if offline.
Update `frontend/src/lib/companion/__tests__/companion-store.test.ts` to verify store initializes without requiring `apiKey` in localStorage.

- [ ] **Step 2: Run test to verify it fails on new requirements**

Run: `npm test src/lib/companion/__tests__/`
Expected: FAIL

- [ ] **Step 3: Update `types.ts`, `ai-engine.ts`, and `companion-store.ts`**

Update `types.ts`:
```typescript
export interface CompanionBackendStatus {
  configured: boolean;
  model: string;
  provider: '9router' | 'local';
  status: 'online' | 'local';
  active: boolean;
}
```

Update `ai-engine.ts`:
```typescript
export async function queryCompanion(
  query: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  portalContext?: { currentRoute: string; remainingDays?: number }
): Promise<{
  text: string;
  pose: CompanionPose;
  quickActions?: Array<{ label: string; action: string; url?: string }>;
  source?: '9router' | 'local';
}> {
  try {
    const res = await api.post('/companion/chat', {
      query,
      history,
      currentRoute: portalContext?.currentRoute,
    });
    if (res.data?.text) {
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to call /api/companion/chat, using client fallback:', err);
  }

  // Client-side fallback if backend is momentarily unreachable
  const localMatch = findMatchingKnowledge(query);
  if (localMatch) {
    return {
      text: localMatch.content,
      pose: localMatch.pose,
      quickActions: localMatch.quickActions,
      source: 'local',
    };
  }

  return {
    text: 'Halo! Saya El. Saya dapat membantu Anda seputar **kebijakan retensi 3 bulan**, **cara backup dokumen**, **kuota penyimpanan**, atau **tiket support (SLA 1x24 jam)**.',
    pose: 'greeting',
    quickActions: [
      { label: 'ℹ️ Kebijakan 3 Bulan', action: 'ask-retention' },
      { label: '📁 Cara Backup Berkas', action: 'ask-backup' },
      { label: '🎫 Info Tiket Support', action: 'ask-support' },
    ],
    source: 'local',
  };
}

export async function fetchCompanionStatus(): Promise<CompanionBackendStatus> {
  try {
    const res = await api.get('/companion/status');
    return res.data;
  } catch {
    return {
      configured: false,
      model: 'gpt-4o-mini',
      provider: 'local',
      status: 'local',
      active: true,
    };
  }
}
```

Update `companion-store.ts`:
Remove `loadSettingsFromStorage` with API key storage; add `backendStatus` and `refreshStatus()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/lib/companion/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/lib/companion/
git commit -m "refactor(frontend): connect companion engine to backend api and remove client-side api key storage"
```

---

### Task 4: Frontend UI Cleanup in `companion-dialog.tsx`

**Files:**
- Modify: `frontend/src/components/companion/companion-dialog.tsx`
- Test: `frontend/src/components/companion/__tests__/typewriter.test.ts`
- Manual / Build Verification: `npm run build`

**Interfaces:**
- Remove gear icon (⚙️) from header.
- Remove settings panel, password fields, model input, and local storage handlers.
- Header subtitle dynamically shows:
  - If `backendStatus.configured`: `El AI Aktif (${backendStatus.model})`
  - If not configured: `El Asisten Portal EasyLegal`
- Fallback message cleanly invites questions without prompting the user to edit API keys.

- [ ] **Step 1: Inspect and refactor `companion-dialog.tsx`**

Remove:
- `Settings` and `Key` icon imports from `lucide-react`.
- `showSettings`, `tempApiKey`, `tempModel`, `tempBaseUrl` states.
- Settings sub-panel JSX.
- Gear icon button in header.

Add:
- On mount, trigger `refreshStatus()`.
- Display status badge according to `backendStatus.configured`.

- [ ] **Step 2: Run frontend tests & build**

Run: `npm test` in `frontend/`
Expected: PASS (all test suites pass)
Run: `npm run build` in `frontend/`
Expected: PASS (build completes with zero TypeScript/lint errors)

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/components/companion/companion-dialog.tsx
git commit -m "refactor(frontend): clean up companion dialog UI and remove api key settings panel"
```

---

### Task 5: Full Regression Testing & Verification

**Files:**
- Test: `backend/` full test suite (`npm test`)
- Test: `frontend/` full test suite (`npm test`)
- Build: `frontend/` production build (`npm run build`)

- [ ] **Step 1: Run all backend tests**

Run: `npm test` in `backend/`
Expected: 14/14 test suites pass (including `companion-knowledge.test.ts` and `companion-routes.test.ts`).

- [ ] **Step 2: Run all frontend tests**

Run: `npm test` in `frontend/`
Expected: 5/5 test suites pass.

- [ ] **Step 3: Run production build**

Run: `npm run build` in `frontend/`
Expected: Clean build with all 11 routes successfully generated.

- [ ] **Step 4: Commit any remaining adjustments**

```bash
git status
git commit -am "chore: finalize backend 9router companion integration and verification"
```
