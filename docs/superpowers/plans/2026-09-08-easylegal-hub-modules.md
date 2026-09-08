# EasyLegal Hub Extended Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the EasyLegal customer email portal into a unified Google Workspace-style EasyLegal Suite & Hub, adding Account Settings, Login Activity & Security, Legal Documents Drive & Preview, and Support Helpdesk & Ticket Thread with persistent SQLite Prisma storage and realistic legal demo datasets.

**Architecture:** Extend backend Prisma schema with models for LoginSession, LegalDocument, DocumentVersion, SupportTicket, TicketMessage, and Customer fields. Provide modular Express routes (`/api/security`, `/api/settings`, `/api/documents`, `/api/support`). On the frontend, introduce a universal 9-dots App Launcher in the shared header and build responsive Next.js pages for `/settings`, `/documents`, and `/support` faithful to the Stitch minimal Google-style designs.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons, Express 4, Prisma ORM, SQLite, Multer (uploads).

## Global Constraints
- Do NOT push to any remote git repository (commit locally only).
- Retain existing email mailbox, demo seeder, and auth workflows intact.
- Follow Stitch design tokens: Legal Red (`#680003` / `#930006`), Cream (`#FDFCFB`), Surface Light (`#F8F9FA`), Border Subtle (`#DADCE0`).
- Ensure all interactive actions (2FA switch, password change, terminate sessions, reply ticket, star/delete document) update the backend database.

---

### Task 1: Database Schema Migration & Extended Seeder

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `backend/src/lib/demo-data.ts`
- Test: `backend/tests/schema.test.ts`

**Interfaces:**
- Consumes: Customer model in `prisma/schema.prisma`
- Produces: `LoginSession`, `LegalDocument`, `DocumentVersion`, `SupportTicket`, `TicketMessage` models with seeded records for customer `trial` and `budi`.

- [ ] **Step 1: Write test to verify new models exist in Prisma Client**

```typescript
// backend/tests/schema.test.ts
import { PrismaClient } from '@prisma/client';

describe('Prisma Schema Extended Models', () => {
  const prisma = new PrismaClient();
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should have access to new hub models on prisma client', () => {
    expect(prisma.loginSession).toBeDefined();
    expect(prisma.legalDocument).toBeDefined();
    expect(prisma.documentVersion).toBeDefined();
    expect(prisma.supportTicket).toBeDefined();
    expect(prisma.ticketMessage).toBeDefined();
  });
});
```

- [ ] **Step 2: Update `prisma/schema.prisma` with Hub models**

Add models `LoginSession`, `LegalDocument`, `DocumentVersion`, `SupportTicket`, `TicketMessage` and customer fields `twoFactorEnabled`, `preferences` as specified in the design doc.

- [ ] **Step 3: Run `npx prisma db push` to generate client and update database**

Run command in root or backend: `npx prisma db push`

- [ ] **Step 4: Update `backend/src/lib/demo-data.ts` to seed documents, tickets, and sessions**

Add seed data for:
- Legal Documents referencing existing files in `backend/storage/` (`sk-kemenkumham-2026.pdf`, `perjanjian-kerjasama.pdf`, `invoice-2025-088.pdf`, `panduan-trial.pdf`).
- Version history for documents (`v2.1 Approved by Sarah J.`, `v2.0`, `v1.0`).
- Support tickets: `#TK-4920: Document Review Delay`, `#TK-4811: Billing Discrepancy`, `#TK-4925: Access Revocation Error` with messages and internal notes.
- Login sessions: MacBook Pro 16" (Current), iPhone 14 Pro, Windows Desktop.

- [ ] **Step 5: Run tests and verify database seeding**

Run: `npm run seed:demo`
Verify with: `npm --prefix backend test tests/schema.test.ts`

- [ ] **Step 6: Commit locally**

```bash
git add prisma/schema.prisma backend/src/lib/demo-data.ts backend/tests/schema.test.ts
git commit -m "feat(db): add Prisma models and demo seeder for EasyLegal Hub modules"
```

---

### Task 2: Backend API Routes for Security & Settings

**Files:**
- Create: `backend/src/routes/security.ts`
- Create: `backend/src/routes/settings.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/security-settings.test.ts`

**Interfaces:**
- Consumes: `authenticateCustomer` from `backend/src/middleware/auth.ts`, `prisma` client.
- Produces:
  - `GET /api/security/sessions` -> `{ sessions: LoginSession[] }`
  - `POST /api/security/2fa/toggle` -> `{ twoFactorEnabled: boolean }`
  - `POST /api/security/sessions/terminate-others` -> `{ message: string, terminatedCount: number }`
  - `GET /api/settings` -> `{ user: Customer, preferences: object }`
  - `PUT /api/settings/preferences` -> `{ preferences: object }`

- [ ] **Step 1: Write failing test for Security and Settings endpoints**

Create `backend/tests/security-settings.test.ts` testing 2FA toggle, session listing, terminate other sessions, and preferences update.

- [ ] **Step 2: Implement `backend/src/routes/security.ts`**

Handle session listing, 2FA toggle on customer record, and delete non-current sessions for the authenticated customer.

- [ ] **Step 3: Implement `backend/src/routes/settings.ts`**

Handle retrieving customer profile + preferences and saving updated preferences JSON.

- [ ] **Step 4: Mount routes in `backend/src/app.ts`**

Mount `/api/security` and `/api/settings` behind `authenticateCustomer`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix backend test tests/security-settings.test.ts`

- [ ] **Step 6: Commit locally**

```bash
git add backend/src/routes/security.ts backend/src/routes/settings.ts backend/src/app.ts backend/tests/security-settings.test.ts
git commit -m "feat(backend): add security and settings endpoints"
```

---

### Task 3: Backend API Routes for Legal Documents & Support Helpdesk

**Files:**
- Create: `backend/src/routes/documents.ts`
- Create: `backend/src/routes/support.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/documents-support.test.ts`

**Interfaces:**
- Consumes: `authenticateCustomer`, `prisma`, `backend/storage/`
- Produces:
  - `GET /api/documents` -> `{ documents: LegalDocument[], folders: string[], storageUsed: number, storageLimit: number }`
  - `GET /api/documents/:id` -> `{ document: LegalDocument, versions: DocumentVersion[] }`
  - `GET /api/documents/:id/download` -> file stream
  - `POST /api/documents/upload` -> `{ document: LegalDocument }`
  - `PATCH /api/documents/:id/star` -> `{ isStarred: boolean }`
  - `DELETE /api/documents/:id` -> `{ success: boolean }`
  - `GET /api/support/tickets` -> `{ tickets: SupportTicket[] }`
  - `GET /api/support/tickets/:id` -> `{ ticket: SupportTicket, messages: TicketMessage[] }`
  - `POST /api/support/tickets` -> `{ ticket: SupportTicket }`
  - `POST /api/support/tickets/:id/reply` -> `{ message: TicketMessage }`
  - `POST /api/support/tickets/:id/close` -> `{ ticket: SupportTicket }`

- [ ] **Step 1: Write failing test for Documents & Support endpoints**

Test listing documents, downloading files, starring, listing tickets, fetching ticket thread, and sending reply.

- [ ] **Step 2: Implement `backend/src/routes/documents.ts`**

Implement listing, detail with versions, streaming download from `backend/storage`, upload with multer, star toggle, and delete.

- [ ] **Step 3: Implement `backend/src/routes/support.ts`**

Implement ticket listing, ticket detail with messages, create ticket, send reply, and close ticket.

- [ ] **Step 4: Mount routes in `backend/src/app.ts`**

Mount `/api/documents` and `/api/support` behind `authenticateCustomer`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix backend test tests/documents-support.test.ts`

- [ ] **Step 6: Commit locally**

```bash
git add backend/src/routes/documents.ts backend/src/routes/support.ts backend/src/app.ts backend/tests/documents-support.test.ts
git commit -m "feat(backend): add documents and support helpdesk endpoints"
```

---

### Task 4: Global App Launcher Component & Shared Navigation

**Files:**
- Create: `frontend/src/components/app-launcher.tsx`
- Modify: `frontend/src/app/inbox/page.tsx`
- Test: Check rendering of 9-dots menu in inbox header

**Interfaces:**
- Produces: `<AppLauncher currentApp="mail" | "documents" | "support" | "settings" />`
- Links directly to `/inbox`, `/documents`, `/support`, `/settings`.

- [ ] **Step 1: Create `frontend/src/components/app-launcher.tsx`**

Implement Google-style 9-dots popover button with icons and descriptions for Mail, Documents, Support, and Settings. Include keyboard escape and outside click handler.

- [ ] **Step 2: Integrate `AppLauncher` into `/inbox` header**

Add `AppLauncher` next to help and profile icons in `frontend/src/app/inbox/page.tsx`. Also add navigation links in the bottom of inbox sidebar for quick access to Documents and Support.

- [ ] **Step 3: Verify visually in browser**

Ensure opening http://localhost:3000/inbox shows the 9-dots app launcher and clicking navigates properly.

- [ ] **Step 4: Commit locally**

```bash
git add frontend/src/components/app-launcher.tsx frontend/src/app/inbox/page.tsx
git commit -m "feat(frontend): add Google-style App Launcher and cross-app navigation"
```

---

### Task 5: Account Settings & Login Activity Frontend Page

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`
- Test: Visual & interactive testing of tabs, 2FA toggle, terminate sessions, and password change.

**Interfaces:**
- Consumes: `/api/settings`, `/api/security/sessions`, `/api/security/2fa/toggle`, `/api/security/sessions/terminate-others`, `/api/auth/change-password`
- Produces: Full Stitch-faithful Account Settings page with tabs: General, Profile, Security & Activity, Notifications.

- [ ] **Step 1: Expand `frontend/src/app/settings/page.tsx` with Tab Navigation**

Create tabs: `General`, `Profile`, `Security & Activity`, `Notifications`. Support URL query param `?tab=security`. Include `AppLauncher` in header.

- [ ] **Step 2: Build General & Profile Tab Panels**

- General: Language dropdown (ID/EN), Timezone (WIB/WITA/WIT), and Rich Email Signature textarea with live preview.
- Profile: Identity card, avatar initials, mailbox plan status, company name, and storage usage indicator.

- [ ] **Step 3: Build Security & Login Activity Panel**

- 2FA Switch Card: toggle with status badge ("Currently OFF" / "Active Protected").
- Password Update Card: Current password, New password, Confirm password with eye toggle and password requirements checklist.
- Emergency Sign-out Card: "Sign out of all other sessions" with "Terminate Sessions" button.
- Recent Login Activity Table: List sessions (MacBook Pro Current Session, iPhone, Windows PC) with device icons, IP address, location, and timestamps.

- [ ] **Step 4: Connect frontend state to backend APIs**

Hook up `api.post('/security/2fa/toggle')`, `api.post('/security/sessions/terminate-others')`, and `api.get('/security/sessions')`.

- [ ] **Step 5: Verify page functionality**

Test toggling 2FA, terminating other sessions, and switching tabs on http://localhost:3000/settings.

- [ ] **Step 6: Commit locally**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "feat(frontend): implement comprehensive Account Settings and Login Activity page"
```

---

### Task 6: Legal Documents Drive & Interactive Document Preview

**Files:**
- Create: `frontend/src/app/documents/page.tsx`
- Create: `frontend/src/components/document-preview-modal.tsx`
- Test: Visual & functional test of folder navigation, file preview, and download.

**Interfaces:**
- Consumes: `/api/documents`, `/api/documents/:id`, `/api/documents/:id/download`, `/api/documents/:id/star`, `/api/documents/upload`
- Produces: Complete Legal Document Drive page and Document Preview viewer with version history.

- [ ] **Step 1: Create `frontend/src/components/document-preview-modal.tsx`**

Implement full Document Preview viewer matching `document_preview_easylegal_hub`:
- Canvas: Document layout, header with `CONFIDENTIAL` watermark, date, multi-page simulation or embedded PDF iframe viewing `/api/documents/:id/download`.
- Sidebar: Primary actions (Download button, Share button, Rename), File details (type, size, uploaded date, owner avatar), Version history timeline (`v2.1 Approved`, `v2.0`, `v1.0`), and Delete Document button.

- [ ] **Step 2: Create `frontend/src/app/documents/page.tsx`**

Implement Google Drive style repository matching `files_documents_easylegal_hub`:
- Sidebar: "Upload File" button, My Files, Recent, Starred, Shared with me, Trash, Labels (Contracts, Invoices), and Storage meter (`4.2 GB / 15 GB`, progress bar 28%).
- Main canvas: Breadcrumbs, Grid/List view switcher, Folders section (Client Agreements, Tax Filings 2023, NDA Templates), Files bento grid with thumbnails, status tags (`Urgent Review`, `Reviewed`), star button, and 3-dots menu.
- Upload File dialog modal allowing new file uploads.

- [ ] **Step 3: Connect document clicks to preview modal & download**

Ensure clicking any file opens the preview modal and clicking Download triggers file download.

- [ ] **Step 4: Verify in browser**

Open http://localhost:3000/documents, browse folders, click on a document, verify preview and version history, test star toggle.

- [ ] **Step 5: Commit locally**

```bash
git add frontend/src/app/documents/page.tsx frontend/src/components/document-preview-modal.tsx
git commit -m "feat(frontend): implement Legal Documents Drive and Document Preview viewer"
```

---

### Task 7: Support Helpdesk & Interactive Ticket Thread

**Files:**
- Create: `frontend/src/app/support/page.tsx`
- Create: `frontend/src/components/ticket-thread-modal.tsx`
- Test: Interactive ticket thread reply and status close.

**Interfaces:**
- Consumes: `/api/support/tickets`, `/api/support/tickets/:id`, `/api/support/tickets/:id/reply`, `/api/support/tickets/:id/close`, `/api/support/tickets`
- Produces: Support Helpdesk dashboard and interactive conversation thread viewer.

- [ ] **Step 1: Create `frontend/src/components/ticket-thread-modal.tsx`**

Implement thread viewer matching `ticket_thread_easylegal_hub`:
- Ticket Header: Badges (`Urgent`, `Open`), ticket number (`#TK-4920`), subject, Print and Close Ticket actions.
- Conversation timeline: Client message bubble, Official Support Agent bubble (with agent badge), and Internal Team Note (dashed border with lock icon).
- Reply Composer: Formatting toolbar (bold, italic, attach, link), textarea, "Save Draft", and "Send Message" button.

- [ ] **Step 2: Create `frontend/src/app/support/page.tsx`**

Implement Help Center matching `support_easylegal_hub`:
- Search knowledge base input.
- 24/7 Live Support banner with "Contact Live Support" button.
- Active Tickets list with status indicators (Open, Resolved, Urgent), ticket IDs, and last updated timestamps.
- FAQ Accordion section (How do I securely share documents?, Response SLA times, etc.).
- New Ticket modal dialog to open a fresh inquiry.

- [ ] **Step 3: Connect ticket interactions**

Hook up clicking a ticket to open `ticket-thread-modal.tsx`, sending a reply message (which appends to the thread and updates backend database), and closing the ticket.

- [ ] **Step 4: Verify in browser**

Open http://localhost:3000/support, click on a ticket, write a test reply message, verify it appears in the thread, test closing ticket.

- [ ] **Step 5: Commit locally**

```bash
git add frontend/src/app/support/page.tsx frontend/src/components/ticket-thread-modal.tsx
git commit -m "feat(frontend): implement Support Help Center and Ticket Conversation Thread"
```

---

### Task 8: End-to-End Integration & Validation

**Files:**
- Modify: `e2e/hub-navigation.spec.ts` (or manual verification suite)
- Modify: `README.md`

- [ ] **Step 1: Run comprehensive dev server verification**

Check backend endpoints:
- `curl -s http://localhost:4000/health`
- Check frontend pages at `http://localhost:3000/inbox`, `http://localhost:3000/settings`, `http://localhost:3000/documents`, `http://localhost:3000/support`.

- [ ] **Step 2: Verify App Launcher cross-navigation**

Verify jumping between Mail, Documents, Support, and Settings works seamlessly from any page.

- [ ] **Step 3: Document newly added modules in `README.md`**

Update documentation with instructions on accessing Legal Drive, Support Helpdesk, Account Settings, and Login Activity.

- [ ] **Step 4: Final commit locally (no git push)**

```bash
git add README.md
git commit -m "docs: document EasyLegal Hub extended modules and navigation"
```
