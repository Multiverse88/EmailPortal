# Account & Storage Retention Reminder (3-Month Policy & 1-Month Warning) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement account and storage retention reminder showing that accounts and storage files only last 3 months from creation, with prominent 1-month remaining warnings in Settings prompting users to backup their files and contact support (1x24 hour turnaround).

**Architecture:** 
- A dedicated backend calculation utility (`computeRetention`) calculates 90-day (3-month) expiration, elapsed days, remaining days, and threshold flags from `customer.createdAt`.
- Exposed via `GET /api/settings` as a structured `retention` response payload.
- Frontend Settings page (`/settings`) displays the 3-month retention info in the summary header and profile/general panels, and renders an amber warning banner when ≤ 30 days remain, equipped with a 1-click support ticket modal trigger and backup shortcuts.

**Tech Stack:** 
- Node.js, Express, TypeScript, Prisma (SQLite), Jest, Supertest
- Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React

## Global Constraints
- Account retention duration: 90 days (3 months) calculated from `customer.createdAt`.
- Warning threshold: 30 days (1 month remaining) or less.
- Warning message must explicitly inform:
  1. Akun dan file penyimpanan hanya bertahan selama 3 bulan semenjak akun dibuat.
  2. Memasuki 1 bulan terakhir, akun akan bersifat non-aktif beserta penyimpanannya.
  3. Harap segera backup ke penyimpanan user sendiri.
  4. Jika terjadi kendala setelah akun non-aktif, silakan membuka ticket support yang akan diproses 1x24 jam.
- UI location: Exclusively and prominently placed in the Settings page (`/settings`).
- Direct action: Button to open `SupportTicketModal` with pre-filled category/subject/priority and a shortcut to `/documents` for backup.

---

### Task 1: Backend Retention Calculator Utility & Unit Tests

**Files:**
- Create: `backend/src/lib/retention.ts`
- Create: `backend/tests/retention.test.ts`
- Modify: `backend/src/routes/settings.ts`

**Interfaces:**
- Consumes: `customer.createdAt: Date`
- Produces: `AccountRetentionInfo` object:
  ```ts
  export interface AccountRetentionInfo {
    createdAt: string;
    expiresAt: string;
    retentionDays: number;
    remainingDays: number;
    elapsedDays: number;
    percentUsed: number;
    isExpiringSoon: boolean;
    isExpired: boolean;
    warningThresholdDays: number;
    policyNotice: string;
    warningNotice?: string;
  }
  ```

- [ ] **Step 1: Write the failing retention test suite**

Write `backend/tests/retention.test.ts` checking `computeRetention`:
1. Account created today (0 days elapsed): 90 days remaining, `isExpiringSoon: false`, `isExpired: false`, `percentUsed: 0%`.
2. Account created 65 days ago (25 days remaining): `isExpiringSoon: true`, `isExpired: false`, `remainingDays: 25`.
3. Account created 95 days ago (expired): `isExpired: true`, `isExpiringSoon: false`, `remainingDays: 0`.
4. `GET /api/settings` integration test returning `retention` property with correct format.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/retention.test.ts`
Expected: FAIL with module not found or computeRetention undefined.

- [ ] **Step 3: Implement `backend/src/lib/retention.ts`**

Implement `computeRetention(createdAt: Date | string, now?: Date): AccountRetentionInfo` with:
- 90 days total retention (`RETENTION_DAYS = 90`)
- 30 days warning threshold (`WARNING_THRESHOLD_DAYS = 30`)
- Exact day difference calculations using UTC midnight normalization or millisecond ceiling
- Standard policy text and warning text containing backup and 1x24-hour support SLA instructions.

- [ ] **Step 4: Integrate retention calculation into `GET /api/settings`**

In `backend/src/routes/settings.ts`, import `computeRetention` and append `retention: computeRetention(customer.createdAt)` to the JSON response.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/retention.test.ts`
Expected: PASS with 100% assertions satisfied.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/retention.ts backend/src/routes/settings.ts backend/tests/retention.test.ts
git commit -m "feat(backend): implement 3-month account retention calculation and settings endpoint integration"
```

---

### Task 2: Support Ticket Modal Enhancement for Retention Category

**Files:**
- Modify: `frontend/src/components/support-ticket-modal.tsx`

**Interfaces:**
- Consumes: `initialCategory?: string`, `initialSubject?: string`, `initialMessage?: string`, `initialPriority?: 'normal' | 'urgent'`
- Produces: Enhanced `SupportTicketModal` supporting dynamic props syncing and specialized notice for `'Masa Aktif & Retensi Akun'` (1x24 jam SLA notice).

- [ ] **Step 1: Update `SupportTicketModal` to sync state on prop change**

Add a `useEffect` in `frontend/src/components/support-ticket-modal.tsx` so that whenever `isOpen` transitions to `true`, the form state (`category`, `subject`, `message`, `priority`) re-syncs with the passed props.

- [ ] **Step 2: Add `'Masa Aktif & Retensi Akun'` category option and 1x24 jam SLA notice**

In the category dropdown, add:
```tsx
<option value="Masa Aktif & Retensi Akun">Masa Aktif &amp; Retensi Akun</option>
```
When `category === 'Masa Aktif & Retensi Akun'`, render an info alert:
```tsx
<div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[11px]">
  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
  <div>
    <span className="font-semibold">Layanan Bantuan Masa Aktif Akun (1x24 Jam)</span>
    <p className="text-amber-800 mt-0.5">
      Permohonan perpanjangan atau pemulihan akun non-aktif akan diproses oleh tim kami maksimal dalam kurun waktu 1x24 jam kerja.
    </p>
  </div>
</div>
```

- [ ] **Step 3: Run frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/support-ticket-modal.tsx
git commit -m "feat(frontend): enhance SupportTicketModal with retention category and 1x24h SLA notice"
```

---

### Task 3: Settings Page UI — 3-Month Information & 1-Month Expiry Reminder

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `res.data.retention: AccountRetentionInfo` from `GET /api/settings`
- Produces:
  1. Top Warning Alert in Settings (when `isExpiringSoon` or `isExpired`) with backup guidelines and 1x24h support ticket button.
  2. Masa Aktif indicator in Account Summary Header.
  3. Detailed "Masa Aktif & Retensi Penyimpanan (3 Bulan)" section in Profile tab.
  4. Info banner in General tab.

- [ ] **Step 1: Update state and data fetching in `SettingsContent`**

In `frontend/src/app/settings/page.tsx`:
- Add `interface AccountRetentionInfo` matching backend definition.
- Add `const [retention, setRetention] = useState<AccountRetentionInfo | null>(null);`
- In `fetchSettings`: `if (res.data.retention) setRetention(res.data.retention);`
- Add support ticket helper states: `ticketInitialProps` so clicking the warning button opens the modal with pre-configured retention content:
  - `initialCategory: 'Masa Aktif & Retensi Akun'`
  - `initialSubject: 'Permohonan Perpanjangan / Kendala Masa Aktif Akun Non-Aktif'`
  - `initialMessage: 'Halo Tim Support EasyLegal,\n\nAkun saya akan/telah memasuki masa non-aktif setelah 3 bulan. Saya memerlukan bantuan perpanjangan atau pemulihan akses data saya.\n\nTerima kasih.'`
  - `initialPriority: 'urgent'`

- [ ] **Step 2: Add the 1-Month Remaining Warning Alert Box in Settings**

Directly above or below the Account Profile Summary Banner in `frontend/src/app/settings/page.tsx`, render:
When `retention && (retention.isExpiringSoon || retention.isExpired)`:
- Amber / Alert container with `data-testid="retention-warning-alert"`
- Header: `⚠️ Peringatan: Masa Aktif Akun & Penyimpanan Tersisa ${retention.remainingDays} Hari (Kurang dari 1 Bulan)`
- Message:
  - *"Akun dan seluruh file penyimpanan Anda hanya berlaku selama 3 bulan semenjak akun ini dibuat. Dalam 1 bulan ke depan (tersisa {remainingDays} hari), akun ini akan bersifat non-aktif beserta seluruh file penyimpanannya."*
  - *"Harap segera melakukan backup berkas penting ke dalam penyimpanan Anda sendiri."*
  - *"Jika terjadi kendala setelah akun dinonaktifkan atau Anda memerlukan perpanjangan waktu, silakan membuka tiket support yang akan diproses maksimal dalam 1x24 jam."*
- Action Buttons:
  - `[ 🎫 Buka Tiket Support (Diproses 1x24 Jam) ]` -> opens `SupportTicketModal`
  - `[ 📁 Ke Berkas Dokumen untuk Backup ]` -> routes to `/documents`

- [ ] **Step 3: Add Masa Aktif Widget in the Account Summary Header**

In the Account Profile Summary Banner (beside the Cloud Storage widget):
- Display:
  - "Masa Aktif Akun (3 Bulan)"
  - Sisa hari: `{retention.remainingDays} Hari` (atau "Berakhir" jika expired)
  - Visual progress bar (% elapsed / 90 days)
  - Date range: `Dibuat: {formattedCreatedAt} • Berakhir: {formattedExpiresAt}`
  - Badge:
    - Amber badge if `isExpiringSoon`: `⚠️ Sisa {retention.remainingDays} Hari`
    - Emerald badge if normal: `Aktif (3 Bulan)`

- [ ] **Step 4: Add Dedicated "Masa Retensi & Kebijakan 3 Bulan" Card in Profile Tab**

In the Profile tab (right next to or under the S3 Storage card):
- Add a comprehensive details section explaining the 3-month policy:
  - Tanggal Pembuatan Akun
  - Tanggal Berakhir Masa Aktif (3 Bulan)
  - Status Masa Aktif
  - Kebijakan Penyimpanan S3 (Otomatis Non-Aktif setelah 3 bulan)
  - Backup Mandiri & Dukungan Tiket 1x24 Jam
  - Button to open support ticket

- [ ] **Step 5: Run frontend build and typecheck**

Run: `cd frontend && npm run build`
Expected: PASS with all routes compiled cleanly.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "feat(frontend): add 3-month account retention info and 1-month expiration reminder in settings"
```

---

### Task 4: Seed Demo Data Update & Realistic Test Verification

**Files:**
- Modify: `backend/src/lib/demo-data.ts`
- Modify: `backend/tests/security-settings.test.ts`

**Interfaces:**
- Consumes: `seedDemoData`
- Produces:
  - `budi@clienteasylegal.co.id`: created 15 days ago -> 75 days remaining (normal state, > 30 days).
  - `trial@clienteasylegal.co.id`: created 65 days ago -> 25 days remaining (expiring soon, <= 30 days, triggers the reminder).

- [ ] **Step 1: Update customer seed data with realistic `createdAt`**

In `backend/src/lib/demo-data.ts`:
- Set `budi` customer `createdAt` to 15 days ago (`new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)`).
- Set `trial` customer `createdAt` to 65 days ago (`new Date(Date.now() - 65 * 24 * 60 * 60 * 1000)`).

- [ ] **Step 2: Update `backend/tests/security-settings.test.ts` to assert retention payload**

Add test case in `backend/tests/security-settings.test.ts` verifying that `GET /api/settings` includes the `retention` property and correctly reflects the retention days and warning flags.

- [ ] **Step 3: Run all backend tests**

Run: `cd backend && npm test`
Expected: PASS (all test suites passing).

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/demo-data.ts backend/tests/security-settings.test.ts
git commit -m "test(backend): seed customer retention dates and add integration test coverage"
```

---

### Task 5: End-to-End Verification & Push to GitHub

**Files:**
- None (Verification & Git push)

- [ ] **Step 1: Run full backend test suite**
Run: `npm --prefix backend test`
Expected: 12/12 suites passing.

- [ ] **Step 2: Run frontend production build**
Run: `npm --prefix frontend run build`
Expected: Clean build without errors or warnings.

- [ ] **Step 3: Push changes to GitHub**
Push to branch `feat/synology-sync-rbac-radar`.
