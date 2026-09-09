# AI Companion "El" (3D Interactive Avatar, Contextual Expressions & 9router Integration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an interactive 3D floating AI companion ("El") utilizing character assets from `files/` that reacts contextually to user actions across the portal, provides natural typing animations, answers common portal issues via a built-in knowledge base, and supports custom 9router API models.

**Architecture:**
- **3D Interactive Physics**: Lightweight Pure CSS 3D perspective transforms (`rotateX`, `rotateY`, `translateZ`, dynamic light shadow offset) tracking mouse pointer coordinates without heavy WebGL dependencies.
- **Contextual State Machine**: Zustand store listening to route changes and portal states (inbox, documents, 3-month retention warnings, support tickets) and dynamically switching El's expression poses (`el-menyapa`, `el-konfirmasi-dokumen`, `el-tips-dengan-lampu`, `el-memikirkan`, `el-senang`, `el-muncul-dari-tepi`).
- **Hybrid AI Engine**: Zero-config local knowledge base for instant answers to everyday EasyLegal questions (retensi 3 bulan, backup data, kuota cloud S3, SLA tiket 1x24 jam) plus 9router OpenAI-compatible API key client for freeform AI reasoning with a natural typewriter streaming animation.
- **App-Wide Presence**: Mounted in the global layout for all authenticated customer views with minimize/dock options to ensure zero hindrance to normal workflow.

**Tech Stack:**
- Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide React, Zustand
- Jest, React Testing Library
- CSS 3D Transforms, Pointer Events API

## Global Constraints
- Assets must be cleanly deployed from `files/` to `frontend/public/companion/el/`.
- Must support 3D tilt tracking with smooth interpolation and dynamic shadow offset.
- Must provide natural typewriter text animation (variable character speed, natural punctuation pauses).
- Must include instant local knowledge answers for:
  1. Kebijakan retensi 3 bulan & peringatan 1 bulan terakhir.
  2. Panduan backup dokumen mandiri.
  3. Kuota Cloud Storage & sinkronisasi Synology NAS / MinIO S3.
  4. Pembuatan tiket support dengan SLA 1x24 jam kerja.
  5. Pengiriman email & lampiran berkas.
- Must support 9router API key and custom model configuration stored in `localStorage`.
- Must respect `prefers-reduced-motion` accessibility settings.
- Must not break existing unit tests or Next.js production builds.

---

### Task 1: Asset Deployment & Companion Type Definitions

**Files:**
- Create: `frontend/public/companion/el/` (all character PNG files copied from `files/`)
- Create: `frontend/src/lib/companion/types.ts`
- Create: `frontend/src/lib/companion/__tests__/types.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CompanionPose =
    | 'greeting'
    | 'thinking'
    | 'document'
    | 'tips'
    | 'suggestion'
    | 'happy'
    | 'enthusiastic'
    | 'peeking'
    | 'waving'
    | 'head';

  export interface CompanionMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    pose?: CompanionPose;
    quickActions?: Array<{ label: string; action: string; url?: string }>;
  }

  export interface CompanionSettings {
    apiKey: string;
    baseUrl: string;
    model: string;
    enabled: boolean;
  }

  export interface KnowledgeItem {
    id: string;
    title: string;
    keywords: string[];
    summary: string;
    content: string;
    pose: CompanionPose;
    quickActions?: Array<{ label: string; action: string; url?: string }>;
  }

  export const POSE_ASSETS: Record<CompanionPose, string>;
  ```

- [ ] **Step 1: Copy character assets from `files/` to `frontend/public/companion/el/`**

```bash
mkdir -p "frontend/public/companion/el"
cp files/el-*.png "frontend/public/companion/el/"
```

- [ ] **Step 2: Write unit test for types and asset mappings**

Write `frontend/src/lib/companion/__tests__/types.test.ts`:
```ts
import { POSE_ASSETS, CompanionPose } from '../types';

describe('Companion Types and Assets', () => {
  const poses: CompanionPose[] = [
    'greeting',
    'thinking',
    'document',
    'tips',
    'suggestion',
    'happy',
    'enthusiastic',
    'peeking',
    'waving',
    'head',
  ];

  it('has asset mappings for all defined poses', () => {
    poses.forEach((pose) => {
      expect(POSE_ASSETS[pose]).toBeDefined();
      expect(POSE_ASSETS[pose]).toMatch(/^\/companion\/el\/el-[a-z-]+(\.png)$/);
    });
  });

  it('maps specific poses to accurate file paths', () => {
    expect(POSE_ASSETS.greeting).toBe('/companion/el/el-menyapa.png');
    expect(POSE_ASSETS.thinking).toBe('/companion/el/el-memikirkan.png');
    expect(POSE_ASSETS.document).toBe('/companion/el/el-konfirmasi-dokumen.png');
    expect(POSE_ASSETS.tips).toBe('/companion/el/el-tips-dengan-lampu.png');
    expect(POSE_ASSETS.suggestion).toBe('/companion/el/el-memberikan-saran.png');
    expect(POSE_ASSETS.happy).toBe('/companion/el/el-senang.png');
    expect(POSE_ASSETS.enthusiastic).toBe('/companion/el/el-semangat.png');
    expect(POSE_ASSETS.peeking).toBe('/companion/el/el-muncul-dari-tepi.png');
    expect(POSE_ASSETS.waving).toBe('/companion/el/el-hero-melambai.png');
    expect(POSE_ASSETS.head).toBe('/companion/el/el-avatar-kepala.png');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx jest src/lib/companion/__tests__/types.test.ts`
Expected: FAIL (Cannot find module `../types`)

- [ ] **Step 4: Implement `frontend/src/lib/companion/types.ts`**

```ts
export type CompanionPose =
  | 'greeting'
  | 'thinking'
  | 'document'
  | 'tips'
  | 'suggestion'
  | 'happy'
  | 'enthusiastic'
  | 'peeking'
  | 'waving'
  | 'head';

export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  pose?: CompanionPose;
  quickActions?: Array<{ label: string; action: string; url?: string }>;
}

export interface CompanionSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  content: string;
  pose: CompanionPose;
  quickActions?: Array<{ label: string; action: string; url?: string }>;
}

export const POSE_ASSETS: Record<CompanionPose, string> = {
  greeting: '/companion/el/el-menyapa.png',
  thinking: '/companion/el/el-memikirkan.png',
  document: '/companion/el/el-konfirmasi-dokumen.png',
  tips: '/companion/el/el-tips-dengan-lampu.png',
  suggestion: '/companion/el/el-memberikan-saran.png',
  happy: '/companion/el/el-senang.png',
  enthusiastic: '/companion/el/el-semangat.png',
  peeking: '/companion/el/el-muncul-dari-tepi.png',
  waving: '/companion/el/el-hero-melambai.png',
  head: '/companion/el/el-avatar-kepala.png',
};

export const DEFAULT_COMPANION_SETTINGS: CompanionSettings = {
  apiKey: '',
  baseUrl: 'https://api.9router.com/v1',
  model: 'gpt-4o-mini',
  enabled: true,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx jest src/lib/companion/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/public/companion/el frontend/src/lib/companion/types.ts frontend/src/lib/companion/__tests__/types.test.ts
git commit -m "feat(companion): add character assets and companion type definitions"
```

---

### Task 2: Local Knowledge Base & Intent Matching Engine

**Files:**
- Create: `frontend/src/lib/companion/knowledge-base.ts`
- Create: `frontend/src/lib/companion/ai-engine.ts`
- Create: `frontend/src/lib/companion/__tests__/ai-engine.test.ts`

**Interfaces:**
- Consumes: `CompanionSettings`, `KnowledgeItem`, `CompanionPose`
- Produces:
  ```ts
  export function findMatchingKnowledge(query: string): KnowledgeItem | null;
  export function getContextualTip(pathname: string, context?: { remainingDays?: number; isExpiringSoon?: boolean }): { text: string; pose: CompanionPose };
  export async function queryCompanion(
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    settings: CompanionSettings,
    portalContext?: { currentRoute: string; remainingDays?: number }
  ): Promise<{ text: string; pose: CompanionPose; quickActions?: Array<{ label: string; action: string; url?: string }> }>;
  ```

- [ ] **Step 1: Write the failing tests for knowledge matching and AI engine**

Write `frontend/src/lib/companion/__tests__/ai-engine.test.ts`:
```ts
import { findMatchingKnowledge, getContextualTip, queryCompanion } from '../ai-engine';
import { DEFAULT_COMPANION_SETTINGS } from '../types';

describe('AI Companion Engine & Knowledge Base', () => {
  it('matches 3-month retention queries accurately', () => {
    const match = findMatchingKnowledge('berapa lama akun saya bertahan?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('retention-3-months');
    expect(match?.pose).toBe('tips');
    expect(match?.content).toContain('3 bulan');
  });

  it('matches document backup questions', () => {
    const match = findMatchingKnowledge('bagaimana cara backup file dan dokumen?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('backup-documents');
    expect(match?.pose).toBe('document');
    expect(match?.quickActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'navigate-documents' })])
    );
  });

  it('matches support ticket turnaround questions', () => {
    const match = findMatchingKnowledge('berapa lama respon tiket bantuan?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('support-sla');
    expect(match?.content).toContain('1x24 jam');
  });

  it('returns proactive contextual tips based on route and remaining days', () => {
    const settingsWarning = getContextualTip('/settings', { remainingDays: 14, isExpiringSoon: true });
    expect(settingsWarning.pose).toBe('tips');
    expect(settingsWarning.text).toContain('14 hari');

    const documentsTip = getContextualTip('/documents');
    expect(documentsTip.pose).toBe('document');
    expect(documentsTip.text).toContain('dokumen');
  });

  it('falls back gracefully to local knowledge when no 9router API key is configured', async () => {
    const response = await queryCompanion('halo el, bisa bantu apa?', [], DEFAULT_COMPANION_SETTINGS);
    expect(response.text).toBeDefined();
    expect(response.pose).toBe('greeting');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/lib/companion/__tests__/ai-engine.test.ts`
Expected: FAIL (Cannot find module `../ai-engine`)

- [ ] **Step 3: Implement `frontend/src/lib/companion/knowledge-base.ts`**

```ts
import { KnowledgeItem } from './types';

export const PORTAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: 'retention-3-months',
    title: 'Kebijakan Retensi Akun & Berkas 3 Bulan',
    keywords: [
      'retensi',
      'masa aktif',
      'kadaluwarsa',
      'kedaluwarsa',
      '3 bulan',
      'tiga bulan',
      'berapa lama',
      'hapus akun',
      'sisa hari',
      'non-aktif',
      'nonaktif',
    ],
    summary: 'Masa aktif akun dan penyimpanan dokumen EasyLegal adalah 3 bulan (90 hari) sejak pembuatan akun.',
    content:
      'Akun dan seluruh berkas penyimpanan Anda bertahan selama **3 bulan (90 hari)** sejak akun dibuat. Memasuki **1 bulan terakhir**, Anda akan menerima pengingat untuk segera melakukan backup data mandiri. Jika akun Anda telah non-aktif dan memerlukan bantuan pemulihan, silakan buat tiket bantuan (diproses 1x24 jam).',
    pose: 'tips',
    quickActions: [
      { label: '📁 Unduh & Backup Dokumen', action: 'navigate-documents', url: '/documents' },
      { label: '🎫 Buat Tiket Support', action: 'open-support-modal' },
      { label: '⚙️ Cek Status di Pengaturan', action: 'navigate-settings', url: '/settings' },
    ],
  },
  {
    id: 'backup-documents',
    title: 'Cara Backup File & Dokumen',
    keywords: [
      'backup',
      'cadangkan',
      'download berkas',
      'unduh dokumen',
      'simpan file',
      'ekspor',
      'ambil data',
    ],
    summary: 'Cara mengunduh seluruh dokumen penting ke komputer atau penyimpanan pribadi.',
    content:
      'Untuk melakukan backup mandiri:\n1. Buka menu **Berkas Dokumen** di bilah atas atau navigasi.\n2. Pilih dokumen yang ingin Anda simpan.\n3. Klik tombol **Unduh / Download** untuk menyimpannya ke perangkat lokal Anda sebelum masa retensi 3 bulan berakhir.',
    pose: 'document',
    quickActions: [
      { label: '📁 Buka Berkas Dokumen', action: 'navigate-documents', url: '/documents' },
    ],
  },
  {
    id: 'support-sla',
    title: 'Bantuan & Tiket Support (SLA 1x24 Jam)',
    keywords: [
      'tiket',
      'support',
      'bantuan',
      'sla',
      '1x24',
      'customer service',
      'cs',
      'hubungi',
      'perpanjangan',
      'kendala',
    ],
    summary: 'Layanan bantuan tiket support dengan respon maksimal 1x24 jam kerja.',
    content:
      'Tim EasyLegal siap membantu kendala Anda dengan jaminan respon **1x24 jam kerja**. Anda dapat membuat tiket untuk permohonan perpanjangan akun, kendala file/email, atau pertanyaan hukum lainnya langsung melalui tombol tiket.',
    pose: 'enthusiastic',
    quickActions: [
      { label: '🎫 Buka Tiket Bantuan Sekarang', action: 'open-support-modal' },
    ],
  },
  {
    id: 'storage-synology-s3',
    title: 'Penyimpanan Dokumen Cloud & Synology NAS',
    keywords: [
      'kuota',
      'storage',
      's3',
      'synology',
      'nas',
      'kapasitas',
      'penyimpanan penuh',
      'cloud storage',
    ],
    summary: 'Penyimpanan terpusat aman dengan kuota terdedikasi dan sinkronisasi berkas.',
    content:
      'Dokumen Anda tersimpan aman menggunakan enkripsi Cloud Storage S3 / Synology NAS berstandar enterprise. Anda dapat memantau penggunaan kuota penyimpanan pada ringkasan akun di menu Pengaturan.',
    pose: 'suggestion',
    quickActions: [
      { label: '⚙️ Cek Kuota di Pengaturan', action: 'navigate-settings', url: '/settings' },
      { label: '📁 Kelola Berkas', action: 'navigate-documents', url: '/documents' },
    ],
  },
  {
    id: 'email-compose-attachment',
    title: 'Kirim Email & Lampiran Berkas',
    keywords: [
      'kirim email',
      'tulis email',
      'compose',
      'lampiran',
      'attachment',
      'kirim berkas',
      'pesan baru',
    ],
    summary: 'Menulis pesan baru dan menyertakan dokumen pendukung.',
    content:
      'Gunakan tombol **Tulis Pesan (Compose)** di menu Kotak Masuk. Anda dapat melampirkan berkas dokumen dengan mengeklik ikon klip kertas di bagian bawah jendela penulisan.',
    pose: 'waving',
    quickActions: [
      { label: '✉️ Buka Kotak Masuk', action: 'navigate-inbox', url: '/inbox' },
    ],
  },
];
```

- [ ] **Step 4: Implement `frontend/src/lib/companion/ai-engine.ts`**

```ts
import { CompanionPose, CompanionSettings, KnowledgeItem } from './types';
import { PORTAL_KNOWLEDGE_BASE } from './knowledge-base';

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

export function getContextualTip(
  pathname: string,
  context?: { remainingDays?: number; isExpiringSoon?: boolean }
): { text: string; pose: CompanionPose } {
  if (pathname.includes('/settings')) {
    if (context?.isExpiringSoon && typeof context?.remainingDays === 'number') {
      return {
        text: `Masa aktif akun Anda tersisa ${context.remainingDays} hari lagi. Jangan lupa unduh berkas penting Anda ya!`,
        pose: 'tips',
      };
    }
    return {
      text: 'Di menu Pengaturan, Anda dapat mengecek masa retensi akun, kuota S3, dan profil keamanan Anda.',
      pose: 'suggestion',
    };
  }

  if (pathname.includes('/documents')) {
    return {
      text: 'Perlu mencari dokumen atau melakukan backup? Klik tombol unduh pada berkas yang ingin disimpan.',
      pose: 'document',
    };
  }

  if (pathname.includes('/support')) {
    return {
      text: 'Ada kendala atau butuh perpanjangan masa aktif? Buat tiket di sini, tim kami siap memproses 1x24 jam!',
      pose: 'enthusiastic',
    };
  }

  return {
    text: 'Halo! Saya El, asisten pendamping EasyLegal Anda. Ada yang bisa saya bantu hari ini?',
    pose: 'greeting',
  };
}

export async function queryCompanion(
  query: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  settings: CompanionSettings,
  portalContext?: { currentRoute: string; remainingDays?: number }
): Promise<{
  text: string;
  pose: CompanionPose;
  quickActions?: Array<{ label: string; action: string; url?: string }>;
}> {
  const localMatch = findMatchingKnowledge(query);

  // If user has provided a 9router API key, call the OpenAI-compatible completion API
  if (settings.apiKey && settings.apiKey.trim().length > 0) {
    try {
      const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const systemPrompt = `Anda adalah "El", AI Companion ramah dan profesional untuk platform EasyLegal.
Karakter Anda ramah, solutif, sopan, dan menggunakan bahasa Indonesia yang hangat.
Konteks portal saat ini:
- Rute halaman: ${portalContext?.currentRoute || '/inbox'}
- Kebijakan retensi akun: Akun & file hanya bertahan 3 bulan (90 hari) sejak dibuat.
- Pengingat 1 bulan terakhir: Diwajibkan backup berkas mandiri sebelum nonaktif.
- Layanan Tiket Support: SLA tanggapan 1x24 jam kerja.
${localMatch ? `Informasi relevan dari sistem: ${localMatch.content}` : ''}
Jawablah dengan ringkas, jelas, dan ramah (maksimal 2-3 paragraf).`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6),
            { role: 'user', content: query },
          ],
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.choices?.[0]?.message?.content;
        if (replyText) {
          return {
            text: replyText,
            pose: localMatch?.pose || 'happy',
            quickActions: localMatch?.quickActions,
          };
        }
      }
    } catch (err) {
      console.warn('9router API call failed, falling back to local engine:', err);
    }
  }

  // Fallback to local intelligent knowledge match
  if (localMatch) {
    return {
      text: localMatch.content,
      pose: localMatch.pose,
      quickActions: localMatch.quickActions,
    };
  }

  // Polite general fallback with guidance
  return {
    text: `Halo! Saya El. Saya dapat membantu Anda seputar **kebijakan retensi 3 bulan**, **cara backup dokumen**, **kuota penyimpanan**, atau **tiket support (SLA 1x24 jam)**.

Untuk pertanyaan kompleks lainnya, Anda juga bisa memasukkan API Key 9router Anda melalui ikon gerigi pengaturan di atas jendela ini!`,
    pose: 'greeting',
    quickActions: [
      { label: 'ℹ️ Kebijakan 3 Bulan', action: 'ask-retention' },
      { label: '📁 Cara Backup Berkas', action: 'ask-backup' },
      { label: '🎫 Info Tiket Support', action: 'ask-support' },
    ],
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx jest src/lib/companion/__tests__/ai-engine.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/companion/knowledge-base.ts frontend/src/lib/companion/ai-engine.ts frontend/src/lib/companion/__tests__/ai-engine.test.ts
git commit -m "feat(companion): implement local knowledge base and 9router AI query engine"
```

---

### Task 3: Companion State Store & Route Reactor

**Files:**
- Create: `frontend/src/lib/companion/companion-store.ts`
- Create: `frontend/src/lib/companion/__tests__/companion-store.test.ts`

**Interfaces:**
- Consumes: `CompanionPose`, `CompanionMessage`, `CompanionSettings`
- Produces:
  ```ts
  export const useCompanionStore = create<CompanionState>(...);
  ```

- [ ] **Step 1: Write failing test for companion state store**

Write `frontend/src/lib/companion/__tests__/companion-store.test.ts`:
```ts
import { useCompanionStore } from '../companion-store';

describe('Companion Zustand Store', () => {
  beforeEach(() => {
    useCompanionStore.getState().resetForTesting();
  });

  it('has initial default state', () => {
    const state = useCompanionStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.isMinimized).toBe(false);
    expect(state.pose).toBe('greeting');
    expect(state.messages.length).toBeGreaterThan(0);
  });

  it('toggles dialog open and close', () => {
    useCompanionStore.getState().openChat();
    expect(useCompanionStore.getState().isOpen).toBe(true);

    useCompanionStore.getState().closeChat();
    expect(useCompanionStore.getState().isOpen).toBe(false);
  });

  it('toggles minimize mode', () => {
    useCompanionStore.getState().toggleMinimize();
    expect(useCompanionStore.getState().isMinimized).toBe(true);

    useCompanionStore.getState().toggleMinimize();
    expect(useCompanionStore.getState().isMinimized).toBe(false);
  });

  it('updates pose and adds messages', () => {
    useCompanionStore.getState().setPose('document');
    expect(useCompanionStore.getState().pose).toBe('document');

    useCompanionStore.getState().addMessage({
      id: 'msg-1',
      role: 'user',
      content: 'Halo El',
      timestamp: Date.now(),
    });

    expect(useCompanionStore.getState().messages.length).toBe(2);
    expect(useCompanionStore.getState().messages[1].content).toBe('Halo El');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/lib/companion/__tests__/companion-store.test.ts`
Expected: FAIL (Cannot find module `../companion-store`)

- [ ] **Step 3: Implement `frontend/src/lib/companion/companion-store.ts`**

```ts
import { create } from 'zustand';
import {
  CompanionMessage,
  CompanionPose,
  CompanionSettings,
  DEFAULT_COMPANION_SETTINGS,
} from './types';

interface CompanionBubble {
  text: string;
  pose: CompanionPose;
}

interface CompanionState {
  isOpen: boolean;
  isMinimized: boolean;
  pose: CompanionPose;
  bubble: CompanionBubble | null;
  messages: CompanionMessage[];
  isTyping: boolean;
  settings: CompanionSettings;

  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  toggleMinimize: () => void;
  setMinimized: (val: boolean) => void;
  setPose: (pose: CompanionPose) => void;
  showBubble: (text: string, pose?: CompanionPose, durationMs?: number) => void;
  hideBubble: () => void;
  addMessage: (message: CompanionMessage) => void;
  setIsTyping: (val: boolean) => void;
  updateSettings: (patch: Partial<CompanionSettings>) => void;
  clearMessages: () => void;
  resetForTesting: () => void;
}

const INITIAL_MESSAGE: CompanionMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Halo! Saya **El**, AI Companion Anda di EasyLegal. Saya siap membantu Anda memahami retensi akun 3 bulan, backup file, kuota storage, dan tiket support 1x24 jam. Ada yang bisa saya bantu?',
  timestamp: Date.now(),
  pose: 'greeting',
  quickActions: [
    { label: 'ℹ️ Kebijakan 3 Bulan', action: 'ask-retention' },
    { label: '📁 Cara Backup Dokumen', action: 'ask-backup' },
    { label: '🎫 Buat Tiket Support', action: 'open-support-modal' },
  ],
};

function loadSettingsFromStorage(): CompanionSettings {
  if (typeof window === 'undefined') return DEFAULT_COMPANION_SETTINGS;
  try {
    const raw = localStorage.getItem('el_companion_settings');
    if (raw) return { ...DEFAULT_COMPANION_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_COMPANION_SETTINGS;
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  isOpen: false,
  isMinimized: false,
  pose: 'greeting',
  bubble: null,
  messages: [INITIAL_MESSAGE],
  isTyping: false,
  settings: loadSettingsFromStorage(),

  openChat: () => set({ isOpen: true, isMinimized: false }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen, isMinimized: false })),
  toggleMinimize: () => set((s) => ({ isMinimized: !s.isMinimized })),
  setMinimized: (val: boolean) => set({ isMinimized: val }),
  setPose: (pose: CompanionPose) => set({ pose }),

  showBubble: (text: string, pose: CompanionPose = 'tips', durationMs = 8000) => {
    set({ bubble: { text, pose }, pose });
    if (durationMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (get().bubble?.text === text) {
          set({ bubble: null });
        }
      }, durationMs);
    }
  },

  hideBubble: () => set({ bubble: null }),

  addMessage: (message: CompanionMessage) =>
    set((s) => ({
      messages: [...s.messages, message],
      pose: message.pose || s.pose,
    })),

  setIsTyping: (val: boolean) => set({ isTyping: val }),

  updateSettings: (patch: Partial<CompanionSettings>) => {
    set((s) => {
      const next = { ...s.settings, ...patch };
      if (typeof window !== 'undefined') {
        localStorage.setItem('el_companion_settings', JSON.stringify(next));
      }
      return { settings: next };
    });
  },

  clearMessages: () => set({ messages: [INITIAL_MESSAGE] }),

  resetForTesting: () =>
    set({
      isOpen: false,
      isMinimized: false,
      pose: 'greeting',
      bubble: null,
      messages: [INITIAL_MESSAGE],
      isTyping: false,
      settings: DEFAULT_COMPANION_SETTINGS,
    }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest src/lib/companion/__tests__/companion-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/companion/companion-store.ts frontend/src/lib/companion/__tests__/companion-store.test.ts
git commit -m "feat(companion): add Zustand companion state store and storage persistence"
```

---

### Task 4: 3D Parallax Tilt Hook & Natural Typewriter Animation

**Files:**
- Create: `frontend/src/components/companion/use-3d-tilt.ts`
- Create: `frontend/src/components/companion/typewriter.tsx`
- Modify: `frontend/src/app/globals.css` (custom smooth breathing and tilt keyframes)

**Interfaces:**
- Produces:
  ```ts
  export function use3DTilt(options?: { maxTilt?: number; perspective?: number }): {
    ref: React.RefObject<HTMLDivElement>;
    style: React.CSSProperties;
    shadowStyle: React.CSSProperties;
    handlePointerEnter: () => void;
    handlePointerLeave: () => void;
  };

  export function Typewriter({
    content,
    speed?: number,
    onComplete?: () => void,
    className?: string,
  }: TypewriterProps): JSX.Element;
  ```

- [ ] **Step 1: Implement `frontend/src/components/companion/use-3d-tilt.ts`**

```ts
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface TiltOptions {
  maxTilt?: number; // max rotation in degrees
  perspective?: number; // CSS perspective distance
}

export function use3DTilt(options: TiltOptions = {}) {
  const { maxTilt = 18, perspective = 600 } = options;
  const ref = useRef<HTMLDivElement | null>(null);

  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const [shadowOffset, setShadowOffset] = useState({ x: 0, y: 12 });
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!ref.current || !isHovered) return;

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate distance normalized between -1 and 1
      const normalizedX = Math.min(Math.max((e.clientX - centerX) / (rect.width / 2), -1), 1);
      const normalizedY = Math.min(Math.max((e.clientY - centerY) / (rect.height / 2), -1), 1);

      const rotateY = normalizedX * maxTilt;
      const rotateX = -normalizedY * maxTilt;

      // Dynamic light source shadow opposite to rotation
      const shadowX = -normalizedX * 16;
      const shadowY = 12 - normalizedY * 8;

      setTilt({ rotateX, rotateY, scale: 1.05 });
      setShadowOffset({ x: shadowX, y: shadowY });
    },
    [isHovered, maxTilt]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [handlePointerMove]);

  const handlePointerEnter = () => setIsHovered(true);
  const handlePointerLeave = () => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0, scale: 1 });
    setShadowOffset({ x: 0, y: 12 });
  };

  const style: React.CSSProperties = {
    transform: `perspective(${perspective}px) rotateX(${tilt.rotateX.toFixed(2)}deg) rotateY(${tilt.rotateY.toFixed(2)}deg) scale3d(${tilt.scale}, ${tilt.scale}, 1)`,
    transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.4s ease-out',
    transformStyle: 'preserve-3d',
    willChange: 'transform',
  };

  const shadowStyle: React.CSSProperties = {
    filter: `drop-shadow(${shadowOffset.x.toFixed(1)}px ${shadowOffset.y.toFixed(1)}px 16px rgba(38, 22, 22, 0.28))`,
    transition: isHovered ? 'filter 0.08s ease-out' : 'filter 0.4s ease-out',
  };

  return {
    ref,
    style,
    shadowStyle,
    handlePointerEnter,
    handlePointerLeave,
    isHovered,
  };
}
```

- [ ] **Step 2: Implement `frontend/src/components/companion/typewriter.tsx`**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
  content: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function Typewriter({
  content,
  speed = 18,
  onComplete,
  className = '',
}: TypewriterProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const isDoneRef = useRef(false);

  useEffect(() => {
    setDisplayedLength(0);
    isDoneRef.current = false;

    if (!content) {
      onComplete?.();
      return;
    }

    let currentIndex = 0;
    let timer: NodeJS.Timeout;

    const streamNextChar = () => {
      if (currentIndex >= content.length) {
        isDoneRef.current = true;
        setDisplayedLength(content.length);
        onComplete?.();
        return;
      }

      currentIndex++;
      setDisplayedLength(currentIndex);

      const char = content[currentIndex - 1];
      let delay = speed;

      // Natural cadence punctuation pauses
      if (char === '.' || char === '!' || char === '?') {
        delay = 240;
      } else if (char === ',' || char === ';') {
        delay = 110;
      } else if (char === '\n') {
        delay = 180;
      }

      timer = setTimeout(streamNextChar, delay);
    };

    timer = setTimeout(streamNextChar, speed);

    return () => clearTimeout(timer);
  }, [content, speed, onComplete]);

  const isFinished = displayedLength >= content.length;

  return (
    <span
      className={className}
      onClick={() => {
        // Skip animation on click
        if (!isFinished) {
          setDisplayedLength(content.length);
          onComplete?.();
        }
      }}
      title={!isFinished ? 'Klik untuk langsung menampilkan semua teks' : undefined}
    >
      {content.slice(0, displayedLength)}
      {!isFinished && (
        <span className="inline-block animate-pulse font-bold text-primary ml-0.5">▊</span>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Add companion floating keyframe animations in `frontend/src/app/globals.css`**

Add breathing float keyframes:
```css
@keyframes el-breathe-float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

.animate-el-breathe {
  animation: el-breathe-float 3.5s ease-in-out infinite;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/companion/use-3d-tilt.ts frontend/src/components/companion/typewriter.tsx frontend/src/app/globals.css
git commit -m "feat(companion): add 3D tilt tracking hook and natural typewriter animation"
```

---

### Task 5: Interactive Floating Avatar, Chat Dialog & Settings Panel

**Files:**
- Create: `frontend/src/components/companion/companion-avatar.tsx`
- Create: `frontend/src/components/companion/companion-dialog.tsx`
- Create: `frontend/src/components/companion/el-companion.tsx`
- Modify: `frontend/src/app/layout.tsx` (mount `<ElCompanion />`)

**Interfaces:**
- Produces: `<ElCompanion />` global floating interactive assistant mounted in the root layout.
- Integrates:
  - 3D interactive avatar with dynamic cursor following
  - Thought / tip speech bubble
  - Minimized edge peek mode (`el-muncul-dari-tepi`)
  - Chat window with local knowledge + 9router LLM integration
  - 9router API key configuration modal
  - Quick action event dispatchers for `/documents`, `/settings`, and `SupportTicketModal`.

- [ ] **Step 1: Implement `frontend/src/components/companion/companion-avatar.tsx`**

```tsx
'use client';

import { useCompanionStore } from '@/lib/companion/companion-store';
import { POSE_ASSETS } from '@/lib/companion/types';
import { use3DTilt } from './use-3d-tilt';
import { X, Sparkles } from 'lucide-react';

export function CompanionAvatar() {
  const { isOpen, isMinimized, pose, bubble, toggleChat, setMinimized, hideBubble } =
    useCompanionStore();
  const { ref, style, shadowStyle, handlePointerEnter, handlePointerLeave } = use3DTilt({
    maxTilt: 16,
    perspective: 500,
  });

  if (isOpen) return null;

  // Minimized peek mode
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-0 z-40 flex items-center">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="group relative flex items-center rounded-l-2xl border-y border-l border-primary/20 bg-white/95 px-2.5 py-2 shadow-lg backdrop-blur transition-transform hover:-translate-x-1"
          title="Tampilkan El"
        >
          <img
            src={POSE_ASSETS.peeking}
            alt="El Peeking"
            className="size-10 object-contain drop-shadow-sm transition-transform group-hover:scale-110"
          />
          <span className="ml-1 text-xs font-bold text-primary">El</span>
        </button>
      </div>
    );
  }

  const assetSrc = POSE_ASSETS[pose] || POSE_ASSETS.greeting;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end select-none">
      {/* Spontaneous thought / tip speech bubble */}
      {bubble && (
        <div className="relative mb-2 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl border border-primary/20 bg-white/95 p-3 text-xs leading-relaxed text-slate-800 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="flex items-center gap-1 font-bold text-primary text-[11px]">
                <Sparkles className="size-3.5" />
                Tips dari El
              </span>
              <button
                type="button"
                onClick={hideBubble}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Tutup tips"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="line-clamp-4">{bubble.text}</p>
            <button
              type="button"
              onClick={toggleChat}
              className="mt-2 text-[11px] font-semibold text-primary underline underline-offset-2 hover:text-primary-container"
            >
              Tanya lebih lanjut &rarr;
            </button>
          </div>
          {/* Speech bubble tail pointer */}
          <div className="absolute right-8 -bottom-1.5 size-3 rotate-45 border-b border-r border-primary/20 bg-white" />
        </div>
      )}

      {/* 3D Parallax Floating Avatar */}
      <div
        ref={ref}
        style={style}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className="group relative cursor-pointer"
        onClick={toggleChat}
      >
        <div style={shadowStyle} className="animate-el-breathe">
          <img
            src={assetSrc}
            alt="El Companion"
            className="h-28 w-auto object-contain transition-all duration-300 group-hover:scale-105"
            draggable={false}
          />
        </div>

        {/* Hover Hint Badge */}
        <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/85 px-2.5 py-0.5 text-[10px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
          Klik untuk ngobrol ✨
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `frontend/src/components/companion/companion-dialog.tsx`**

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCompanionStore } from '@/lib/companion/companion-store';
import { POSE_ASSETS } from '@/lib/companion/types';
import { queryCompanion } from '@/lib/companion/ai-engine';
import { Typewriter } from './typewriter';
import {
  X,
  Minus,
  Settings,
  Send,
  Sparkles,
  Trash2,
  ExternalLink,
  Key,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export function CompanionDialog() {
  const router = useRouter();
  const pathname = usePathname();

  const {
    isOpen,
    pose,
    messages,
    isTyping,
    settings,
    closeChat,
    toggleMinimize,
    addMessage,
    setIsTyping,
    updateSettings,
    clearMessages,
    setPose,
  } = useCompanionStore();

  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(settings.apiKey);
  const [tempModel, setTempModel] = useState(settings.model);
  const [tempBaseUrl, setTempBaseUrl] = useState(settings.baseUrl);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    setInput('');
    const userMsgId = `user-${Date.now()}`;
    addMessage({
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    setIsTyping(true);
    setPose('thinking');

    try {
      const history = messages.slice(-5).map((m) => ({ role: m.role, content: m.content }));
      const response = await queryCompanion(text, history, settings, { currentRoute: pathname });

      addMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        pose: response.pose,
        quickActions: response.quickActions,
      });
    } catch (err) {
      addMessage({
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Maaf, terjadi kendala saat memproses jawaban. Silakan coba sesaat lagi.',
        timestamp: Date.now(),
        pose: 'suggestion',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = (action: string, url?: string) => {
    if (action === 'open-support-modal') {
      window.dispatchEvent(
        new CustomEvent('easylegal:open-support', {
          detail: { category: 'retention', priority: 'high' },
        })
      );
    } else if (action === 'ask-retention') {
      handleSend('Berapa lama masa retensi akun dan berkas saya bertahan?');
    } else if (action === 'ask-backup') {
      handleSend('Bagaimana cara backup berkas dokumen saya?');
    } else if (action === 'ask-support') {
      handleSend('Berapa lama tiket support saya diproses?');
    } else if (url) {
      router.push(url);
    }
  };

  const handleSaveSettings = () => {
    updateSettings({
      apiKey: tempApiKey.trim(),
      model: tempModel.trim() || 'gpt-4o-mini',
      baseUrl: tempBaseUrl.trim() || 'https://api.9router.com/v1',
    });
    setShowSettings(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[580px] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-border-subtle bg-white shadow-2xl animate-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle bg-[#fbfaf9] px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={POSE_ASSETS[pose] || POSE_ASSETS.head}
              alt="El"
              className="size-10 object-contain rounded-xl bg-primary/5 p-1 border border-primary/10"
            />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900">El Companion</h3>
              <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {settings.apiKey ? '9router Model Active' : 'Sistem Bantuan EasyLegal'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`app-icon-button ${showSettings ? 'text-primary bg-primary/10' : ''}`}
            title="Pengaturan Model 9router"
          >
            <Settings className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggleMinimize}
            className="app-icon-button"
            title="Perkecil"
          >
            <Minus className="size-4" />
          </button>
          <button type="button" onClick={closeChat} className="app-icon-button" title="Tutup">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Settings Sub-Panel (9router API Key) */}
      {showSettings ? (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          <div className="flex items-center gap-2 mb-3">
            <Key className="size-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Pengaturan 9router AI Key
            </h4>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Anda dapat menggunakan API Key 9router pribadi Anda untuk respons percakapan AI yang lebih
            luas. Jika kosong, El tetap menjawab menggunakan basis pengetahuan internal portal.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                9router API Key
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="sk-..."
                className="app-field text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Model Name</label>
              <input
                type="text"
                value={tempModel}
                onChange={(e) => setTempModel(e.target.value)}
                placeholder="gpt-4o-mini / gemini-2.5-flash / claude-3-5-haiku"
                className="app-field text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Base URL Endpoint
              </label>
              <input
                type="text"
                value={tempBaseUrl}
                onChange={(e) => setTempBaseUrl(e.target.value)}
                placeholder="https://api.9router.com/v1"
                className="app-field text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setTempApiKey('');
                  setTempModel('gpt-4o-mini');
                  setTempBaseUrl('https://api.9router.com/v1');
                }}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Reset Default
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="app-primary-button text-xs py-1.5 px-4 h-9"
              >
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Messages Stream */
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isLatestAssistant = !isUser && index === messages.length - 1;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-primary text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-border-subtle rounded-bl-none'
                  }`}
                >
                  {isLatestAssistant ? (
                    <Typewriter content={msg.content} speed={14} />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                {/* Quick action buttons attached to assistant reply */}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
                    {msg.quickActions.map((qa, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAction(qa.action, qa.url)}
                        className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-primary shadow-2xs hover:bg-primary/5 hover:border-primary transition"
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <span className="size-2 rounded-full bg-primary animate-ping" />
              <span>El sedang memproses...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Suggested Quick Question Chips */}
      {!showSettings && (
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-t border-border-subtle/60 bg-white/70">
          <button
            type="button"
            onClick={() => handleSend('Berapa lama masa retensi akun dan berkas saya bertahan?')}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
          >
            ℹ️ Retensi 3 Bulan
          </button>
          <button
            type="button"
            onClick={() => handleSend('Bagaimana cara backup berkas dokumen?')}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
          >
            📁 Backup Berkas
          </button>
          <button
            type="button"
            onClick={() => handleSend('Berapa lama tiket support saya diproses?')}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
          >
            🎫 SLA 1x24 Jam
          </button>
        </div>
      )}

      {/* Input Footer */}
      {!showSettings && (
        <div className="border-t border-border-subtle bg-white p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaan untuk El..."
              className="app-field text-xs py-2 px-3 flex-1"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-container disabled:opacity-50"
              title="Kirim pesan"
            >
              <Send className="size-4" />
            </button>
            <button
              type="button"
              onClick={clearMessages}
              className="app-icon-button shrink-0"
              title="Bersihkan riwayat percakapan"
            >
              <RotateCcw className="size-3.5 text-slate-400" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement `frontend/src/components/companion/el-companion.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCustomerAuth } from '@/store/auth';
import { useCompanionStore } from '@/lib/companion/companion-store';
import { getContextualTip } from '@/lib/companion/ai-engine';
import { CompanionAvatar } from './companion-avatar';
import { CompanionDialog } from './companion-dialog';

export function ElCompanion() {
  const pathname = usePathname();
  const { user, token } = useCustomerAuth();
  const { setPose, showBubble } = useCompanionStore();

  // Do not show companion on login or auth callback routes
  const isExcludedRoute = pathname === '/login' || pathname.startsWith('/auth');

  // React contextually to route navigation and show proactive tips
  useEffect(() => {
    if (isExcludedRoute) return;

    const tip = getContextualTip(pathname);
    setPose(tip.pose);

    // Provide occasional proactive speech bubble when switching to sensitive pages like /settings or /documents
    if (pathname.includes('/settings') || pathname.includes('/documents')) {
      showBubble(tip.text, tip.pose, 7000);
    }
  }, [pathname, isExcludedRoute, setPose, showBubble]);

  if (isExcludedRoute) {
    return null;
  }

  return (
    <>
      <CompanionAvatar />
      <CompanionDialog />
    </>
  );
}
```

- [ ] **Step 4: Mount `<ElCompanion />` in `frontend/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { ElCompanion } from '@/components/companion/el-companion';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'MailPortal - EasyLegal',
  description: 'Custom email client for EasyLegal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${manrope.variable} bg-background text-on-background antialiased font-sans`}>
        {children}
        <ElCompanion />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run tests and verify build**

Run: `cd frontend && npx jest`
Expected: PASS (All test suites pass)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/companion/ frontend/src/app/layout.tsx
git commit -m "feat(companion): complete interactive 3D El companion widget and dialog"
```

---

### Task 6: Full Verification & Integration Testing

**Files:**
- Test: `frontend` test suites (`npx jest`)
- Test: `backend` test suites (`npm test`)
- Build: `frontend` Next.js production build (`npm run build`)

- [ ] **Step 1: Run frontend test suites**

Run: `cd frontend && npm test`
Expected: PASS with all suites passing.

- [ ] **Step 2: Run frontend Next.js build**

Run: `cd frontend && npm run build`
Expected: Output compiling all routes successfully without any SSR, hydration, or TypeScript errors.

- [ ] **Step 3: Run backend test suites**

Run: `cd backend && npm test`
Expected: 12/12 test suites PASS (81/81 tests).

- [ ] **Step 4: Commit any final polishing changes**

```bash
git commit --allow-empty -m "chore(companion): verify full frontend and backend test suite"
```
