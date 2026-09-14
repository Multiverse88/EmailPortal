import { PrismaClient } from '@prisma/client';
import { emitSecurityEvent } from '../lib/security-events';
import { sendTelegramMessage, sendTelegramPhoto } from '../lib/telegram';
import { generateServerStatusCardPng } from '../lib/card-generator';

const THRESHOLD_MULTI_IP = 1;
const THRESHOLD_BRUTE_FORCE = 5;
const WINDOW_SEC = 300;

let monitorTimer: NodeJS.Timeout | null = null;
let lastRunAt: Date | null = null;
let lastSnapshot: MonitorSnapshot | null = null;
const alertedAccounts = new Set<string>();

export interface MonitorAnomaly {
  type: 'multi_ip' | 'brute_force';
  accountEmail: string;
  customerId: string;
  detail: string;
  riskScore: number;
}

export interface MonitorSnapshot {
  totalAccounts: number;
  activeSessions: number;
  multiIpAlerts: number;
  bruteForceAccounts: number;
  offlineAccounts: number;
  anomalies: MonitorAnomaly[];
}

export interface HealthSnapshot extends MonitorSnapshot {
  lastRunAt: string | null;
  nextRunAt: string | null;
  intervalSeconds: number;
}

function intervalSec(): number {
  return Number(process.env.SECURITY_MONITOR_INTERVAL || 60);
}

export async function runSecurityScan(prisma: PrismaClient): Promise<MonitorSnapshot> {
  const windowAgo = new Date(Date.now() - WINDOW_SEC * 1000);
  const now = new Date();

  const [customers, recentFails] = await Promise.all([
    prisma.customer.findMany({
      where: { status: { not: 'deleted' } },
      include: {
        sessions: {
          where: { lastActiveAt: { gte: windowAgo } },
          orderBy: { lastActiveAt: 'desc' },
        },
      },
    }),
    prisma.loginAttempt.findMany({
      where: { createdAt: { gte: windowAgo }, status: 'failed' },
    }),
  ]);

  let activeSessions = 0;
  let multiIpAlerts = 0;
  let offlineAccounts = 0;
  const anomalies: MonitorAnomaly[] = [];

  // Brute force: >= THRESHOLD failed attempts per IP or per email in window
  const failsByIp = new Map<string, number>();
  const failsByEmail = new Map<string, number>();
  for (const a of recentFails) {
    if (a.ipAddress) failsByIp.set(a.ipAddress, (failsByIp.get(a.ipAddress) || 0) + 1);
    if (a.email) failsByEmail.set(a.email, (failsByEmail.get(a.email) || 0) + 1);
  }
  const bruteIps = [...failsByIp.entries()].filter(([, n]) => n >= THRESHOLD_BRUTE_FORCE);
  const bruteEmails = [...failsByEmail.entries()].filter(([, n]) => n >= THRESHOLD_BRUTE_FORCE);
  const bruteForceAccounts = bruteEmails.length;
  if (bruteIps.length > 0 || bruteEmails.length > 0) {
    const detail =
      `Brute force dalam ${WINDOW_SEC / 60} mnt: ` +
      (bruteIps.length > 0 ? `IP ${bruteIps.map(([ip, n]) => `${ip} (${n}x)`).join(', ')}` : '') +
      (bruteIps.length > 0 && bruteEmails.length > 0 ? '; ' : '') +
      (bruteEmails.length > 0 ? `email ${bruteEmails.map(([e, n]) => `${e} (${n}x)`).join(', ')}` : '');
    const maxAttempts = Math.max(0, ...bruteIps.map(([, n]) => n), ...bruteEmails.map(([, n]) => n));
    const riskScore = Math.min(100, 75 + Math.max(0, maxAttempts - THRESHOLD_BRUTE_FORCE) * 5);
    anomalies.push({ type: 'brute_force', accountEmail: bruteEmails[0]?.[0] || '(unknown)', customerId: '', detail, riskScore });
    emitSecurityEvent({
      type: 'threat',
      severity: 'critical',
      title: 'Serangan Brute Force Terdeteksi',
      detail,
      ipAddress: bruteIps.map(([ip]) => ip).join(', ') || undefined,
      riskScore,
    });
  }

  // Multi-IP: > 1 unique IP among active sessions (dedup repeat alerts)
  for (const c of customers) {
    const active = c.sessions;
    activeSessions += active.length;
    if (active.length === 0) {
      if (c.status === 'active') offlineAccounts++;
      alertedAccounts.delete(c.id);
      continue;
    }
    const uniqueIps = Array.from(new Set(active.map((s) => s.ipAddress)));
    if (uniqueIps.length > THRESHOLD_MULTI_IP) {
      multiIpAlerts++;
      if (!alertedAccounts.has(c.id)) {
        alertedAccounts.add(c.id);
        const detail = `Multi-IP login: ${active.length} sesi aktif dari ${uniqueIps.length} IP: ${uniqueIps.join(', ')}`;
        const riskScore = Math.min(95, 45 + (uniqueIps.length - THRESHOLD_MULTI_IP) * 12);
        anomalies.push({ type: 'multi_ip', accountEmail: c.mailboxAddress, customerId: c.id, detail, riskScore });
        emitSecurityEvent({
          type: 'anomaly',
          severity: 'warning',
          title: 'Login Multi-IP Terdeteksi',
          accountEmail: c.mailboxAddress,
          customerId: c.id,
          ipAddress: uniqueIps.join(', '),
          riskScore,
        });
      }
    } else {
      alertedAccounts.delete(c.id);
    }
  }

  const snapshot: MonitorSnapshot = {
    totalAccounts: customers.length,
    activeSessions,
    multiIpAlerts,
    bruteForceAccounts,
    offlineAccounts,
    anomalies,
  };
  lastSnapshot = snapshot;
  lastRunAt = now;

  // Telegram: only on anomalies, card + text fallback
  if (anomalies.length > 0) {
    const portalUrl = (process.env.PORTAL_URL || 'https://clienteasylegal.co.id').replace(/\/+$/, '');
    const replyMarkup = { inline_keyboard: [[{ text: '🔍 Buka Security Radar', url: `${portalUrl}/admin` }]] };
    const dateStr = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const caption = [
      '📊 <b>[24/7 MONITOR] Ringkasan Keamanan</b>',
      `🕒 ${dateStr} | Total akun: ${snapshot.totalAccounts} | Sesi aktif: ${activeSessions}`,
      `🚨 Multi-IP: ${multiIpAlerts} | 🔥 Brute force: ${bruteForceAccounts} | Anomali: ${anomalies.length}`,
      ...anomalies.slice(0, 5).map((a) => `• <b>${a.type.toUpperCase()}</b> (risiko ${a.riskScore}/100) ${a.accountEmail}: ${a.detail}`),
    ].join('\n');
    try {
      const png = await generateServerStatusCardPng({
        stateKey: 'gangguan',
        serverTime: dateStr,
        serverNext: 'Pantau berikutnya otomatis',
        pillText: `${anomalies.length} ANOMALI KEAMANAN TERDETEKSI`,
        bubbleText: `Multi-IP: ${multiIpAlerts}, brute force: ${bruteForceAccounts}. Cek Security Radar.`,
      });
      if (png) {
        await sendTelegramPhoto(png, caption.slice(0, 1000), replyMarkup);
      } else {
        await sendTelegramMessage(caption, 'HTML', undefined, replyMarkup);
      }
    } catch (e) {
      console.warn('[SecurityMonitor] Telegram send failed:', (e as Error)?.message || e);
    }
  }

  return snapshot;
}

export function startSecurityMonitor(prisma: PrismaClient): void {
  if (process.env.SECURITY_MONITOR === 'false') {
    console.log('⏱️ [SecurityMonitor] 24/7 monitor disabled (SECURITY_MONITOR=false).');
    return;
  }
  const sec = intervalSec();
  console.log(`⏱️ [SecurityMonitor] Starting 24/7 security monitor (every ${sec}s).`);
  monitorTimer = setInterval(() => {
    runSecurityScan(prisma).catch((err) => console.error('[SecurityMonitor] Scan failed:', err));
  }, sec * 1000);
  runSecurityScan(prisma).catch((err) => console.error('[SecurityMonitor] Initial scan failed:', err));
}

export function stopSecurityMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
    console.log('⏱️ [SecurityMonitor] 24/7 security monitor stopped.');
  }
}

export function getHealthSnapshot(): HealthSnapshot {
  const sec = intervalSec();
  return {
    ...(lastSnapshot || { totalAccounts: 0, activeSessions: 0, multiIpAlerts: 0, bruteForceAccounts: 0, offlineAccounts: 0, anomalies: [] }),
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    nextRunAt: lastRunAt ? new Date(lastRunAt.getTime() + sec * 1000).toISOString() : null,
    intervalSeconds: sec,
  };
}

export async function getLiveHealth(prisma: PrismaClient): Promise<HealthSnapshot> {
  await runSecurityScan(prisma);
  return getHealthSnapshot();
}
