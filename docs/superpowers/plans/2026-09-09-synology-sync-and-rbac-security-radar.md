# Synology Pure-Email Sync & 3-Tier RBAC Security Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pure email-based folder synchronization to Synology Drive with manual on-demand triggering, establish a 3-tier RBAC system (Super Admin, Officer, User), and build a Security Radar dashboard to detect active IPs, session counts, and multi-IP anomalies.

**Architecture:** 
The backend leverages an updated `SynologySyncService` that structures cold storage folders strictly by customer email address (`accounts/{mailboxAddress}/`), triggered only on-demand via an authenticated Super Admin API endpoint or a local desktop script. A 3-tier RBAC system divides responsibilities between Super Admin (Synology sync, global storage monitoring, multi-account security radar), Officer (unified staff console for mailbox provisioning, ticket response, official mail operations), and Customer/User (isolated 5 GB drive, profile management, personal device session radar). Active sessions record real client IP, user-agent, and timestamps to calculate concurrent users and trigger multi-IP alerts when accounts are accessed from multiple geographic/IP locations simultaneously.

**Tech Stack:** 
- Node.js, Express, TypeScript
- Prisma ORM with SQLite (dev/local)
- JWT authentication & Bcrypt
- Next.js 15, React 19, Tailwind CSS, Lucide Icons, SWR, Zustand
- Jest & Supertest for unit and integration testing
- Bash script for desktop 1-click sync execution

## Global Constraints

- Never trigger automatic background synchronization to Synology during customer upload; sync must remain 100% on-demand.
- Synology folder names must be the pure sanitized email address (e.g., `ptsinarjaya@clienteasylegal.co.id`), never containing parentheses or mixed names.
- Multi-tenancy isolation must be strictly preserved: customers can only view their own files, quota, and personal sessions.
- Officer accounts cannot access high-level system operations (Synology sync trigger, global storage inspector, global security radar).
- All new tests must pass alongside the existing 61 tests without regressions.

---

### Task 1: Synology Pure-Email Folder Structure & Test Updates

**Files:**
- Modify: `backend/src/lib/synology-sync.ts:38-48`
- Modify: `backend/tests/synology-sync.test.ts`

**Interfaces:**
- Consumes: `Customer` model (`mailboxAddress`, `personalEmail`)
- Produces: `getAccountFolderName(customer)` returning pure sanitized lowercase email string (e.g. `ptsinarjaya@clienteasylegal.co.id`)

- [ ] **Step 1: Update unit test to expect pure email folder names**

In `backend/tests/synology-sync.test.ts`, update assertions for `getAccountFolderName`:
```typescript
it('formats folder names cleanly using pure mailbox address', () => {
  expect(getAccountFolderName({ name: 'PT Sinar Jaya', mailboxAddress: 'ptsinarjaya@clienteasylegal.co.id' }))
    .toBe('ptsinarjaya@clienteasylegal.co.id');
  expect(getAccountFolderName({ name: 'Ahmad Subarjo', mailboxAddress: 'ahmad@clienteasylegal.co.id' }))
    .toBe('ahmad@clienteasylegal.co.id');
  expect(getAccountFolderName({ name: 'No Mailbox', personalEmail: 'personal@gmail.com' }))
    .toBe('personal@gmail.com');
  expect(getAccountFolderName(null)).toBe('general');
});
```

- [ ] **Step 2: Run test to verify it fails with the old format**

Run: `npm test -- tests/synology-sync.test.ts`
Expected: FAIL (was returning `"PT Sinar Jaya (ptsinarjaya@clienteasylegal.co.id)"`).

- [ ] **Step 3: Update `getAccountFolderName` in `backend/src/lib/synology-sync.ts`**

Replace `getAccountFolderName` with pure email resolution:
```typescript
export function getAccountFolderName(
  customer?: { name?: string | null; mailboxAddress?: string | null; personalEmail?: string | null } | null
): string {
  if (!customer) return 'general';
  const email = (customer.mailboxAddress || customer.personalEmail || '').trim().toLowerCase();
  if (email) {
    return sanitizeFolderName(email);
  }
  const fallback = (customer.name || '').trim().toLowerCase();
  return sanitizeFolderName(fallback) || 'general';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/synology-sync.test.ts`
Expected: PASS (all tests in `synology-sync.test.ts` pass).

- [ ] **Step 5: Commit changes**

```bash
git add backend/src/lib/synology-sync.ts backend/tests/synology-sync.test.ts
git commit -m "feat: use pure email naming for Synology cold storage folders"
```

---

### Task 2: Backend 3-Tier RBAC Middleware & Token Payload

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/lib/demo-data.ts`
- Create: `backend/tests/rbac-security.test.ts`

**Interfaces:**
- Consumes: `AdminUser.role` ('superadmin' | 'officer' | 'admin'), `Customer` (type: 'customer')
- Produces: `authenticateSuperAdmin`, `authenticateOfficerOrAdmin`, `authenticateCustomer`, extended `req.user` with `role`.

- [ ] **Step 1: Write failing test for RBAC middleware and role protection**

Create `backend/tests/rbac-security.test.ts`:
```typescript
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  authenticateSuperAdmin,
  authenticateOfficerOrAdmin,
  authenticateCustomer,
} from '../src/middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('RBAC Middleware', () => {
  const app = express();
  app.use(express.json());

  app.get('/api/superadmin-only', authenticateSuperAdmin, (req, res) => {
    res.json({ message: 'Welcome Super Admin', user: req.user });
  });

  app.get('/api/officer-or-admin', authenticateOfficerOrAdmin, (req, res) => {
    res.json({ message: 'Welcome Staff', user: req.user });
  });

  app.get('/api/customer-only', authenticateCustomer, (req, res) => {
    res.json({ message: 'Welcome Customer', user: req.user });
  });

  const signToken = (id: string, email: string, type: 'admin' | 'customer', role?: string) =>
    jwt.sign({ id, email, type, role }, JWT_SECRET, { expiresIn: '1h' });

  it('allows superadmin to access superadmin and officer endpoints', async () => {
    const token = signToken('admin-1', 'admin@clienteasylegal.co.id', 'admin', 'superadmin');
    const res1 = await request(app).get('/api/superadmin-only').set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app).get('/api/officer-or-admin').set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(200);
  });

  it('allows officer to access officer endpoint but blocks from superadmin endpoint', async () => {
    const token = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    const res1 = await request(app).get('/api/officer-or-admin').set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app).get('/api/superadmin-only').set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(403);
  });

  it('blocks customer from admin/officer endpoints', async () => {
    const token = signToken('cust-1', 'budi@clienteasylegal.co.id', 'customer');
    const res = await request(app).get('/api/superadmin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/rbac-security.test.ts`
Expected: FAIL (types and middleware functions do not exist yet).

- [ ] **Step 3: Update `backend/src/middleware/auth.ts`**

Update `backend/src/middleware/auth.ts` to support `role` in `Request.user`, and implement `authenticateSuperAdmin` and `authenticateOfficerOrAdmin`:
```typescript
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export type UserRole = 'superadmin' | 'officer' | 'admin' | 'customer';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        type: 'customer' | 'admin';
        email: string;
        role?: UserRole;
      };
    }
  }
}

export type AuthRequest = Request;

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as {
    id: string;
    email: string;
    type: 'customer' | 'admin';
    role?: UserRole;
  };
};

export const authenticateCustomer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    if (!token && typeof req.query.token === 'string') token = req.query.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = verifyToken(token);
    if (payload.type !== 'customer') {
      return res.status(403).json({ error: 'Forbidden: not a customer' });
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: not an admin' });
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateSuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: not an admin' });
    }
    const role = payload.role || 'admin';
    if (role !== 'superadmin' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateOfficerOrAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: not an admin' });
    }
    const role = payload.role || 'admin';
    if (role !== 'officer' && role !== 'superadmin' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Officer or Admin access required' });
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

- [ ] **Step 4: Update `backend/src/routes/auth.ts` to sign and return `role`**

In `backend/src/routes/auth.ts`:
1. Update `sign`:
```typescript
const sign = (id: string, email: string, type: 'customer' | 'admin', role?: string) =>
  jwt.sign({ id, email, type, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
```
2. In `POST /login/admin`:
```typescript
await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
res.json({
  token: sign(admin.id, admin.email, 'admin', admin.role),
  user: { id: admin.id, name: admin.name, email: admin.email, type: 'admin', role: admin.role },
});
```
3. Allow `authenticateOfficerOrAdmin` on `POST /register`.
4. In `backend/src/lib/demo-data.ts`, add Officer seed account:
```typescript
  const officer = await prisma.adminUser.create({
    data: {
      name: 'Officer Staf Legal',
      email: `officer@${domain}`,
      passwordHash: await bcrypt.hash('Officer123!', 10),
      role: 'officer',
      lastLoginAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });
```

- [ ] **Step 5: Run tests to verify**

Run: `npm test -- tests/rbac-security.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/auth.ts backend/src/lib/demo-data.ts backend/tests/rbac-security.test.ts
git commit -m "feat: implement 3-tier RBAC authentication and middleware"
```

---

### Task 3: Login Session Tracking & Security Radar Endpoints

**Files:**
- Modify: `backend/src/routes/auth.ts:42-68`
- Modify: `backend/src/routes/security.ts`
- Create: `backend/tests/security-radar.test.ts`

**Interfaces:**
- Consumes: `prisma.loginSession`, `prisma.customer`
- Produces:
  - `GET /api/security/sessions`: personal customer sessions with active session count
  - `GET /api/security/admin/radar`: Super Admin security radar with per-account active IPs, multi-IP alert, session list
  - `POST /api/security/admin/sessions/:sessionId/terminate`: terminate a specific session
  - `POST /api/security/admin/accounts/:customerId/terminate-all`: terminate all sessions for an account

- [ ] **Step 1: Write failing test for Security Radar endpoints**

Create `backend/tests/security-radar.test.ts`:
```typescript
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import securityRoutes from '../src/routes/security';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const prisma = new PrismaClient();

describe('Security Radar Endpoints', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/security', securityRoutes(prisma));

  let testCustomer: any;
  let adminToken: string;
  let officerToken: string;
  let customerToken: string;

  beforeAll(async () => {
    testCustomer = await prisma.customer.create({
      data: {
        name: 'PT Radar Test',
        personalEmail: 'radartest@example.com',
        mailboxAddress: 'radar@clienteasylegal.co.id',
        passwordEnc: 'mock_enc',
        status: 'active',
      },
    });

    // Create 2 sessions from different IPs for testCustomer to trigger multi-IP alert
    await prisma.loginSession.createMany({
      data: [
        {
          customerId: testCustomer.id,
          deviceName: 'Chrome on macOS',
          deviceType: 'laptop',
          browser: 'Chrome 128',
          ipAddress: '182.253.140.22',
          location: 'Jakarta, Indonesia',
          isCurrent: true,
          lastActiveAt: new Date(),
        },
        {
          customerId: testCustomer.id,
          deviceName: 'Safari on iPhone',
          deviceType: 'mobile',
          browser: 'Mobile Safari 17',
          ipAddress: '114.124.200.15',
          location: 'Surabaya, Indonesia',
          isCurrent: false,
          lastActiveAt: new Date(),
        },
      ],
    });

    adminToken = jwt.sign({ id: 'admin-1', email: 'admin@clienteasylegal.co.id', type: 'admin', role: 'superadmin' }, JWT_SECRET);
    officerToken = jwt.sign({ id: 'off-1', email: 'officer@clienteasylegal.co.id', type: 'admin', role: 'officer' }, JWT_SECRET);
    customerToken = jwt.sign({ id: testCustomer.id, email: testCustomer.mailboxAddress, type: 'customer' }, JWT_SECRET);
  });

  afterAll(async () => {
    await prisma.loginSession.deleteMany({ where: { customerId: testCustomer.id } });
    await prisma.customer.delete({ where: { id: testCustomer.id } });
    await prisma.$disconnect();
  });

  it('allows Super Admin to view security radar and detects multi-IP alert', async () => {
    const res = await request(app)
      .get('/api/security/admin/radar')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.accounts).toBeDefined();
    const accountReport = res.body.accounts.find((a: any) => a.id === testCustomer.id);
    expect(accountReport).toBeDefined();
    expect(accountReport.activeSessionsCount).toBe(2);
    expect(accountReport.uniqueIps.length).toBe(2);
    expect(accountReport.isMultiIpAlert).toBe(true);
  });

  it('blocks Officer from accessing global security radar', async () => {
    const res = await request(app)
      .get('/api/security/admin/radar')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
  });

  it('allows Super Admin to kick a specific session', async () => {
    const sessions = await prisma.loginSession.findMany({ where: { customerId: testCustomer.id } });
    const targetSession = sessions[0];

    const res = await request(app)
      .post(`/api/security/admin/sessions/${targetSession.id}/terminate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const check = await prisma.loginSession.findUnique({ where: { id: targetSession.id } });
    expect(check).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/security-radar.test.ts`
Expected: FAIL (endpoints `/admin/radar` and `/admin/sessions/:id/terminate` not yet implemented).

- [ ] **Step 3: Implement Session creation in `backend/src/routes/auth.ts`**

When customer logs in (`POST /login/customer`):
1. Helper function to parse user agent and IP:
```typescript
function parseClientInfo(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Unknown Device';
  
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipad/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/macintosh|windows|linux/i.test(ua)) {
    deviceType = 'laptop';
  }

  let browser = 'Browser Web';
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';

  return { ipAddress, deviceName: `${browser} on ${deviceType}`, deviceType, browser, location: 'Indonesia' };
}
```
2. In `POST /login/customer`, after updating `lastLoginAt`:
```typescript
const clientInfo = parseClientInfo(req);
await prisma.loginSession.updateMany({
  where: { customerId: customer.id },
  data: { isCurrent: false },
});
await prisma.loginSession.create({
  data: {
    customerId: customer.id,
    deviceName: clientInfo.deviceName,
    deviceType: clientInfo.deviceType,
    browser: clientInfo.browser,
    ipAddress: clientInfo.ipAddress,
    location: clientInfo.location,
    isCurrent: true,
    lastActiveAt: new Date(),
  },
});
```

- [ ] **Step 4: Implement Radar Endpoints in `backend/src/routes/security.ts`**

In `backend/src/routes/security.ts`:
1. Use `authenticateCustomer` on `/sessions`, `/2fa/toggle`, `/sessions/terminate-others`.
2. Add Super Admin routes using `authenticateSuperAdmin`:
```typescript
// GET /api/security/admin/radar
router.get('/admin/radar', authenticateSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { status: { not: 'deleted' } },
      select: {
        id: true,
        name: true,
        mailboxAddress: true,
        status: true,
        lastLoginAt: true,
        sessions: {
          orderBy: { lastActiveAt: 'desc' },
        },
      },
    });

    let totalActiveSessions = 0;
    let multiIpAlertCount = 0;

    const accountReports = customers.map((c) => {
      const activeSessions = c.sessions;
      const uniqueIps = Array.from(new Set(activeSessions.map((s) => s.ipAddress)));
      const isMultiIpAlert = uniqueIps.length > 1;

      totalActiveSessions += activeSessions.length;
      if (isMultiIpAlert) multiIpAlertCount++;

      return {
        id: c.id,
        name: c.name,
        mailboxAddress: c.mailboxAddress,
        status: c.status,
        lastLoginAt: c.lastLoginAt,
        activeSessionsCount: activeSessions.length,
        uniqueIps,
        isMultiIpAlert,
        sessions: activeSessions,
      };
    });

    res.json({
      summary: {
        totalAccounts: customers.length,
        totalActiveSessions,
        multiIpAlertCount,
      },
      accounts: accountReports,
    });
  } catch (error) {
    console.error('Admin radar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/security/admin/sessions/:sessionId/terminate
router.post('/admin/sessions/:sessionId/terminate', authenticateSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await prisma.loginSession.delete({ where: { id: sessionId } });
    res.json({ message: 'Sesi berhasil diputuskan' });
  } catch (error) {
    console.error('Terminate session error:', error);
    res.status(500).json({ error: 'Gagal memutuskan sesi' });
  }
});

// POST /api/security/admin/accounts/:customerId/terminate-all
router.post('/admin/accounts/:customerId/terminate-all', authenticateSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const result = await prisma.loginSession.deleteMany({ where: { customerId } });
    res.json({ message: 'Seluruh sesi akun berhasil diputuskan', terminatedCount: result.count });
  } catch (error) {
    console.error('Terminate all customer sessions error:', error);
    res.status(500).json({ error: 'Gagal memutuskan sesi akun' });
  }
});
```

- [ ] **Step 5: Run tests to verify**

Run: `npm test -- tests/security-radar.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add backend/src/routes/auth.ts backend/src/routes/security.ts backend/tests/security-radar.test.ts
git commit -m "feat: implement session tracking and Security Radar endpoints"
```

---

### Task 4: Global Storage Inspector & Protected Synology Sync Routes

**Files:**
- Modify: `backend/src/routes/storage.ts`
- Modify: `backend/tests/storage-routes.test.ts`

**Interfaces:**
- Consumes: `prisma.customer`, `prisma.legalDocument`, `prisma.attachment`, `SynologySyncService`
- Produces:
  - Protected `POST /api/storage/sync-synology` (Super Admin only)
  - Protected `POST /api/storage/init-synology-folder` (Super Admin only)
  - `GET /api/storage/overview` (Super Admin only: global storage metrics and per-account usage breakdown)

- [ ] **Step 1: Update unit test for storage routes protection and overview**

In `backend/tests/storage-routes.test.ts`:
Add tests asserting:
1. Non-admin or officer receives 403 on `POST /api/storage/sync-synology`.
2. Super admin receives 200 on `POST /api/storage/sync-synology` (with `dryRun: true`).
3. Super admin can call `GET /api/storage/overview` and receives total usage bytes, customer quota, and account breakdown.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/storage-routes.test.ts`
Expected: FAIL (overview endpoint missing and auth not enforced).

- [ ] **Step 3: Implement protected routes and overview in `backend/src/routes/storage.ts`**

In `backend/src/routes/storage.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SynologySyncService } from '../lib/synology-sync';
import { authenticateSuperAdmin, authenticateAdmin } from '../middleware/auth';

export default (prisma: PrismaClient) => {
  const router = Router();
  const syncService = new SynologySyncService(prisma);

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
```

- [ ] **Step 4: Run tests to verify**

Run: `npm test -- tests/storage-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add backend/src/routes/storage.ts backend/tests/storage-routes.test.ts
git commit -m "feat: secure Synology sync and add Master Storage Inspector endpoint"
```

---

### Task 5: Desktop 1-Click Sync Runner Script (`sync-synology.sh`)

**Files:**
- Create: `sync-synology.sh`
- Modify: `backend/scripts/sync-synology.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: executable shell script `sync-synology.sh` that checks/executes `npm run storage:sync-synology` and prints formatted output to terminal.

- [ ] **Step 1: Update `backend/scripts/sync-synology.ts` to output clean email folder logs**

Ensure `backend/scripts/sync-synology.ts` prints:
- Target folder (`/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage`)
- Clean account email folders
- Number of files synced, skipped, failed, and bytes copied.

- [ ] **Step 2: Create root launcher script `sync-synology.sh`**

Create `sync-synology.sh`:
```bash
#!/usr/bin/env bash
# ==============================================================================
# EasyLegal - Synology Drive Cold Storage Manual Sync Launcher
# Hanya berjalan ketika laptop menyala dan script ini dipanggil.
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

echo "========================================================"
echo " [EasyLegal] Sinkronisasi Manual ke Synology Drive..."
echo " Target Folder: /home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage"
echo " Struktur Folder: accounts/{email_akun}/"
echo "========================================================"

npm run storage:sync-synology

echo ""
echo "========================================================"
echo " [EasyLegal] Sinkronisasi Selesai!"
echo "========================================================"
```
Set executable: `chmod +x sync-synology.sh`.

- [ ] **Step 3: Test runner script execution**

Run: `./sync-synology.sh`
Expected: Successfully executes the sync, prints folder target and account counts, exit code 0.

- [ ] **Step 4: Commit changes**

```bash
git add sync-synology.sh backend/scripts/sync-synology.ts
git commit -m "feat: add desktop 1-click launcher script for Synology sync"
```

---

### Task 6: Frontend Auth Store & Unified Staff / Super Admin Console

**Files:**
- Modify: `frontend/src/store/auth.ts`
- Modify: `frontend/src/app/admin/page.tsx`
- Modify: `frontend/src/components/suite-header.tsx`

**Interfaces:**
- Consumes: `user.role` from Auth Store ('superadmin' | 'officer' | 'admin')
- Produces:
  - Tab navigation in `/admin`:
    - **Tab 1: Mailbox Accounts** (Accessible by Super Admin & Officer)
    - **Tab 2: Synology Cold Storage & Storage Inspector** (Super Admin Only)
    - **Tab 3: Security Radar** (Super Admin Only: Active sessions, multi-IP anomaly alert, kick session buttons)
    - **Tab 4: Officer Webmail / Tiket Bantuan** (Officer convenience shortcuts)

- [ ] **Step 1: Update `User` interface in `frontend/src/store/auth.ts`**

Add `role?: 'superadmin' | 'officer' | 'admin' | 'customer'` to `User` in `frontend/src/store/auth.ts`.

- [ ] **Step 2: Update `frontend/src/app/admin/page.tsx` with Role-Based Navigation & Components**

1. Detect role: `const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';`
2. If `user?.role === 'officer'`, default to Mailbox Creation & Support Tab; hide Synology trigger and Security Radar.
3. Add **Synology Cold Storage Control Card**:
   - Status badge (Terhubung / Belum Terpasang).
   - Stats: Berkas Tersinkron, Berkas Pending, Waktu Terakhir.
   - Button: "Sinkronkan ke Synology Sekarang" (with spinner and success toast).
4. Add **Master Storage Inspector Panel**:
   - Global S3 usage progress bar (Used GB / Total GB).
   - Per-account storage list showing `usedBytes`, `quotaBytes` (5 GB), and red badge if `warningExceeded80`.
5. Add **Security Radar Panel**:
   - Multi-IP Warning Banner: Shows number of accounts currently accessed from >1 distinct IP addresses.
   - Table of all accounts with their active sessions, IP addresses, device icons, location, and "Putuskan Sesi" button calling `POST /api/security/admin/sessions/:sessionId/terminate`.
   - "Putuskan Semua Sesi Akun" button calling `POST /api/security/admin/accounts/:customerId/terminate-all`.

- [ ] **Step 3: Run frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/store/auth.ts frontend/src/app/admin/page.tsx
git commit -m "feat: implement Super Admin Synology panel, Storage Inspector, and Security Radar in Admin Console"
```

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- Run all test suites: `backend/tests/*`
- Verify builds: `npm run build` in `frontend` (or typecheck)

- [ ] **Step 1: Run all backend tests**

Run: `npm test` in `backend`
Expected: 100% test suites pass (including existing 7 suites + new test suites).

- [ ] **Step 2: Test Synology Sync manual trigger via API**

Using curl/Supertest:
`POST /api/storage/sync-synology` with Super Admin token -> verifies sync runs and creates folders matching pure email `accounts/ptsinarjaya@clienteasylegal.co.id/`.

- [ ] **Step 3: Verify Security Radar multi-IP detection**

Verify that an account logged in from 2 distinct IPs displays the multi-IP alert in the Security Radar dashboard.

- [ ] **Step 4: Final commit and cleanup**

```bash
git commit -m "chore: complete verification for Synology sync and RBAC security radar"
```
