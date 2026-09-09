# Officer 1-Click Customer Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Officers and Super Admins to seamlessly log in to any customer's mailbox with a single click from the mailbox list and the Officer workspace without needing customer passwords.

**Architecture:** Introduce an authenticated `POST /api/auth/impersonate/:customerId` backend endpoint guarded by `authenticateOfficerOrAdmin` that issues a legitimate customer JWT, logs the impersonation session in `LoginSession` and audit logs, and returns credentials. On the frontend, provide 1-click action buttons beside customer names/emails and inside the Officer Workspace that open customer webmail in a new tab with an active session, while displaying a prominent staff mode banner with an easy return path to the Admin Console.

**Tech Stack:** Node.js, Express, TypeScript, Prisma, SQLite, JWT (jsonwebtoken), React, Next.js 14, Zustand, Tailwind CSS, Jest, Supertest.

## Global Constraints

- Backend must authenticate officers (`officer`) and super admins (`superadmin`) via `authenticateOfficerOrAdmin`.
- Customers (`customer`) must be strictly blocked with HTTP 403 from invoking the impersonation endpoint.
- Inactive or suspended customers must be rejected with HTTP 403.
- Non-existent customers must return HTTP 404.
- Every impersonation event must create a `LoginSession` with device info specifying officer email/role and record an audit log entry (`customer.impersonate`).
- Impersonation in the browser must open in a new tab (`target="_blank"`) so the Admin Console session is never lost.
- All backend tests must pass with zero failures (`npm test`).
- Frontend TypeScript typecheck and build must pass without any errors (`npm run type-check`, `npm run build`).

---

### Task 1: Backend Impersonation API & Unit Tests

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Test: `backend/tests/impersonate.test.ts`

**Interfaces:**
- Consumes: `authenticateOfficerOrAdmin` from `../middleware/auth`, `prisma` from `@prisma/client`, `audit` from `../lib/audit`.
- Produces: `POST /api/auth/impersonate/:customerId` returning `{ token: string, user: CustomerUserPayload, impersonatedBy: { email: string, role: string } }`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/impersonate.test.ts`:
```typescript
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import authRoutes from '../src/routes/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const signToken = (id: string, email: string, type: 'admin' | 'customer', role?: string) =>
  jwt.sign({ id, email, type, role }, JWT_SECRET, { expiresIn: '1h' });

describe('POST /api/auth/impersonate/:customerId', () => {
  const mockPrisma: any = {
    customer: {
      findUnique: jest.fn(),
    },
    loginSession: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes(mockPrisma));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows officer to impersonate an active customer and returns customer token', async () => {
    const officerToken = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust-123',
      name: 'Budi Setiawan',
      mailboxAddress: 'budi@clienteasylegal.co.id',
      status: 'active',
      avatarUrl: null,
      storageQuota: 5368709120,
    });
    mockPrisma.loginSession.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/impersonate/cust-123')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      id: 'cust-123',
      email: 'budi@clienteasylegal.co.id',
      type: 'customer',
      role: 'customer',
    });
    expect(res.body.impersonatedBy).toMatchObject({
      email: 'officer@clienteasylegal.co.id',
      role: 'officer',
    });

    const decoded = jwt.verify(res.body.token, JWT_SECRET) as any;
    expect(decoded.id).toBe('cust-123');
    expect(decoded.email).toBe('budi@clienteasylegal.co.id');
    expect(decoded.type).toBe('customer');

    expect(mockPrisma.loginSession.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('allows superadmin to impersonate active customer', async () => {
    const adminToken = signToken('admin-1', 'admin@clienteasylegal.co.id', 'admin', 'superadmin');
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust-456',
      name: 'PT Sinar Jaya',
      mailboxAddress: 'ptsinarjaya@clienteasylegal.co.id',
      status: 'active',
      avatarUrl: null,
      storageQuota: 5368709120,
    });
    mockPrisma.loginSession.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/impersonate/cust-456')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ptsinarjaya@clienteasylegal.co.id');
    expect(res.body.impersonatedBy.role).toBe('superadmin');
  });

  it('blocks regular customer token with 403 Forbidden', async () => {
    const custToken = signToken('cust-1', 'budi@clienteasylegal.co.id', 'customer');

    const res = await request(app)
      .post('/api/auth/impersonate/cust-999')
      .set('Authorization', `Bearer ${custToken}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 if target customer does not exist', async () => {
    const officerToken = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/impersonate/non-existent-id')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/tidak ditemukan/i);
  });

  it('returns 403 if target customer is inactive', async () => {
    const officerToken = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust-inactive',
      mailboxAddress: 'inactive@clienteasylegal.co.id',
      status: 'inactive',
    });

    const res = await request(app)
      .post('/api/auth/impersonate/cust-inactive')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/dinonaktifkan/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/impersonate.test.ts` in `backend/`
Expected: FAIL because `/api/auth/impersonate/:customerId` route is not yet defined in `backend/src/routes/auth.ts`.

- [ ] **Step 3: Implement minimal backend endpoint**

In `backend/src/routes/auth.ts`:
Add the impersonate endpoint handler:
```typescript
  router.post('/impersonate/:customerId', authenticateOfficerOrAdmin, async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer tidak ditemukan' });
      }

      if (customer.status !== 'active') {
        return res.status(403).json({ error: 'Akun customer ini sedang dinonaktifkan atau ditangguhkan' });
      }

      const officerEmail = req.user?.email || 'admin@clienteasylegal.co.id';
      const officerRole = (req.user as any)?.role || 'officer';

      const token = sign(customer.id, customer.mailboxAddress, 'customer', 'customer');
      const clientInfo = parseClientInfo(req);

      await prisma.loginSession.create({
        data: {
          customerId: customer.id,
          deviceName: `${clientInfo.deviceName} (${officerRole}: ${officerEmail})`,
          deviceType: clientInfo.deviceType,
          browser: clientInfo.browser,
          ipAddress: clientInfo.ipAddress,
          location: clientInfo.location,
          isCurrent: true,
          lastActiveAt: new Date(),
        },
      });

      await audit(prisma, req, 'customer.impersonate', 'customer', customer.id, {
        officerEmail,
        officerRole,
        targetEmail: customer.mailboxAddress,
      });

      res.json({
        token,
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.mailboxAddress,
          type: 'customer',
          role: 'customer',
          avatarUrl: customer.avatarUrl,
          storageQuota: customer.storageQuota,
        },
        impersonatedBy: {
          email: officerEmail,
          role: officerRole,
        },
      });
    } catch (error) {
      console.error('Impersonation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/impersonate.test.ts` in `backend/`
Expected: PASS (all 5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.ts backend/tests/impersonate.test.ts
git commit -m "feat: add backend customer impersonation endpoint for officers and admins"
```

---

### Task 2: Frontend API Interceptor & Impersonation Bridge

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/auth/impersonate/page.tsx`

**Interfaces:**
- Consumes: `/auth/impersonate/:customerId` from Task 1.
- Produces: API interceptor token routing for impersonation requests and `/auth/impersonate` landing route that initializes customer session and redirects to `/inbox`.

- [ ] **Step 1: Update API interceptor in `frontend/src/lib/api.ts`**

Ensure `isAdminEndpoint` routes include `/auth/impersonate` so that the admin/officer's `admin_token` is attached to impersonation requests:
```typescript
  const isAdminEndpoint =
    url.includes('/mailboxes') ||
    url.includes('/storage') ||
    url.includes('/audit') ||
    url.includes('/auth/register') ||
    url.includes('/auth/impersonate') ||
    url.includes('/security/admin');
```

- [ ] **Step 2: Create impersonation bridge page `frontend/src/app/auth/impersonate/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export default function ImpersonateBridgePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    try {
      const token = searchParams.get('token');
      const userRaw = searchParams.get('user');
      const officerRaw = searchParams.get('officer');

      if (!token || !userRaw) {
        setStatus('error');
        setErrorMessage('Parameter token atau pengguna tidak valid');
        return;
      }

      const user = JSON.parse(decodeURIComponent(userRaw));
      if (officerRaw) {
        const officer = JSON.parse(decodeURIComponent(officerRaw));
        localStorage.setItem('staff_impersonation', JSON.stringify(officer));
      }

      setAuth(token, user, 'customer');
      router.replace('/inbox');
    } catch (err: any) {
      console.error('Impersonation bridge error:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Gagal memproses sesi impersonasi');
    }
  }, [router, searchParams, setAuth]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full p-6 bg-white rounded-2xl border border-red-200 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Gagal Membuka Sesi Customer</h2>
          <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Tutup Tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs font-semibold">Membuka sesi customer dengan otorisasi staf...</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript typecheck**

Run: `npm run type-check` in `frontend/`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/auth/impersonate/page.tsx
git commit -m "feat: add frontend api interceptor routing and impersonation bridge page"
```

---

### Task 3: Staff Impersonation Banner & Return to Admin

**Files:**
- Create: `frontend/src/components/staff-impersonation-banner.tsx`
- Modify: `frontend/src/components/suite-header.tsx`

**Interfaces:**
- Consumes: `localStorage.getItem('staff_impersonation')`.
- Produces: Visual alert bar across customer views indicating staff management mode with action button to return/exit.

- [ ] **Step 1: Create `frontend/src/components/staff-impersonation-banner.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface ImpersonationMeta {
  email: string;
  role: string;
}

export function StaffImpersonationBanner({
  customerName,
  customerEmail,
}: {
  customerName?: string;
  customerEmail?: string;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('staff_impersonation');
      if (raw) {
        setMeta(JSON.parse(raw));
      }
    } catch {
      setMeta(null);
    }
  }, []);

  if (!meta) return null;

  const handleExit = () => {
    localStorage.removeItem('staff_impersonation');
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      router.push('/admin');
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white text-xs px-4 py-2 font-medium flex items-center justify-between shadow-xs sticky top-0 z-50 border-b border-amber-600/30">
      <div className="flex items-center gap-2 truncate">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
          <ShieldAlert className="size-3" />
        </span>
        <span className="truncate">
          <strong className="font-bold">Mode Akses Staf Legal ({meta.role}):</strong> Anda sedang mengelola mailbox{' '}
          <span className="font-mono underline underline-offset-2">{customerEmail || 'klien'}</span>
          {customerName ? ` (${customerName})` : ''} oleh{' '}
          <span className="font-semibold">{meta.email}</span>.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-amber-900 font-bold text-[11px] rounded-lg shadow-2xs hover:bg-amber-50 transition-colors"
        >
          <ArrowLeft className="size-3" />
          <span>Kembali ke Admin Console</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Connect `StaffImpersonationBanner` in `SuiteHeader`**

In `frontend/src/components/suite-header.tsx`:
Mount `<StaffImpersonationBanner customerName={userName || undefined} customerEmail={userEmail || undefined} />` if `!admin`.

- [ ] **Step 3: Verify TypeScript and Build**

Run: `npm run type-check` in `frontend/`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/staff-impersonation-banner.tsx frontend/src/components/suite-header.tsx
git commit -m "feat: add staff impersonation banner to customer suite header"
```

---

### Task 4: 1-Click Login Buttons on Mailbox List & Officer Dashboard

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `api.post('/auth/impersonate/:customerId')`.
- Produces:
  1. Direct 1-click button beside each customer's name/email in the mailbox table.
  2. Quick 1-click launcher in the Officer Workspace tab.

- [ ] **Step 1: Add impersonation logic in `frontend/src/app/admin/page.tsx`**

Add state and click handler:
```typescript
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const handleImpersonate = async (customerId: string) => {
    try {
      setImpersonatingId(customerId);
      const res = await api.post(`/auth/impersonate/${customerId}`);
      const { token, user, impersonatedBy } = res.data;

      localStorage.setItem('customer_token', token);
      localStorage.setItem('customer_user', JSON.stringify(user));
      if (impersonatedBy) {
        localStorage.setItem('staff_impersonation', JSON.stringify(impersonatedBy));
      }

      const bridgeUrl = `/auth/impersonate?token=${encodeURIComponent(token)}&user=${encodeURIComponent(
        JSON.stringify(user)
      )}&officer=${encodeURIComponent(JSON.stringify(impersonatedBy))}`;

      window.open(bridgeUrl, '_blank');
      setToast(`Webmail ${user.email} berhasil dibuka di tab baru`);
      setTimeout(() => setToast(''), 3500);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Gagal membuka akun customer';
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } finally {
      setImpersonatingId(null);
    }
  };
```

- [ ] **Step 2: Place the 1-click button directly in the customer name & email column**

In the mailbox table (`frontend/src/app/admin/page.tsx`):
Beside `m.mailboxAddress`:
```tsx
  {/* Mailbox address + 1-Click Login Button */}
  <td className="px-5 py-3.5">
    <div className="flex items-center gap-2">
      <span className="font-mono text-slate-800 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
        {m.mailboxAddress}
      </span>
      {isActive && (
        <button
          type="button"
          data-testid={`impersonate-${m.id}`}
          title={`Login 1-klik ke mailbox ${m.mailboxAddress}`}
          onClick={() => handleImpersonate(m.id)}
          disabled={impersonatingId === m.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shrink-0 shadow-2xs disabled:opacity-50"
        >
          {impersonatingId === m.id ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
          )}
          <span>Buka Akun</span>
          <ExternalLink className="w-3 h-3 ml-0.5 opacity-75" />
        </button>
      )}
    </div>
  </td>
```

- [ ] **Step 3: Add Quick 1-Click Mailbox Access Section in Officer Workspace Tab**

In `activeTab === 'officer'` in `frontend/src/app/admin/page.tsx`:
Add a direct quick launcher table showing active customers with instant 1-click buttons:
```tsx
  {/* Quick 1-Click Mailbox Access for Officer */}
  <div className="app-panel p-5">
    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
      <span>Akses Cepat 1-Klik Mailbox Klien</span>
    </h4>
    <p className="text-[11px] text-slate-500 mt-1">
      Masuk langsung ke webmail klien untuk pengecekan dokumen dan korespondensi tanpa memasukkan sandi.
    </p>

    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      {mailboxes.filter(m => m.status === 'active').slice(0, 6).map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-primary/40 transition-colors"
        >
          <div className="min-w-0 pr-2">
            <span className="block text-xs font-bold text-slate-800 truncate">{m.name}</span>
            <span className="block text-[11px] font-mono text-slate-500 truncate">{m.mailboxAddress}</span>
          </div>
          <button
            type="button"
            onClick={() => handleImpersonate(m.id)}
            disabled={impersonatingId === m.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors shrink-0 shadow-xs disabled:opacity-50"
          >
            {impersonatingId === m.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            )}
            <span>Buka Webmail</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-75" />
          </button>
        </div>
      ))}
    </div>
  </div>
```

- [ ] **Step 4: Verify Frontend Build & Typecheck**

Run: `npm run type-check && npm run build` in `frontend/`
Expected: Build passes with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat: add 1-click customer login buttons to mailbox list and officer dashboard"
```

---

### Task 5: End-to-End Verification & Documentation

**Files:**
- Test all backend tests: `backend/`
- Test frontend build: `frontend/`
- Documentation update if needed: `README.md`

- [ ] **Step 1: Run complete backend test suite**

Run: `npm test` in `backend/`
Expected: All 11 test suites pass with 0 errors.

- [ ] **Step 2: Run complete frontend typecheck and build**

Run: `npm run type-check && npm run build` in `frontend/`
Expected: 100% PASS with 0 errors.

- [ ] **Step 3: Final commit and branch push**

```bash
git add -A
git commit -m "feat: complete 1-click customer login for officer and superadmin"
git push origin feat/synology-sync-rbac-radar
```
