import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface DeviceFingerprint {
  deviceName: string;
  deviceType: 'laptop' | 'mobile' | 'desktop';
  browser: string;
  tokenSessionId: string;
}

export interface ClientDeviceInfo extends DeviceFingerprint {
  ipAddress: string;
  location: string;
  userAgent: string;
}

export function extractClientInfo(req: Request): ClientDeviceInfo {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp =
    (typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : Array.isArray(forwarded)
        ? forwarded[0]?.trim()
        : null) ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  const ipAddress = rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1' : rawIp;

  const isLocal =
    ipAddress === '127.0.0.1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('172.');
  const location = isLocal ? 'Lokal (Development)' : 'Indonesia';

  const userAgent = String(req.headers['user-agent'] || '') || 'Unknown Device';
  let deviceType: DeviceFingerprint['deviceType'] = 'desktop';
  if (/mobile|android|iphone|ipad/i.test(userAgent)) deviceType = 'mobile';
  else if (/macintosh|windows|linux/i.test(userAgent)) deviceType = 'laptop';

  let browser = 'Browser Web';
  if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/edg/i.test(userAgent)) browser = 'Edge';
  else if (/chrome/i.test(userAgent)) browser = 'Chrome';
  else if (/safari/i.test(userAgent)) browser = 'Safari';

  const os = /linux/i.test(userAgent)
    ? 'Linux'
    : /macintosh|mac os/i.test(userAgent)
      ? 'macOS'
      : /windows/i.test(userAgent)
        ? 'Windows'
        : 'Desktop';

  const incomingSid =
    (req.headers['x-session-id'] as string | undefined)?.trim() ||
    (typeof req.query.sid === 'string' ? req.query.sid.trim() : '');
  const tokenSessionId =
    incomingSid || `sid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return { ipAddress, location, deviceName: `${browser} on ${os}`, deviceType, browser, userAgent, tokenSessionId };
}

export interface LoginAttemptInput {
  email?: string;
  customerId?: string;
  status: 'success' | 'failed' | '2fa_challenge';
  failureReason?: string;
}

export async function recordLoginAttempt(
  prisma: PrismaClient,
  req: Request,
  data: LoginAttemptInput
): Promise<ClientDeviceInfo> {
  const info = extractClientInfo(req);
  try {
    await prisma.loginAttempt.create({
      data: {
        email: data.email?.trim().toLowerCase(),
        customerId: data.customerId,
        ipAddress: info.ipAddress,
        userAgent: info.userAgent,
        deviceName: info.deviceName,
        location: info.location,
        status: data.status,
        failureReason: data.failureReason,
      },
    });
  } catch (e) {
    console.error('[SecurityAuth] recordLoginAttempt failed:', e);
  }
  return info;
}

export async function ensureLoginSession(
  prisma: PrismaClient,
  customerId: string,
  info: ClientDeviceInfo
): Promise<void> {
  const existing = await prisma.loginSession.findFirst({
    where: { customerId, tokenSessionId: info.tokenSessionId },
  });
  if (!existing) {
    await prisma.loginSession.create({
      data: {
        customerId,
        deviceName: info.deviceName,
        deviceType: info.deviceType,
        browser: info.browser,
        ipAddress: info.ipAddress,
        location: info.location,
        userAgent: info.userAgent,
        tokenSessionId: info.tokenSessionId,
        isCurrent: true,
        lastActiveAt: new Date(),
      },
    });
    return;
  }
  await prisma.loginSession.update({
    where: { id: existing.id },
    data: {
      deviceName: info.deviceName,
      deviceType: info.deviceType,
      browser: info.browser,
      ipAddress: info.ipAddress,
      location: info.location,
      userAgent: info.userAgent,
      isCurrent: true,
      lastActiveAt: new Date(),
    },
  });
}

export function signWithSession(
  id: string,
  email: string,
  type: 'customer' | 'admin',
  role?: string,
  tokenSessionId?: string
): string {
  const payload: Record<string, unknown> = { id, email, type, role };
  if (tokenSessionId) payload.sid = tokenSessionId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export interface VerifiedToken {
  id: string;
  email: string;
  type: 'customer' | 'admin';
  role?: string;
  sid?: string;
}

export function verifyTokenWithSession(token: string): VerifiedToken {
  return jwt.verify(token, JWT_SECRET) as VerifiedToken;
}

// ─── Session Heartbeat (throttled) ───────────────────────────────────────
// authenticateCustomer calls this on every request; we throttle the actual
// DB write per sid so a chatty client doesn't hammer LoginSession.update.
let heartbeatPrisma: PrismaClient | null = null;
const HEARTBEAT_THROTTLE_MS = 60_000;
const lastHeartbeatAt = new Map<string, number>();

export function setHeartbeatPrisma(prisma: PrismaClient): void {
  heartbeatPrisma = prisma;
}

export function touchSessionHeartbeat(sid: string | undefined): void {
  if (!sid || !heartbeatPrisma) return;
  const now = Date.now();
  const last = lastHeartbeatAt.get(sid) || 0;
  if (now - last < HEARTBEAT_THROTTLE_MS) return;
  lastHeartbeatAt.set(sid, now);
  heartbeatPrisma.loginSession
    .updateMany({ where: { tokenSessionId: sid }, data: { lastActiveAt: new Date() } })
    .catch((err) => console.error('[SecurityAuth] Session heartbeat failed:', err));
}
