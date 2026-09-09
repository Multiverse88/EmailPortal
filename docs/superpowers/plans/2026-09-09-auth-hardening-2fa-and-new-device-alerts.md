# Auth Hardening: Real 2FA (TOTP) Login & New Device Login Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real two-factor authentication (RFC 6238 TOTP with Google Authenticator QR setup and 6-digit OTP login challenge) and automatic new-device/IP login alert emails to customer personal addresses.

**Architecture:** 
A zero-external-dependency RFC 6238 TOTP engine built into `backend/src/lib/totp.ts` calculates and verifies 6-digit HMAC-SHA1 codes with time-drift tolerance. Customer schema is extended with encrypted `twoFactorSecret`. When 2FA is active, customer login returns a temporary 5-minute challenge token instead of a session JWT, requiring `/api/auth/login/customer/2fa-verify`. An anomaly checker compares incoming IP and device signatures against past login sessions, automatically triggering security warning emails to `personalEmail`.

**Tech Stack:** Node.js, Express, TypeScript, Prisma ORM (SQLite / PostgreSQL), Node.js `crypto` (AES-256-GCM, HMAC-SHA1), Next.js 14 App Router, Tailwind CSS, Lucide Icons, Jest, Supertest.

## Global Constraints

- Never break existing session management or impersonation routes.
- Preserve backward compatibility for `POST /api/security/2fa/toggle` so existing tests and fast toggling pass.
- `twoFactorSecret` must always be stored encrypted using `AES-256-GCM` (`lib/crypto.ts`).
- New device alerts must be dispatched asynchronously without blocking the login response.
- In test environments (`process.env.NODE_ENV === 'test'`), email deliveries return `{ delivered: true }` without throwing.
- All code and user-facing messages must be clear, polite, and professional in Indonesian.

---

### Task 1: RFC 6238 TOTP Engine & Unit Tests

**Files:**
- Create: `backend/src/lib/totp.ts`
- Test: `backend/tests/totp.test.ts`

**Interfaces:**
- Consumes: `node:crypto` (`createHmac`, `randomBytes`, `timingSafeEqual`)
- Produces:
  - `generateTotpSecret(): string` (returns Base32-encoded 20-byte secret)
  - `generateTotp(secret: string, offsetSteps?: number): string` (generates 6-digit code for current time + offset)
  - `verifyTotp(token: string, secret: string, window?: number): boolean` (verifies 6-digit code with window tolerance)
  - `generateTotpUri(mailboxAddress: string, secret: string, issuer?: string): string` (generates standard `otpauth://` URI)

- [ ] **Step 1: Write the failing unit test for TOTP engine**

```typescript
// backend/tests/totp.test.ts
import {
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  generateTotpUri,
} from '../src/lib/totp';

describe('TOTP Engine (RFC 6238 compliant)', () => {
  it('generates valid base32 secrets of 32 characters', () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBe(32);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('generates a 6-digit numeric string code', () => {
    const secret = generateTotpSecret();
    const code = generateTotp(secret);
    expect(typeof code).toBe('string');
    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('verifies a freshly generated code successfully', () => {
    const secret = generateTotpSecret();
    const code = generateTotp(secret);
    expect(verifyTotp(code, secret)).toBe(true);
  });

  it('verifies code within clock drift window (offset +/- 1 step)', () => {
    const secret = generateTotpSecret();
    const pastCode = generateTotp(secret, -1);
    const futureCode = generateTotp(secret, 1);
    expect(verifyTotp(pastCode, secret, 1)).toBe(true);
    expect(verifyTotp(futureCode, secret, 1)).toBe(true);
  });

  it('rejects invalid or expired code outside window', () => {
    const secret = generateTotpSecret();
    const oldCode = generateTotp(secret, -5);
    expect(verifyTotp(oldCode, secret, 1)).toBe(false);
    expect(verifyTotp('000000', secret, 1)).toBe(false);
    expect(verifyTotp('abc', secret, 1)).toBe(false);
  });

  it('generates valid otpauth URI for QR codes', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const uri = generateTotpUri('budi@clienteasylegal.co.id', secret, 'EasyLegal');
    expect(uri).toContain('otpauth://totp/EasyLegal:budi%40clienteasylegal.co.id');
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('issuer=EasyLegal');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/totp.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/totp'"

- [ ] **Step 3: Implement minimal TOTP engine in `backend/src/lib/totp.ts`**

```typescript
// backend/src/lib/totp.ts
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const bits: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    for (let b = 4; b >= 0; b--) {
      bits.push((val >> b) & 1);
    }
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i + b];
    }
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, '0');
    result += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return result;
}

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes).substring(0, 32);
}

export function generateTotp(secret: string, offsetSteps = 0): string {
  const key = base32Decode(secret);
  const timeStep = 30;
  const counter = Math.floor(Date.now() / 1000 / timeStep) + offsetSteps;

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyTotp(token: string, secret: string, window = 1): boolean {
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) {
    return false;
  }
  const cleanToken = token.trim();
  const tokenBuf = Buffer.from(cleanToken);

  for (let i = -window; i <= window; i++) {
    const expected = generateTotp(secret, i);
    const expBuf = Buffer.from(expected);
    if (tokenBuf.length === expBuf.length && timingSafeEqual(tokenBuf, expBuf)) {
      return true;
    }
  }
  return false;
}

export function generateTotpUri(mailboxAddress: string, secret: string, issuer = 'EasyLegal'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(mailboxAddress)}`;
  const encIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/totp.test.ts`
Expected: PASS with 6/6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/totp.ts backend/tests/totp.test.ts
git commit -m "feat(security): add RFC 6238 TOTP generator, validator, and URI generator"
```

---

### Task 2: Schema Extension & 2FA Setup/Verify Endpoints

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `backend/src/routes/security.ts`
- Test: `backend/tests/two-factor-setup.test.ts`

**Interfaces:**
- Consumes: `Customer` model, `encrypt`/`decrypt` from `backend/src/lib/crypto.ts`, `totp` methods
- Produces:
  - `POST /api/security/2fa/setup`: `{ secret, otpauthUri, qrCodeUrl }`
  - `POST /api/security/2fa/verify-setup`: `{ code }` -> `{ success: true, twoFactorEnabled: true }`
  - `POST /api/security/2fa/disable`: `{ currentPassword }` -> `{ success: true, twoFactorEnabled: false }`
  - `POST /api/security/2fa/toggle`: Backwards compatible toggle (auto-provisions secret if toggled on)

- [ ] **Step 1: Update `prisma/schema.prisma` with `twoFactorSecret`**

In `prisma/schema.prisma`:
```prisma
model Customer {
  id                String    @id @default(uuid())
  ...
  twoFactorEnabled  Boolean         @default(false)
  twoFactorSecret   String?         // Encrypted TOTP secret (AES-256-GCM)
  preferences       String?         // JSON
  ...
```
Then run: `npx prisma db push --schema ../prisma/schema.prisma` (or `npx prisma generate`).

- [ ] **Step 2: Write failing test for 2FA setup, verify, disable, and toggle**

```typescript
// backend/tests/two-factor-setup.test.ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app, { prisma } from '../src/app';
import { generateTotp } from '../src/lib/totp';
import { encrypt } from '../src/lib/crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('2FA Setup, Verification and Management API', () => {
  let customer: any;
  let token: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    customer = await prisma.customer.create({
      data: {
        name: '2FA Setup Test Customer',
        personalEmail: `2fa-setup-${timestamp}@example.com`,
        mailboxAddress: `2fa-setup-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('ValidPassword123!'),
        status: 'active',
        twoFactorEnabled: false,
      },
    });
    token = jwt.sign({ id: customer.id, email: customer.mailboxAddress, type: 'customer' }, JWT_SECRET);
  });

  afterAll(async () => {
    if (customer?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('POST /api/security/2fa/setup returns secret, otpauthUri, and qrCodeUrl', async () => {
    const res = await request(app)
      .post('/api/security/2fa/setup')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('secret');
    expect(res.body).toHaveProperty('otpauthUri');
    expect(res.body).toHaveProperty('qrCodeUrl');
    expect(res.body.otpauthUri).toContain('otpauth://totp/');
  });

  it('POST /api/security/2fa/verify-setup fails with wrong code', async () => {
    const res = await request(app)
      .post('/api/security/2fa/verify-setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/security/2fa/verify-setup succeeds with valid TOTP code', async () => {
    const setupRes = await request(app)
      .post('/api/security/2fa/setup')
      .set('Authorization', `Bearer ${token}`);

    const validCode = generateTotp(setupRes.body.secret);
    const verifyRes = await request(app)
      .post('/api/security/2fa/verify-setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: validCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.twoFactorEnabled).toBe(true);

    const updatedInDb = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updatedInDb?.twoFactorEnabled).toBe(true);
    expect(updatedInDb?.twoFactorSecret).toBeDefined();
  });

  it('POST /api/security/2fa/disable turns off 2FA when valid current password is provided', async () => {
    const res = await request(app)
      .post('/api/security/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'ValidPassword123!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('twoFactorEnabled', false);

    const updatedInDb = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updatedInDb?.twoFactorEnabled).toBe(false);
  });
});
```

- [ ] **Step 3: Implement endpoints in `backend/src/routes/security.ts`**

Update `backend/src/routes/security.ts` to add:
- `POST /2fa/setup`: Generates secret and QR code URL, encrypts and stores secret on `Customer`.
- `POST /2fa/verify-setup`: Decrypts secret, tests OTP code, sets `twoFactorEnabled: true`.
- `POST /2fa/disable`: Validates current password, disables 2FA.
- Maintain `POST /2fa/toggle`: If enabled is true and no secret exists, automatically generates and saves an encrypted secret so `twoFactorSecret` is always valid.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/two-factor-setup.test.ts tests/security-settings.test.ts`
Expected: Both test suites PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma backend/src/routes/security.ts backend/tests/two-factor-setup.test.ts
git commit -m "feat(security): add 2FA setup, verification, and disable endpoints with encrypted secret storage"
```

---

### Task 3: Customer Login 2FA Challenge & Verification Endpoints

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Test: `backend/tests/two-factor-login.test.ts`

**Interfaces:**
- Consumes: `Customer` model, `verifyPassword`, `jwt.sign`, `jwt.verify`, `verifyTotp`, `decrypt`
- Produces:
  - `POST /api/auth/login/customer`: returns `{ requires2FA: true, challengeToken: string }` if 2FA is active.
  - `POST /api/auth/login/customer/2fa-verify`: accepts `{ challengeToken: string, code: string }`, returns full session token + user object.

- [ ] **Step 1: Write failing test for 2FA login challenge and verify flow**

```typescript
// backend/tests/two-factor-login.test.ts
import request from 'supertest';
import app, { prisma } from '../src/app';
import { encrypt } from '../src/lib/crypto';
import { generateTotpSecret, generateTotp } from '../src/lib/totp';

describe('Customer Login 2FA Challenge and Verification Flow', () => {
  let customerWith2FA: any;
  let customerWithout2FA: any;
  let secret: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    secret = generateTotpSecret();

    customerWith2FA = await prisma.customer.create({
      data: {
        name: 'Customer With 2FA',
        personalEmail: `login-2fa-${timestamp}@example.com`,
        mailboxAddress: `login-2fa-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('Secret123!'),
        status: 'active',
        twoFactorEnabled: true,
        twoFactorSecret: encrypt(secret),
      },
    });

    customerWithout2FA = await prisma.customer.create({
      data: {
        name: 'Customer Without 2FA',
        personalEmail: `login-no2fa-${timestamp}@example.com`,
        mailboxAddress: `login-no2fa-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('Secret123!'),
        status: 'active',
        twoFactorEnabled: false,
      },
    });
  });

  afterAll(async () => {
    if (customerWith2FA?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customerWith2FA.id } });
      await prisma.customer.delete({ where: { id: customerWith2FA.id } }).catch(() => {});
    }
    if (customerWithout2FA?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customerWithout2FA.id } });
      await prisma.customer.delete({ where: { id: customerWithout2FA.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('allows direct login when 2FA is disabled', async () => {
    const res = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWithout2FA.mailboxAddress, password: 'Secret123!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.requires2FA).toBeUndefined();
  });

  it('returns challengeToken and requires2FA: true when 2FA is enabled', async () => {
    const res = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWith2FA.mailboxAddress, password: 'Secret123!' });

    expect(res.status).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body).toHaveProperty('challengeToken');
    expect(res.body.token).toBeUndefined();
  });

  it('rejects 2FA verification with invalid OTP code', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWith2FA.mailboxAddress, password: 'Secret123!' });

    const verifyRes = await request(app)
      .post('/api/auth/login/customer/2fa-verify')
      .send({ challengeToken: loginRes.body.challengeToken, code: '000000' });

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.error).toContain('Kode 2FA salah');
  });

  it('completes login upon valid 6-digit TOTP code', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login/customer')
      .send({ email: customerWith2FA.mailboxAddress, password: 'Secret123!' });

    const validOtp = generateTotp(secret);
    const verifyRes = await request(app)
      .post('/api/auth/login/customer/2fa-verify')
      .send({ challengeToken: loginRes.body.challengeToken, code: validOtp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body).toHaveProperty('token');
    expect(verifyRes.body.user.email).toBe(customerWith2FA.mailboxAddress);

    // Verify session was created
    const session = await prisma.loginSession.findFirst({
      where: { customerId: customerWith2FA.id, isCurrent: true },
    });
    expect(session).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/two-factor-login.test.ts`
Expected: FAIL with `requires2FA` undefined.

- [ ] **Step 3: Implement 2FA challenge and verification in `backend/src/routes/auth.ts`**

In `backend/src/routes/auth.ts`:
- Modify `/login/customer`:
  If `customer.twoFactorEnabled && customer.twoFactorSecret`:
  Return `{ requires2FA: true, challengeToken: signChallenge(...), message: '...' }`.
- Add `router.post('/login/customer/2fa-verify', loginLimiter, async (req, res) => ...)`:
  Validate challengeToken, decrypt `twoFactorSecret`, verify OTP via `verifyTotp`, create session, return JWT and user profile.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/two-factor-login.test.ts`
Expected: PASS with 4/4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.ts backend/tests/two-factor-login.test.ts
git commit -m "feat(auth): enforce real 2FA challenge and verification during customer login"
```

---

### Task 4: New Device / IP Login Detection & Security Alert Email

**Files:**
- Create: `backend/src/lib/security-alerts.ts`
- Modify: `backend/src/lib/mail.ts`
- Modify: `backend/src/routes/auth.ts`
- Test: `backend/tests/new-device-alert.test.ts`

**Interfaces:**
- Consumes: `sendMail` from `backend/src/lib/mail.ts`, `LoginSession` history
- Produces: `checkAndSendNewDeviceAlert(prisma, customer, clientInfo): Promise<{ isNewDevice: boolean, sent: boolean }>`

- [ ] **Step 1: Write failing test for new device alert detection and email sending**

```typescript
// backend/tests/new-device-alert.test.ts
import { prisma } from '../src/app';
import { checkAndSendNewDeviceAlert } from '../src/lib/security-alerts';
import { encrypt } from '../src/lib/crypto';

describe('New Device / IP Login Alert Sentinel', () => {
  let customer: any;

  beforeAll(async () => {
    const timestamp = Date.now();
    customer = await prisma.customer.create({
      data: {
        name: 'Device Alert Customer',
        personalEmail: `device-alert-${timestamp}@example.com`,
        mailboxAddress: `device-alert-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('SamplePass123!'),
        status: 'active',
      },
    });

    // Seed known session (IP: 103.20.10.1, Chrome on macOS)
    await prisma.loginSession.create({
      data: {
        customerId: customer.id,
        deviceName: 'Chrome on macOS',
        deviceType: 'laptop',
        browser: 'Chrome',
        ipAddress: '103.20.10.1',
        location: 'Jakarta, Indonesia',
        isCurrent: true,
      },
    });
  });

  afterAll(async () => {
    if (customer?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('does NOT trigger alert if login comes from known IP and device', async () => {
    const clientInfo = {
      ipAddress: '103.20.10.1',
      deviceName: 'Chrome on macOS',
      deviceType: 'laptop',
      browser: 'Chrome',
      location: 'Jakarta, Indonesia',
    };
    const result = await checkAndSendNewDeviceAlert(prisma, customer, clientInfo);
    expect(result.isNewDevice).toBe(false);
    expect(result.sent).toBe(false);
  });

  it('triggers alert email to personalEmail when login comes from an unrecognized IP and device', async () => {
    const unfamiliarClient = {
      ipAddress: '180.252.99.88',
      deviceName: 'Safari on iPhone',
      deviceType: 'mobile',
      browser: 'Safari',
      location: 'Surabaya, Indonesia',
    };
    const result = await checkAndSendNewDeviceAlert(prisma, customer, unfamiliarClient);
    expect(result.isNewDevice).toBe(true);
    expect(result.sent).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/new-device-alert.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/security-alerts'"

- [ ] **Step 3: Implement `backend/src/lib/security-alerts.ts` and integrate into `auth.ts`**

Create `backend/src/lib/security-alerts.ts` with HTML template and logic.
Connect `checkAndSendNewDeviceAlert` inside `POST /login/customer` and `POST /login/customer/2fa-verify`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/new-device-alert.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/security-alerts.ts backend/src/routes/auth.ts backend/tests/new-device-alert.test.ts
git commit -m "feat(security): add new device/IP detection and automatic security alert email dispatch"
```

---

### Task 5: Frontend 2FA Verification Flow on Login Page

**Files:**
- Modify: `frontend/src/app/login/page.tsx`

**Features:**
- State: `requires2FA`, `challengeToken`, `otpCode`, `verifying2FA`
- Two-step UI: When `requires2FA` is returned, show dedicated 2FA verification panel with:
  - Shield with padlock icon
  - Masked customer email
  - 6-digit numeric OTP inputs with auto-focus
  - Direct submit to `/api/auth/login/customer/2fa-verify`
  - "Kembali ke login email" button to restart

- [ ] **Step 1: Update `frontend/src/app/login/page.tsx`**
  - Wire state and handlers for 2FA challenge response and submission.
  - Add accessible 6-digit code form with clear visual indicators and error handling.

- [ ] **Step 2: Build frontend to verify TypeScript and JSX compilation**
  Run: `npm run build` in `frontend` directory.
  Expected: Clean build without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/login/page.tsx
git commit -m "feat(frontend): add 2FA challenge verification screen to login page"
```

---

### Task 6: Frontend 2FA Setup Modal & Management in Settings Page

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`

**Features:**
- Interactive setup modal triggered when user toggles 2FA ON:
  - Calls `POST /api/security/2fa/setup` to obtain secret key and QR code.
  - Displays QR code and copyable secret key for Google Authenticator / Authy.
  - Asks user to input a 6-digit test code.
  - Submits to `POST /api/security/2fa/verify-setup`.
  - Confirms activation and updates UI badge to "Aktif".
- Safe disable action with password confirmation when user turns 2FA OFF.

- [ ] **Step 1: Update `frontend/src/app/settings/page.tsx`**
  - Add 2FA setup modal state and components.
  - Add verify and disable flows.

- [ ] **Step 2: Run frontend build to verify compilation**
  Run: `npm run build` in `frontend` directory.
  Expected: Clean build without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "feat(frontend): add interactive 2FA QR setup modal and confirmation flow in settings"
```

---

### Task 7: Full Test Suite & End-to-End Verification

**Files:**
- Verify all backend test suites
- Verify frontend test suites
- Run end-to-end integration check

- [ ] **Step 1: Run all backend tests**
  Run: `npm test` in `backend` directory.
  Expected: All 16+ test suites pass (100% pass rate).

- [ ] **Step 2: Run frontend tests & build**
  Run: `npm test` and `npm run build` in `frontend` directory.
  Expected: All tests pass and build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git push origin feat/ai-companion-el
```
