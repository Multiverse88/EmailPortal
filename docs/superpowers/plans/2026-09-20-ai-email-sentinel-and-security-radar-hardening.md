# AI Email Sentinel & Security Radar Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement AI Email Sentinel (Dual-Engine Hybrid for BEC/Phishing detection with in-memory PII sanitization and intelligent local heuristic fallback), integrate async non-blocking background analysis into email sync, eliminate multi-IP anomaly checks from security monitoring to remove ambiguity, and expose AI threat insights to Super Admin Security Radar.

**Architecture:**
- **Tier-1 Fast Path:** Local deterministic scanner (`scanEmailContent`) runs inline during email sync (<15ms), persisting emails to `MessageCache` immediately.
- **Tier-2 Async Sentinel:** Non-blocking background task calls `analyzeEmailThreat` in `backend/src/lib/ai-email-sentinel.ts`:
  - `sanitizePii` in-memory masks account numbers, credit cards, NIK, and phone numbers.
  - 9router LLM semantic analysis with a 3.5-second timeout and structured JSON output.
  - `analyzeLocalHeuristic` fallback for offline/timeout/missing API key resilience.
  - Threat detection updates `MessageCache` (`securityStatus = 'threat'`), logs to `AuditLog`, and notifies Super Admin via Telegram.
- **Security Monitor Hardening:** Remove `multi_ip` logic from `security-monitor.ts` and `security-events.ts`. Focus radar on brute-force attempts and active sessions.
- **Super Admin Radar:** Update `frontend/src/app/admin/page.tsx` to remove multi-IP banners and show the AI Threat Feed.

**Tech Stack:** Node.js, Express, TypeScript, Prisma ORM, Next.js 14 App Router, Tailwind CSS, Lucide Icons, Jest, Supertest.

---

## Global Constraints & Principles

- **Zero Business Disruption:** Email sync must never block on AI responses. If AI fails, times out, or throws, email ingestion continues normally.
- **Zero Data Leakage:** PII must always be masked before semantic analysis.
- **Super Admin Exclusive:** Threat insights and alerts are visible only to Super Admin, keeping Officer workflows clean.
- **No Multi-IP Ambiguity:** Completely retire multi-IP anomaly metrics and alerts.
- **Ponytail Senior Dev Mode:** Minimal necessary diff, reuse existing helpers (`crypto`, `date-fns`, `telegram`), no unnecessary abstractions.

---

### Task 1: AI Email Sentinel Engine (`backend/src/lib/ai-email-sentinel.ts`)

**Files:**
- Create: `backend/src/lib/ai-email-sentinel.ts`
- Test: `backend/tests/ai-email-sentinel.test.ts`

**Interfaces:**
- Produces:
  - `sanitizePii(text: string): string`
  - `analyzeEmailThreat(params: { sender?: string | null; subject?: string | null; bodyText?: string | null; bodyHtml?: string | null }): Promise<AiSentinelResult>`
  - `analyzeLocalHeuristic(params: ...): AiSentinelResult`
  - Types: `AiSentinelResult`, `ThreatCategory`

- [ ] **Step 1: Write unit tests in `backend/tests/ai-email-sentinel.test.ts`**
  - Test PII masking (bank accounts, cards, NIK, phone numbers).
  - Test BEC bank redirection detection (Indonesian wording).
  - Test false legal intimidation detection.
  - Test local heuristic fallback when 9router is disabled or offline.
  - Test clean legitimate email passing with `isThreat: false`.

- [ ] **Step 2: Implement `backend/src/lib/ai-email-sentinel.ts`**
  - Implement regex-based `sanitizePii`.
  - Implement `analyzeLocalHeuristic` with comprehensive Indonesian business/legal patterns.
  - Implement `analyzeEmailThreat` with `AbortController` (3500ms timeout) and JSON schema parsing.

- [ ] **Step 3: Run unit tests**
  - Run `npx jest backend/tests/ai-email-sentinel.test.ts` and verify 100% pass.

---

### Task 2: Asynchronous Non-Blocking Integration in Email Sync (`backend/src/workers/sync.ts`)

**Files:**
- Modify: `backend/src/workers/sync.ts`
- Test: `backend/tests/sync-worker.test.ts`

**Changes:**
- Add `runAsyncSentinelEnrichment(messageId: string, emailData: { sender: string; subject: string; bodyText: string; bodyHtml?: string; customerName: string; mailboxAddress: string })`.
- Call `void runAsyncSentinelEnrichment(...)` non-blockingly after `messageCache.upsert` in both API and IMAP sync flows.
- Ensure any promise rejections inside the async enrichment are caught and logged without propagating.
- Only dispatch Telegram notifications when status transitions to `threat` to avoid duplicate alerts.

- [ ] **Step 1: Update `backend/src/workers/sync.ts`**
  - Wire up non-blocking AI Sentinel background enrichment.
- [ ] **Step 2: Run sync worker test suite**
  - Run `npx jest backend/tests/sync-worker.test.ts` and ensure clean passage.

---

### Task 3: Retire Multi-IP Anomaly Checks in Security Monitor & Routes

**Files:**
- Modify: `backend/src/workers/security-monitor.ts`
- Modify: `backend/src/lib/security-events.ts`
- Modify: `backend/src/routes/security.ts`
- Test: `backend/tests/security-scanner.test.ts`

**Changes:**
- Remove `THRESHOLD_MULTI_IP`, `multi_ip` anomaly detection, and `multiIpAlerts` counter from `runSecurityScan`.
- Keep `brute_force` detection and active session counters intact.
- Remove multi-IP event emissions from `security-events.ts`.
- Clean up `/api/security/admin/radar` summary response so it no longer includes `multiIpAlertCount`.

- [ ] **Step 1: Update `security-monitor.ts`, `security-events.ts`, and `security.ts`**
- [ ] **Step 2: Verify security tests**
  - Run `npx jest backend/tests/security-scanner.test.ts` to confirm regression-free behavior.

---

### Task 4: Super Admin Security Radar UI Cleanup (`frontend/src/app/admin/page.tsx`)

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`

**Changes:**
- Remove the multi-IP alert banner (`radarData.summary.multiIpAlertCount > 0`).
- Remove multi-IP badges on the Radar tab button and account cards.
- Add an **AI Threat Detection Feed** section showing recent threats identified by AI Sentinel (`securityStatus === 'threat'`), displaying threat category, confidence score, and AI notes.
- Ensure Officer view remains completely untouched.

- [ ] **Step 1: Update `frontend/src/app/admin/page.tsx`**
- [ ] **Step 2: Verify frontend compilation**
  - Run `cd frontend && npm run build` (or `npx next build`) to ensure zero type or JSX errors.

---

### Task 5: End-to-End Verification & Documentation

- [ ] **Step 1: Run all backend tests**
  - Run `cd backend && npx jest --runInBand` and verify all tests pass.
- [ ] **Step 2: Verify backend TypeScript compilation**
  - Run `cd backend && npx tsc --noEmit` to ensure type correctness.
- [ ] **Step 3: Update documentation**
  - Note the AI Email Sentinel addition and multi-IP retirement in `docs/STATUS_PENGERJAAN.md`.
