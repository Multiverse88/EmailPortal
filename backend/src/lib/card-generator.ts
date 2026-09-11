import { MASCOT_POSES } from './mascot-assets';

/**
 * Escapes characters for XML/SVG compliance to prevent parser breakage
 */
export function escapeXml(unsafe?: string | null): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Splits text into wrapped lines for multi-line SVG rendering (<tspan>)
 */
export function wrapText(text: string, maxLen = 65): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxLen) {
      cur = (cur + ' ' + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Vector SVG icons for crisp OS-independent rendering (zero dependency on system emoji fonts)
const ICONS = {
  scale: `<path d="M12 3v18M6 8l6-3 6 3M3 13l3-5 3 5a3 3 0 01-6 0zm12 0l3-5 3 5a3 3 0 01-6 0z" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  user: `<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>`,
  mail: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>`,
  tag: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/>`,
  file: `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>`,
  clock: `<circle cx="12" cy="12" r="10" fill="none" stroke="#94a3b8" stroke-width="2"/><path d="M12 6v6l4 2" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>`,
  chat: `<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>`,
  check: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>`,
  alert: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>`,
  globe: `<circle cx="12" cy="12" r="10" fill="none" stroke="#38bdf8" stroke-width="2"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" fill="none" stroke="#38bdf8" stroke-width="2"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round"/>`,
  database: `<ellipse cx="12" cy="5" rx="9" ry="3" fill="none" stroke="#fbbf24" stroke-width="2"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" fill="none" stroke="#fbbf24" stroke-width="2"/>`,
  ticket: `<path d="M2 9a3 3 0 010 6v2a2 2 0 002 2h16a2 2 0 002-2v-2a3 3 0 010-6V7a2 2 0 00-2-2H4a2 2 0 00-2 2v2z" fill="none" stroke="#f472b6" stroke-width="2"/>`,
};

// "EL" mascot stage: speech bubble + illustration in the card's right-hand lane,
// reusing the same character art shown in the bot notification mockup
// (easylegal-kartu-notifikasi.html). Pose/bubble text is chosen per-condition by callers.
const MASCOT_LANE_X = 685;
const MASCOT_LANE_CENTER_X = 780;
const MASCOT_BOTTOM_Y = 458;

function renderMascotStage(pose: keyof typeof MASCOT_POSES, bubble: string, accentColor: string): string {
  const art = MASCOT_POSES[pose];
  const targetH = 250;
  const targetW = Math.round(targetH * (art.w / art.h));
  const imgX = MASCOT_LANE_CENTER_X - targetW / 2;
  const imgY = MASCOT_BOTTOM_Y - targetH;

  const lines = wrapText(bubble, 28).slice(0, 3);
  const bubbleH = 34 + lines.length * 18;
  const bubbleTspans = lines
    .map((line, idx) => `<tspan x="${MASCOT_LANE_X + 15}" dy="${idx === 0 ? 0 : 17}">${escapeXml(line)}</tspan>`)
    .join('');

  return `
  <g>
    <rect x="${MASCOT_LANE_X}" y="98" width="190" height="${bubbleH}" rx="14" fill="#0d1527" stroke="${accentColor}" stroke-width="1.2" />
    <text x="${MASCOT_LANE_X + 15}" y="120" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="600" fill="#e2e8f0">${bubbleTspans}</text>
    <image href="data:image/png;base64,${art.base64}" x="${imgX}" y="${imgY}" width="${targetW}" height="${targetH}" />
  </g>`;
}

/**
 * Generates an SVG string for a New Support Ticket
 */
export function generateTicketCardSvg(data: {
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  createdAtStr: string;
  customerName: string;
  mailboxAddress: string;
  personalEmail?: string;
  initialMessage?: string;
}): string {
  const isUrgent = data.priority.toLowerCase() === 'urgent';
  const priorityBg = isUrgent ? 'url(#urgentGrad)' : 'url(#normalGrad)';
  const priorityBorder = isUrgent ? '#ef4444' : '#38bdf8';
  const priorityLabel = isUrgent ? 'URGENT (&lt; 4 JAM SLA)' : 'NORMAL (24 JAM SLA)';
  const priorityDot = isUrgent ? '#fca5a5' : '#7dd3fc';
  const mascotPose = isUrgent ? 'menyapa' : 'melambai';
  const mascotBubble = isUrgent
    ? 'Urgent! SLA tinggal kurang dari 4 jam, mohon segera diambil.'
    : `Halo tim! Ada tiket baru dari ${data.customerName}.`;

  const snippet = data.initialMessage || 'Tidak ada rincian pesan tambahan dari klien.';
  const messageLines = wrapText(snippet, 50).slice(0, 3);
  if (wrapText(snippet, 50).length > 3 && messageLines.length >= 3) {
    messageLines[2] = messageLines[2] + '...';
  }

  const messageTspans = messageLines
    .map((line, idx) => `<tspan x="45" dy="${idx === 0 ? 0 : 23}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070c18" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#161e38" />
    </linearGradient>
    <linearGradient id="urgentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#dc2626" />
      <stop offset="100%" stop-color="#991b1b" />
    </linearGradient>
    <linearGradient id="normalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#172238" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0d1527" stop-opacity="0.95" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>
  </defs>

  <rect width="900" height="520" rx="20" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="900" height="4" fill="url(#accentBar)" />
  <rect x="1" y="1" width="898" height="518" rx="19" fill="none" stroke="#334155" stroke-width="1.5" stroke-opacity="0.7" />

  <circle cx="820" cy="80" r="130" fill="${isUrgent ? '#ef4444' : '#38bdf8'}" opacity="0.10" />
  <circle cx="90" cy="450" r="150" fill="#6366f1" opacity="0.08" />

  <!-- HEADER -->
  <g transform="translate(45, 38)">
    <rect x="0" y="0" width="40" height="40" rx="10" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
    <g transform="translate(8, 8)">${ICONS.scale}</g>
    <text x="54" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="16" font-weight="800" fill="#ffffff" letter-spacing="1">EASYLEGAL CUSTOMER PORTAL</text>
    <text x="54" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="600" fill="#94a3b8" letter-spacing="0.5">TIKET SUPPORT BARU • PRIORITY DISPATCH</text>
  </g>

  <!-- Priority Badge -->
  <g transform="translate(635, 38)">
    <rect x="0" y="0" width="220" height="40" rx="20" fill="${priorityBg}" stroke="${priorityBorder}" stroke-width="1.5" />
    <circle cx="22" cy="20" r="5" fill="${priorityDot}" />
    <text x="122" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${priorityLabel}</text>
  </g>

  <!-- Ticket Number & Time -->
  <g transform="translate(45, 115)">
    <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="32" font-weight="900" fill="#38bdf8" letter-spacing="1">#${escapeXml(data.ticketNumber)}</text>
    <g transform="translate(230, 7) scale(0.85)">${ICONS.clock}</g>
    <text x="255" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="500" fill="#94a3b8">${escapeXml(data.createdAtStr)}</text>
  </g>

  <!-- Info Box -->
  <g transform="translate(45, 155)">
    <rect width="620" height="155" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />

    <!-- Left Column: Customer Details -->
    <g transform="translate(25, 20)">
      <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">PEMOHON / KLIEN</text>

      <g transform="translate(0, 22) scale(0.9)">${ICONS.user}</g>
      <text x="26" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="17" font-weight="800" fill="#f8fafc">${escapeXml(data.customerName)}</text>

      <g transform="translate(0, 52) scale(0.8)">${ICONS.mail}</g>
      <text x="26" y="66" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="600" fill="#93c5fd">${escapeXml(data.mailboxAddress)}</text>

      ${data.personalEmail ? `
      <text x="26" y="88" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="400" fill="#94a3b8">Personal: ${escapeXml(data.personalEmail)}</text>` : ''}
    </g>

    <line x1="300" y1="18" x2="300" y2="137" stroke="#334155" stroke-width="1.2" stroke-dasharray="4,4" />

    <!-- Right Column: Category & Subject -->
    <g transform="translate(325, 20)">
      <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">KATEGORI</text>

      <rect x="0" y="22" width="140" height="26" rx="13" fill="#1e293b" stroke="#64748b" stroke-width="1" />
      <g transform="translate(10, 26) scale(0.7)">${ICONS.tag}</g>
      <text x="78" y="39" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="700" fill="#e2e8f0" text-anchor="middle">${escapeXml(data.category)}</text>

      <text x="0" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">SUBJEK TIKET</text>

      <g transform="translate(0, 84) scale(0.85)">${ICONS.file}</g>
      <text x="26" y="99" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="16" font-weight="800" fill="#f1f5f9">${escapeXml(data.subject.length > 28 ? data.subject.slice(0, 25) + '...' : data.subject)}</text>
    </g>
  </g>

  <!-- Message Preview Box -->
  <g transform="translate(45, 328)">
    <rect width="620" height="110" rx="12" fill="#030712" stroke="#1e293b" stroke-width="1.2" />
    <rect x="0" y="0" width="6" height="110" rx="3" fill="${isUrgent ? '#ef4444' : '#38bdf8'}" />

    <g transform="translate(18, 14) scale(0.75)">${ICONS.chat}</g>
    <text x="42" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="800" fill="#f59e0b" letter-spacing="1">RINCIAN PESAN DARI KLIEN:</text>

    <text x="45" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-style="normal" font-weight="500" fill="#cbd5e1">
      ${messageTspans}
    </text>
  </g>

  ${renderMascotStage(mascotPose, mascotBubble, priorityBorder)}

  <!-- FOOTER -->
  <g transform="translate(45, 478)">
    <circle cx="8" cy="7" r="4.5" fill="#10b981" />
    <text x="20" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#10b981">AI Assistant Ready</text>
    
    <text x="155" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#64748b">•</text>
    <text x="170" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#64748b">EasyLegal Secure In-Memory Enclave</text>

    <text x="810" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#f59e0b" text-anchor="end">KLIK TOMBOL DI BAWAH UNTUK AKSI CEPAT ⚡</text>
  </g>
</svg>`;
}

/**
 * Generates an SVG string for Daily System Executive Digest
 */
export function generateDailyDigestCardSvg(data: {
  dateStr: string;
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  totalEmails: number;
  unreadEmails: number;
  usedMB: string;
  totalDocuments: number;
  activeSessions: number;
  totalMultiIp: number;
  auditLogsLast24h: number;
  openTickets: number;
  urgentTickets: number;
  resolvedTickets: number;
}): string {
  const isHealthy = data.totalMultiIp === 0 && data.urgentTickets === 0;
  const statusLabel = isHealthy ? 'ALL SYSTEMS OPERATIONAL' : 'SYSTEM ATTENTION REQUIRED';
  const statusBg = isHealthy ? 'url(#greenGrad)' : 'url(#urgentGrad)';
  const statusBorder = isHealthy ? '#10b981' : '#ef4444';
  const statusDot = isHealthy ? '#6ee7b7' : '#fca5a5';
  const mascotPose = isHealthy ? 'senang' : 'memikirkan';
  const mascotBubble = isHealthy
    ? 'Semua sistem aman, tim bisa kerja tenang!'
    : `${data.urgentTickets} tiket mendesak & ${data.totalMultiIp} anomali IP perlu dicek.`;

  return `<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070c18" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#161e38" />
    </linearGradient>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="urgentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#dc2626" />
      <stop offset="100%" stop-color="#991b1b" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#172238" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#0d1527" stop-opacity="0.95" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="50%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
  </defs>

  <rect width="900" height="520" rx="20" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="900" height="4" fill="url(#accentBar)" />
  <rect x="1" y="1" width="898" height="518" rx="19" fill="none" stroke="#334155" stroke-width="1.5" stroke-opacity="0.7" />

  <circle cx="820" cy="80" r="140" fill="#10b981" opacity="0.08" />
  <circle cx="90" cy="450" r="150" fill="#38bdf8" opacity="0.08" />

  <!-- HEADER -->
  <g transform="translate(45, 38)">
    <rect x="0" y="0" width="40" height="40" rx="10" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
    <g transform="translate(8, 8)">${ICONS.scale}</g>
    
    <text x="54" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="16" font-weight="800" fill="#ffffff" letter-spacing="1">EASYLEGAL EXECUTIVE DIGEST</text>
    <text x="54" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="600" fill="#94a3b8" letter-spacing="0.5">REKAP KONDISI, KEAMANAN &amp; TRANSAKSI SITUS HARIAN</text>
  </g>

  <!-- Status Badge -->
  <g transform="translate(610, 38)">
    <rect x="0" y="0" width="245" height="40" rx="20" fill="${statusBg}" stroke="${statusBorder}" stroke-width="1.5" />
    <circle cx="20" cy="20" r="5" fill="${statusDot}" />
    <text x="132" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${escapeXml(statusLabel)}</text>
  </g>

  <!-- Date Bar -->
  <g transform="translate(45, 102)">
    <g transform="translate(0, 0) scale(0.85)">${ICONS.clock}</g>
    <text x="24" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="600" fill="#cbd5e1">${escapeXml(data.dateStr)} WIB</text>
  </g>

  <!-- 4 WIDGETS GRID -->
  <!-- 1. Webmail & Cluster (Top Left) -->
  <g transform="translate(45, 130)">
    <rect width="290" height="150" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />
    <g transform="translate(20, 18)">
      <g transform="translate(0, 0) scale(0.85)">${ICONS.globe}</g>
      <text x="26" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="800" fill="#38bdf8" letter-spacing="1">CLUSTER &amp; WEBMAIL</text>

      <text x="0" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Titan Mail:</text>
      <text x="250" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#10b981" text-anchor="end">ONLINE</text>

      <text x="0" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Mailbox Resmi:</text>
      <text x="250" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" text-anchor="end">${data.totalCustomers} <tspan fill="#64748b" font-weight="400">(${data.activeCustomers} Aktif)</tspan></text>

      <text x="0" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Pesan Sinkron:</text>
      <text x="250" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" text-anchor="end">${data.totalEmails} <tspan fill="#38bdf8" font-weight="600">(${data.unreadEmails} Baru)</tspan></text>
    </g>
  </g>

  <!-- 2. Security Radar (Top Right) -->
  <g transform="translate(355, 130)">
    <rect width="290" height="150" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />
    <g transform="translate(20, 18)">
      <g transform="translate(0, 0) scale(0.85)">${ICONS.shield}</g>
      <text x="26" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="800" fill="#818cf8" letter-spacing="1">RADAR KEAMANAN</text>

      <text x="0" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Sesi Login Aktif:</text>
      <text x="250" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" text-anchor="end">${data.activeSessions}</text>

      <text x="0" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Anomali Multi-IP:</text>
      <text x="250" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="${data.totalMultiIp > 0 ? '#ef4444' : '#10b981'}" text-anchor="end">${data.totalMultiIp > 0 ? `${data.totalMultiIp} Alert` : '0 Aman'}</text>

      <text x="0" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Audit Logs (24 Jam):</text>
      <text x="250" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" text-anchor="end">${data.auditLogsLast24h}</text>
    </g>
  </g>

  <!-- 3. Storage & Synology NAS (Bottom Left) -->
  <g transform="translate(45, 295)">
    <rect width="290" height="150" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />
    <g transform="translate(20, 18)">
      <g transform="translate(0, 0) scale(0.85)">${ICONS.database}</g>
      <text x="26" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="800" fill="#fbbf24" letter-spacing="1">STORAGE &amp; ARSIP</text>

      <text x="0" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Hot Storage S3:</text>
      <text x="250" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" text-anchor="end">${data.usedMB} MB</text>

      <text x="0" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Berkas Legal Drive:</text>
      <text x="250" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" text-anchor="end">${data.totalDocuments}</text>

      <text x="0" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Synology Cold NAS:</text>
      <text x="250" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#10b981" text-anchor="end">TERHUBUNG</text>
    </g>
  </g>

  <!-- 4. Support Tickets Desk (Bottom Right) -->
  <g transform="translate(355, 295)">
    <rect width="290" height="150" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />
    <g transform="translate(20, 18)">
      <g transform="translate(0, 0) scale(0.85)">${ICONS.ticket}</g>
      <text x="26" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="800" fill="#f472b6" letter-spacing="1">TIKET SUPPORT</text>

      <text x="0" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Tiket Terbuka:</text>
      <text x="250" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="${data.openTickets > 0 ? '#f59e0b' : '#10b981'}" text-anchor="end">${data.openTickets}</text>

      <text x="0" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Prioritas Urgent:</text>
      <text x="250" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="${data.urgentTickets > 0 ? '#ef4444' : '#10b981'}" text-anchor="end">${data.urgentTickets > 0 ? `${data.urgentTickets} Mendesak` : '0 Mendesak'}</text>

      <text x="0" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Tiket Selesai:</text>
      <text x="250" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" font-weight="700" fill="#10b981" text-anchor="end">${data.resolvedTickets}</text>
    </g>
  </g>

  ${renderMascotStage(mascotPose, mascotBubble, statusBorder)}

  <!-- FOOTER -->
  <g transform="translate(45, 478)">
    <circle cx="8" cy="7" r="4.5" fill="#10b981" />
    <text x="20" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#10b981">Automated Daily Report (07:00 WIB)</text>
    
    <text x="275" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#64748b">•</text>
    <text x="290" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="500" fill="#64748b">Zero Data Leakage • 100% In-Memory Protected</text>

    <text x="810" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#38bdf8" text-anchor="end">SUPER ADMIN CONSOLE ⚡</text>
  </g>
</svg>`;
}

/**
 * Generates an SVG string for Security Radar Anomaly Alert
 */
export function generateSecurityAlertCardSvg(data: {
  accountName: string;
  mailboxAddress: string;
  uniqueIps: string[];
  sessionCount: number;
}): string {
  const ipList = data.uniqueIps.slice(0, 4).join(', ');

  return `<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#180707" />
      <stop offset="50%" stop-color="#240c0c" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="100%" stop-color="#b91c1c" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2c1212" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#160808" stop-opacity="0.95" />
    </linearGradient>
  </defs>

  <rect width="900" height="520" rx="20" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="900" height="5" fill="url(#redGrad)" />
  <rect x="1" y="1" width="898" height="518" rx="19" fill="none" stroke="#7f1d1d" stroke-width="1.5" />

  <!-- HEADER -->
  <g transform="translate(45, 38)">
    <rect x="0" y="0" width="40" height="40" rx="10" fill="#450a0a" stroke="#ef4444" stroke-width="1.5" />
    <g transform="translate(8, 8)">${ICONS.alert}</g>
    
    <text x="54" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="16" font-weight="800" fill="#ffffff" letter-spacing="1">SECURITY RADAR ALERT</text>
    <text x="54" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="11" font-weight="600" fill="#fca5a5" letter-spacing="0.5">ANOMALI LOGIN MULTI-IP TERDETEKSI</text>
  </g>

  <g transform="translate(635, 38)">
    <rect x="0" y="0" width="220" height="40" rx="20" fill="url(#redGrad)" stroke="#f87171" stroke-width="1.5" />
    <circle cx="22" cy="20" r="5" fill="#ffffff" />
    <text x="122" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">HIGH SECURITY RISK</text>
  </g>

  <!-- Content Box -->
  <g transform="translate(45, 120)">
    <rect width="620" height="320" rx="14" fill="url(#cardGrad)" stroke="#7f1d1d" stroke-width="1.5" />

    <g transform="translate(35, 30)">
      <text x="0" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#f87171" letter-spacing="1">AKUN TERDAMPAK:</text>
      <text x="0" y="48" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="22" font-weight="900" fill="#ffffff">${escapeXml(data.accountName)}</text>
      <text x="0" y="76" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="15" font-weight="600" fill="#93c5fd">${escapeXml(data.mailboxAddress)}</text>

      <line x1="0" y1="105" x2="550" y2="105" stroke="#7f1d1d" stroke-width="1" stroke-dasharray="4,4" />

      <text x="0" y="138" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#f87171" letter-spacing="1">JUMLAH ALAMAT IP BERBEDA:</text>
      <text x="0" y="170" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="24" font-weight="900" fill="#ef4444">${data.uniqueIps.length} IP Serentak (${data.sessionCount} Perangkat)</text>

      <text x="0" y="210" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#f87171" letter-spacing="1">DAFTAR IP TERDETEKSI:</text>
      <rect x="0" y="222" width="550" height="38" rx="8" fill="#180707" stroke="#7f1d1d" stroke-width="1" />
      <text x="16" y="246" font-family="monospace" font-size="13" font-weight="600" fill="#fecaca">${escapeXml(ipList)}</text>
    </g>
  </g>

  ${renderMascotStage('menyapa', `${data.uniqueIps.length} IP berbeda login serentak di akun ${data.accountName}!`, '#ef4444')}

  <!-- FOOTER -->
  <g transform="translate(45, 478)">
    <circle cx="8" cy="7" r="4.5" fill="#ef4444" />
    <text x="20" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#ef4444">Security Incident Flagged</text>
    <text x="810" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" font-size="12" font-weight="700" fill="#f59e0b" text-anchor="end">BUKA SECURITY RADAR DESK ⚡</text>
  </g>
</svg>`;
}

/**
 * Converts SVG to PNG Buffer using resvg-js in-memory
 */
export async function renderSvgToPng(svg: string, width = 900): Promise<Buffer | null> {
  try {
    // Dynamically load Resvg to prevent startup crash if native binary is unavailable
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resvg } = require('@resvg/resvg-js');
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
      font: {
        loadSystemFonts: true,
      },
    });
    const pngData = resvg.render();
    return pngData.asPng();
  } catch (err) {
    console.error('[CardGenerator] Error rendering SVG to PNG:', err);
    return null;
  }
}

/**
 * High-level wrapper to generate Ticket Card PNG
 */
export async function generateTicketCardPng(data: {
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  createdAtStr: string;
  customerName: string;
  mailboxAddress: string;
  personalEmail?: string;
  initialMessage?: string;
}): Promise<Buffer | null> {
  try {
    const svg = generateTicketCardSvg(data);
    return await renderSvgToPng(svg, 900);
  } catch (err) {
    console.error('[CardGenerator] Failed to generate ticket card PNG:', err);
    return null;
  }
}

/**
 * High-level wrapper to generate Daily Digest Card PNG
 */
export async function generateDailyDigestCardPng(data: {
  dateStr: string;
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  totalEmails: number;
  unreadEmails: number;
  usedMB: string;
  totalDocuments: number;
  activeSessions: number;
  totalMultiIp: number;
  auditLogsLast24h: number;
  openTickets: number;
  urgentTickets: number;
  resolvedTickets: number;
}): Promise<Buffer | null> {
  try {
    const svg = generateDailyDigestCardSvg(data);
    return await renderSvgToPng(svg, 900);
  } catch (err) {
    console.error('[CardGenerator] Failed to generate daily digest card PNG:', err);
    return null;
  }
}

/**
 * High-level wrapper to generate Security Anomaly Alert Card PNG
 */
export async function generateSecurityAlertCardPng(data: {
  accountName: string;
  mailboxAddress: string;
  uniqueIps: string[];
  sessionCount: number;
}): Promise<Buffer | null> {
  try {
    const svg = generateSecurityAlertCardSvg(data);
    return await renderSvgToPng(svg, 900);
  } catch (err) {
    console.error('[CardGenerator] Failed to generate security alert card PNG:', err);
    return null;
  }
}
