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
 * Strips HTML tags and unescapes entities for SVG rendering
 */
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Splits text into wrapped lines for multi-line SVG rendering (<tspan>)
 */
export function wrapText(text: string, maxLen = 60): string[] {
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

// Vector SVG icons for crisp OS-independent rendering (exact Lucide paths from easylegal-kartu-notifikasi.html)
const ICONS: Record<string, string> = {
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".6" fill="currentColor"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

export const POSE_LAYOUT: Record<string, { h: number; right: number; bottom: number; tail: number }> = {
  melambai:   { h: 300, right: 18, bottom: 14, tail: 92 },
  menyapa:    { h: 262, right: 14, bottom: 30, tail: 96 },
  muncul:     { h: 296, right: 0,  bottom: 38, tail: 34 },
  semangat:   { h: 262, right: 16, bottom: 30, tail: 112 },
  tips:       { h: 300, right: 0,  bottom: -6, tail: 62 },
  memikirkan: { h: 262, right: 26, bottom: 30, tail: 110 },
  konfirmasi: { h: 292, right: 22, bottom: 14, tail: 100 },
  saran:      { h: 262, right: 34, bottom: 30, tail: 92 },
  senang:     { h: 258, right: 14, bottom: 30, tail: 104 },
};

export interface TicketStateDefinition {
  label: string;
  tone: string;
  deep: string;
  pose: string;
  pill: string;
  sub: string | ((t: any) => string);
  bubble: (t: any) => string;
  msgLabel: string;
}

export const TICKET_STATES: Record<string, TicketStateDefinition> = {
  baru: {
    label: 'Baru',
    tone: '#3b82f6',
    deep: '#1d4ed8',
    pose: 'melambai',
    pill: 'TIKET BARU (SLA 24 JAM)',
    sub: 'TIKET SUPPORT BARU • ANTREAN NORMAL',
    bubble: (t: any) => `Halo tim! Ada tiket baru dari ${t.customerName || t.name || 'Klien'}.`,
    msgLabel: 'Rincian pesan dari klien:',
  },
  urgent: {
    label: 'Urgent',
    tone: '#ef4444',
    deep: '#b91c1c',
    pose: 'menyapa',
    pill: 'URGENT (< 4 JAM SLA)',
    sub: 'TIKET SUPPORT BARU • PRIORITY DISPATCH',
    bubble: (t: any) => `Urgent! Sisa SLA tinggal ${t.slaLeft || '< 4 jam'}.`,
    msgLabel: 'Rincian pesan dari klien:',
  },
  reminder: {
    label: 'Belum dibalas',
    tone: '#f59e0b',
    deep: '#b45309',
    pose: 'muncul',
    pill: 'BELUM DIBALAS 30 MNT',
    sub: 'PENGINGAT • BELUM ADA AGEN',
    bubble: () => 'Psst… tiket ini belum ada yang pegang.',
    msgLabel: 'Rincian pesan dari klien:',
  },
  diproses: {
    label: 'Diproses',
    tone: '#06b6d4',
    deep: '#0e7490',
    pose: 'semangat',
    pill: 'SEDANG DIPROSES',
    sub: (t: any) => `UPDATE TIKET • DITANGANI ${t.agent || 'TIM CS'}`,
    bubble: (t: any) => `${t.agent || 'Tim CS'} sedang pegang tiket ini. Semangat!`,
    msgLabel: 'Rincian pesan dari klien:',
  },
  ai: {
    label: 'Draf AI',
    tone: '#a855f7',
    deep: '#7e22ce',
    pose: 'tips',
    pill: 'DRAF AI SIAP',
    sub: 'AI ASSISTANT • MENUNGGU REVIEW AGEN',
    bubble: () => 'Draf balasan siap. Cek dulu sebelum kirim, ya.',
    msgLabel: 'Draf balasan AI:',
  },
  menunggu: {
    label: 'Menunggu klien',
    tone: '#fb923c',
    deep: '#c2410c',
    pose: 'memikirkan',
    pill: 'MENUNGGU KLIEN',
    sub: 'UPDATE TIKET • SLA DIJEDA',
    bubble: () => 'Menunggu dokumen dari klien. SLA dijeda dulu.',
    msgLabel: 'Pesan terakhir ke klien:',
  },
  selesai: {
    label: 'Selesai',
    tone: '#22c55e',
    deep: '#15803d',
    pose: 'konfirmasi',
    pill: 'SELESAI',
    sub: 'TIKET DITUTUP • SLA TERPENUHI',
    bubble: (t: any) => `Beres! Selesai dalam ${t.resolvedIn || 'tepat waktu'}.`,
    msgLabel: 'Catatan penyelesaian:',
  },
};

export interface ServerStateDefinition {
  label: string;
  tone: string;
  deep: string;
  pose: string;
  pill: string;
  sub: string;
  uptime: string;
  bubble: string;
}

export const SERVER_STATES: Record<string, ServerStateDefinition> = {
  normal: {
    label: 'Normal',
    tone: '#22c55e',
    deep: '#15803d',
    pose: 'senang',
    pill: 'SEMUA SISTEM NORMAL',
    sub: 'LAPORAN BERKALA • STATUS SISTEM',
    uptime: '99,98',
    bubble: 'Semua layanan aman. Tim bisa kerja tenang!',
  },
  gangguan: {
    label: 'Gangguan',
    tone: '#f59e0b',
    deep: '#b45309',
    pose: 'memikirkan',
    pill: 'GANGGUAN SEBAGIAN',
    sub: 'INSIDEN TERDETEKSI • SEDANG DIPANTAU',
    uptime: '99,91',
    bubble: 'WhatsApp Gateway melambat. Tim infra sedang cek.',
  },
  maintenance: {
    label: 'Maintenance',
    tone: '#3b82f6',
    deep: '#1d4ed8',
    pose: 'saran',
    pill: 'MAINTENANCE TERJADWAL',
    sub: 'PEMBERITAHUAN • MAINTENANCE TERJADWAL',
    uptime: '99,96',
    bubble: 'Webmail maintenance malam ini, 22.00–23.00 WIB.',
  },
  down: {
    label: 'Down',
    tone: '#ef4444',
    deep: '#b91c1c',
    pose: 'menyapa',
    pill: 'LAYANAN DOWN',
    sub: 'INSIDEN KRITIS • ESKALASI OTOMATIS',
    uptime: '99,62',
    bubble: 'Layanan down! Tim on-call sudah dipanggil.',
  },
};

export interface ServiceItem {
  key: string;
  name: string;
  ms: number;
  up: number;
  status?: string;
}

export const DEFAULT_SERVICES: ServiceItem[] = [
  { key: 'portal', name: 'Customer Portal', ms: 142, up: 99.99 },
  { key: 'api', name: 'API Backend', ms: 88, up: 99.98 },
  { key: 'resi', name: 'Tracking Resi', ms: 156, up: 99.97 },
  { key: 'mail', name: 'Webmail', ms: 212, up: 99.95 },
  { key: 'wa', name: 'WhatsApp Gateway', ms: 318, up: 99.93 },
  { key: 'ai', name: 'AI Assistant', ms: 640, up: 99.96 },
];

/**
 * 30-day stable pseudorandom tick history matching easylegal-kartu-notifikasi.html
 */
export function generateHistoryTicks(key: string, currentStatus = 'ok'): string[] {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: string[] = [];
  for (let i = 0; i < 29; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const r = (h >>> 16) % 100;
    out.push(r < 4 ? 'w' : r < 5 ? 'd' : '');
  }
  const last = currentStatus === 'slow' ? 'w' : currentStatus === 'down' ? 'd' : currentStatus === 'maint' ? 'm' : '';
  out.push(last);
  return out;
}

/**
 * Renders the EL Mascot stage: speech bubble with tail + high-res PNG mascot
 */
function renderMascotStage(poseKey: string, bubbleText: string, toneColor: string): string {
  const art = MASCOT_POSES[poseKey] || MASCOT_POSES.melambai;
  const L = POSE_LAYOUT[poseKey] || POSE_LAYOUT.melambai;

  const targetH = L.h;
  const targetW = Math.round((art.w * L.h) / art.h);
  const imgX = 900 - L.right - targetW;
  const imgY = 520 - L.bottom - targetH;

  const lines = wrapText(bubbleText, 25).slice(0, 3);
  const bubbleH = 34 + lines.length * 18;
  const bubbleX = 686;
  const bubbleY = 104;
  const bubbleBottom = bubbleY + bubbleH;

  const tailX = 900 - L.tail;

  const bubbleTspans = lines
    .map((l, i) => `<tspan x="${bubbleX + 16}" dy="${i === 0 ? 0 : 18}">${escapeXml(l)}</tspan>`)
    .join('');

  // Lighter border tone for the bubble
  const bubbleStroke = toneColor;

  return `
  <!-- MASCOT STAGE -->
  <g>
    <!-- Speech Bubble -->
    <rect x="${bubbleX}" y="${bubbleY}" width="194" height="${bubbleH}" rx="14" fill="#ffffff" stroke="${bubbleStroke}" stroke-width="1.5" />
    <!-- Bubble Tail pointing to mascot -->
    <polygon points="${tailX - 7},${bubbleBottom} ${tailX + 7},${bubbleBottom} ${tailX},${bubbleBottom + 7}" fill="#ffffff" stroke="${bubbleStroke}" stroke-width="1.5" />
    <line x1="${tailX - 6}" y1="${bubbleBottom}" x2="${tailX + 6}" y2="${bubbleBottom}" stroke="#ffffff" stroke-width="2" />
    <text x="${bubbleX + 16}" y="${bubbleY + 22}" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#111827">
      ${bubbleTspans}
    </text>

    <!-- Mascot Image -->
    <image href="data:image/png;base64,${art.base64}" x="${imgX}" y="${imgY}" width="${targetW}" height="${targetH}" />
  </g>`;
}

/**
 * Common Header markup matching easylegal-kartu-notifikasi.html
 */
function renderCardHeader(title: string, subtitle: string, st: { pill: string; tone: string; deep: string }): string {
  const pillWidth = Math.max(200, 52 + st.pill.length * 8.2);
  const pillX = 856 - pillWidth;

  return `
  <!-- TOPLINE -->
  <rect x="0" y="0" width="900" height="4" fill="url(#toplineGrad)" />

  <!-- HEADER -->
  <g transform="translate(44, 34)">
    <!-- Red Brand Logo -->
    <rect x="0" y="0" width="42" height="42" rx="12" fill="url(#logoGrad)" />
    <g transform="translate(9, 9) scale(0.95)" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${ICONS.scale}
    </g>

    <!-- Brand Title & Subtitle -->
    <text x="56" y="18" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="600" fill="#111827" letter-spacing="1.6">${escapeXml(title)}</text>
    <text x="56" y="36" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="500" fill="#7c8596" letter-spacing="1.0">${escapeXml(subtitle.toUpperCase())}</text>
  </g>

  <!-- Status Pill Badge -->
  <g>
    <rect x="${pillX}" y="36" width="${pillWidth}" height="40" rx="20" fill="url(#pillGrad)" />
    <circle cx="${pillX + 20}" cy="56" r="4.5" fill="#ffffff" />
    <text x="${pillX + 34}" y="61" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="600" fill="#ffffff" letter-spacing="0.6">${escapeXml(st.pill)}</text>
  </g>`;
}

/**
 * Common Footer markup matching easylegal-kartu-notifikasi.html
 */
function renderCardFooter(left1Text: string, left2Text: string, rightText: string): string {
  const avatarB64 = MASCOT_POSES.avatar ? MASCOT_POSES.avatar.base64 : '';

  return `
  <!-- FOOTER -->
  <g>
    <rect x="0" y="470" width="900" height="50" fill="#f3f5f8" />
    <line x1="0" y1="470" x2="900" y2="470" stroke="#e3e7ee" stroke-width="1" />

    <!-- Avatar circle -->
    <g transform="translate(44, 482)">
      <circle cx="13" cy="13" r="13" fill="#ffffff" stroke="#d5dbe4" stroke-width="1" />
      ${avatarB64 ? `<clipPath id="footAvatarClip"><circle cx="13" cy="13" r="13" /></clipPath><image href="data:image/png;base64,${avatarB64}" x="0" y="0" width="26" height="26" clip-path="url(#footAvatarClip)" />` : ''}
    </g>

    <!-- AI Ready / Status text -->
    <circle cx="86" cy="495" r="4" fill="#22c55e" />
    <text x="96" y="499" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="600" fill="#16a34a">${escapeXml(left1Text)}</text>

    <!-- Subtitle / Security Enclave -->
    <text x="238" y="499" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" fill="#7c8596">•</text>
    <text x="252" y="499" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="400" fill="#7c8596">${escapeXml(left2Text)}</text>

    <!-- Right Call To Action -->
    <text x="836" y="499" font-family="'JBMono', Menlo, Consolas, monospace" font-size="11" font-weight="700" fill="#d7232c" letter-spacing="1.4" text-anchor="end">${escapeXml(rightText)}</text>
    <g transform="translate(844, 486) scale(0.85)" stroke="#d7232c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${ICONS.zap}
    </g>
  </g>`;
}

export interface TicketCardInput {
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  createdAtStr: string;
  customerName: string;
  mailboxAddress: string;
  personalEmail?: string;
  initialMessage?: string;
  stateKey?: string;
  agent?: string;
  aiDraft?: string;
  resolution?: string;
  resolvedIn?: string;
  slaLeft?: string;
}

/**
 * Generates an SVG string for Support Ticket Card based on easylegal-kartu-notifikasi.html
 */
export function generateTicketCardSvg(data: TicketCardInput): string {
  const isUrgent = data.priority?.toLowerCase() === 'urgent';
  let stateKey = data.stateKey || (isUrgent ? 'urgent' : 'baru');
  if (!TICKET_STATES[stateKey]) stateKey = isUrgent ? 'urgent' : 'baru';

  const st = TICKET_STATES[stateKey];
  const subText = typeof st.sub === 'function' ? st.sub(data) : st.sub;
  const bubbleText = st.bubble(data);

  const snippet = data.aiDraft && (stateKey === 'ai' || stateKey === 'menunggu')
    ? data.aiDraft
    : data.resolution && stateKey === 'selesai'
    ? data.resolution
    : data.initialMessage || 'Bagaimana prosedur layanan ini dapat kami bantu?';

  const messageLines = wrapText(snippet, 62).slice(0, 3);
  if (wrapText(snippet, 62).length > 3 && messageLines.length >= 3) {
    messageLines[2] = messageLines[2] + '...';
  }

  const messageTspans = messageLines
    .map((line, idx) => `<tspan x="68" dy="${idx === 0 ? 0 : 22}">${escapeXml(line)}</tspan>`)
    .join('');

  const subjectTrunc = data.subject.length > 30 ? data.subject.slice(0, 28) + '...' : data.subject;
  const categoryTrunc = data.category.length > 20 ? data.category.slice(0, 18) + '..' : data.category;
  const chipWidth = Math.max(120, 36 + categoryTrunc.length * 8.5);

  return `<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="55%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f6f7fa" />
    </linearGradient>
    <linearGradient id="toplineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${st.deep}" />
      <stop offset="100%" stop-color="${st.tone}" />
    </linearGradient>
    <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d7232c" />
      <stop offset="100%" stop-color="#a8141c" />
    </linearGradient>
    <linearGradient id="pillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${st.tone}" />
      <stop offset="100%" stop-color="${st.deep}" />
    </linearGradient>
    <radialGradient id="visorGrad" cx="20%" cy="0%" r="140%">
      <stop offset="0%" stop-color="#23262e" />
      <stop offset="55%" stop-color="#0d0f14" />
    </radialGradient>
    <radialGradient id="orbTop" cx="100%" cy="0%" r="100%">
      <stop offset="0%" stop-color="${st.tone}" stop-opacity="0.20" />
      <stop offset="55%" stop-color="${st.tone}" stop-opacity="0.07" />
      <stop offset="100%" stop-color="${st.tone}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowBottom" cx="100%" cy="100%" r="100%">
      <stop offset="0%" stop-color="${st.tone}" stop-opacity="0.16" />
      <stop offset="68%" stop-color="${st.tone}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- BASE CARD -->
  <rect width="900" height="520" rx="18" fill="url(#cardBg)" stroke="#dde2ea" stroke-width="1" />
  <circle cx="820" cy="30" r="160" fill="url(#orbTop)" />
  <circle cx="850" cy="460" r="150" fill="url(#glowBottom)" />

  ${renderCardHeader('EASYLEGAL CUSTOMER PORTAL', subText, st)}

  <!-- BODY: ID & META TIME -->
  <g transform="translate(44, 104)">
    <text x="0" y="32" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="700" fill="#111827" letter-spacing="0.3">#${escapeXml(data.ticketNumber)}</text>
    
    <g transform="translate(192, 16) scale(0.75)" stroke="#7c8596" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${ICONS.clock}
    </g>
    <text x="214" y="30" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#4b5565">${escapeXml(data.createdAtStr)}</text>
  </g>

  <!-- BODY: INFO PANEL -->
  <g transform="translate(44, 156)">
    <rect width="626" height="154" rx="14" fill="#f7f8fa" stroke="#e3e7ee" stroke-width="1" />

    <!-- Left Column: Client info -->
    <g transform="translate(24, 20)">
      <text x="0" y="10" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#7c8596" letter-spacing="1.3">PEMOHON / KLIEN</text>
      
      <g transform="translate(0, 20) scale(0.85)" stroke="#d7232c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS.user}
      </g>
      <text x="26" y="36" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18.5" font-weight="600" fill="#111827">${escapeXml(data.customerName)}</text>

      <g transform="translate(0, 50) scale(0.75)" stroke="#1f6fe0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS.mail}
      </g>
      <text x="26" y="64" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="#1f6fe0">${escapeXml(data.mailboxAddress)}</text>

      <text x="26" y="86" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="400" fill="#7c8596">Personal: ${escapeXml(data.personalEmail || '-')}</text>
    </g>

    <!-- Dashed separator -->
    <line x1="346" y1="18" x2="346" y2="136" stroke="#cfd5de" stroke-width="1" stroke-dasharray="4,4" />

    <!-- Right Column: Category & Subject -->
    <g transform="translate(370, 20)">
      <text x="0" y="10" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#7c8596" letter-spacing="1.3">KATEGORI</text>
      
      <rect x="0" y="20" width="${chipWidth}" height="28" rx="9" fill="#ffffff" stroke="#d5dbe4" stroke-width="1" />
      <g transform="translate(10, 26) scale(0.7)" stroke="#6366f1" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS.tag}
      </g>
      <text x="32" y="39" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="500" fill="#334155">${escapeXml(categoryTrunc)}</text>

      <text x="0" y="70" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#7c8596" letter-spacing="1.3">SUBJEK TIKET</text>
      
      <g transform="translate(0, 78) scale(0.85)" stroke="#d7232c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS.file}
      </g>
      <text x="24" y="94" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16.5" font-weight="600" fill="#111827">${escapeXml(subjectTrunc)}</text>
    </g>
  </g>

  <!-- BODY: MESSAGE "VISOR" PANEL -->
  <g transform="translate(44, 326)">
    <rect width="626" height="116" rx="14" fill="url(#visorGrad)" />
    <!-- Left tone bar -->
    <rect x="0" y="0" width="4" height="116" rx="2" fill="${st.tone}" />

    <g transform="translate(24, 16) scale(0.75)" stroke="${st.tone}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${ICONS.msg}
    </g>
    <text x="48" y="29" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="600" fill="#c4cad4" letter-spacing="0.5">${escapeXml(st.msgLabel.toUpperCase())}</text>

    <text x="24" y="56" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14.5" font-weight="400" fill="#f3f4f6">
      ${messageTspans}
    </text>
  </g>

  ${renderMascotStage(st.pose, bubbleText, st.tone)}

  ${renderCardFooter('AI Assistant Ready', 'EasyLegal Secure In-Memory Enclave', 'KLIK TOMBOL DI BAWAH UNTUK AKSI CEPAT')}
</svg>`;
}

export interface ServerCardInput {
  stateKey?: string;
  serverTime?: string;
  serverNext?: string;
  services?: Array<{
    key: string;
    name: string;
    ms: number;
    up: number;
    status?: string;
  }>;
  uptimePct?: string;
  okCount?: number;
  pose?: string;
  toneColor?: string;
  deepColor?: string;
  pillText?: string;
  bubbleText?: string;
}

/**
 * Generates an SVG string for Server Status Card based on easylegal-kartu-notifikasi.html
 */
export function generateServerStatusCardSvg(data?: ServerCardInput): string {
  let stateKey = data?.stateKey || 'normal';
  if (!SERVER_STATES[stateKey]) stateKey = 'normal';

  const baseSt = SERVER_STATES[stateKey];
  const st = {
    ...baseSt,
    pose: data?.pose || baseSt.pose,
    tone: data?.toneColor || baseSt.tone,
    deep: data?.deepColor || baseSt.deep,
    pill: data?.pillText || baseSt.pill,
    bubble: data?.bubbleText || baseSt.bubble,
  };
  const services = data?.services || DEFAULT_SERVICES;
  const okCount = data?.okCount !== undefined
    ? data.okCount
    : services.filter(s => !s.status || s.status === 'ok').length;
  const uptimeStr = data?.uptimePct || st.uptime;
  const serverTimeStr = data?.serverTime || 'Jumat, 11 September 2026 - 07:00 WIB';
  const serverNextStr = data?.serverNext || '08:00 WIB';

  // Build service table rows
  const statusColorMap: Record<string, { stat: string; statCol: string; dotCol: string }> = {
    ok: { stat: 'Normal', statCol: '#15803d', dotCol: '#22c55e' },
    slow: { stat: 'Lambat', statCol: '#b45309', dotCol: '#f59e0b' },
    maint: { stat: 'Maintenance', statCol: '#1d4ed8', dotCol: '#3b82f6' },
    down: { stat: 'Down', statCol: '#dc2626', dotCol: '#ef4444' },
  };

  const tickColorMap: Record<string, string> = {
    '': '#34c46a',
    'w': '#f59e0b',
    'd': '#ef4444',
    'm': '#3b82f6',
  };

  const rowsMarkup = services.map((s, idx) => {
    const status = s.status || (stateKey === 'down' && idx === 0 ? 'down' : stateKey === 'gangguan' && idx === 4 ? 'slow' : 'ok');
    const info = statusColorMap[status] || statusColorMap.ok;
    const msStr = status === 'down' || status === 'maint' ? '—' : `${s.ms.toLocaleString('id-ID')} ms`;
    const upStr = (status === 'down' ? s.up - 0.41 : status === 'slow' ? s.up - 0.06 : s.up).toFixed(2).replace('.', ',');

    const rowY = 32 + idx * 36;
    const ticks = generateHistoryTicks(s.key, status);

    const barsMarkup = ticks.map((t, bIdx) => {
      const barX = 350 + bIdx * 6.8;
      const color = tickColorMap[t] || '#34c46a';
      return `<rect x="${barX.toFixed(1)}" y="${rowY - 10}" width="4" height="14" rx="1.5" fill="${color}" />`;
    }).join('');

    return `
    <g>
      <line x1="20" y1="${rowY - 17}" x2="606" y2="${rowY - 17}" stroke="#e8ebf0" stroke-width="1" />
      <circle cx="28" cy="${rowY - 3}" r="4.5" fill="${info.dotCol}" />
      <text x="42" y="${rowY + 2}" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#111827">${escapeXml(s.name)}</text>
      <text x="210" y="${rowY + 2}" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="600" fill="${info.statCol}">${escapeXml(info.stat)}</text>
      <text x="328" y="${rowY + 2}" font-family="'JBMono', monospace" font-size="12" font-weight="${status === 'slow' ? '700' : '400'}" fill="${status === 'slow' ? '#b45309' : '#4b5565'}" text-anchor="end">${escapeXml(msStr)}</text>
      ${barsMarkup}
      <text x="604" y="${rowY + 2}" font-family="'JBMono', monospace" font-size="12" font-weight="500" fill="#4b5565" text-anchor="end">${upStr}%</text>
    </g>`;
  }).join('');

  return `<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="55%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f6f7fa" />
    </linearGradient>
    <linearGradient id="toplineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${st.deep}" />
      <stop offset="100%" stop-color="${st.tone}" />
    </linearGradient>
    <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d7232c" />
      <stop offset="100%" stop-color="#a8141c" />
    </linearGradient>
    <linearGradient id="pillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${st.tone}" />
      <stop offset="100%" stop-color="${st.deep}" />
    </linearGradient>
    <radialGradient id="orbTop" cx="100%" cy="0%" r="100%">
      <stop offset="0%" stop-color="${st.tone}" stop-opacity="0.20" />
      <stop offset="55%" stop-color="${st.tone}" stop-opacity="0.07" />
      <stop offset="100%" stop-color="${st.tone}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowBottom" cx="100%" cy="100%" r="100%">
      <stop offset="0%" stop-color="${st.tone}" stop-opacity="0.16" />
      <stop offset="68%" stop-color="${st.tone}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- BASE CARD -->
  <rect width="900" height="520" rx="18" fill="url(#cardBg)" stroke="#dde2ea" stroke-width="1" />
  <circle cx="820" cy="30" r="160" fill="url(#orbTop)" />
  <circle cx="850" cy="460" r="150" fill="url(#glowBottom)" />

  ${renderCardHeader('EASYLEGAL SERVER STATUS', st.sub, st)}

  <!-- BODY: UPTIME SUMMARY -->
  <g transform="translate(44, 104)">
    <text x="0" y="36" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="38" font-weight="700" fill="#111827">${escapeXml(uptimeStr)}%</text>
    <text x="160" y="32" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#7c8596">uptime 30 hari</text>

    <g transform="translate(400, 8)">
      <g transform="translate(0, 2) scale(0.75)" stroke="#7c8596" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS.clock}
      </g>
      <text x="22" y="16" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="#4b5565">${escapeXml(serverTimeStr)}</text>
      <text x="226" y="36" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="500" fill="#7c8596" text-anchor="end">
        <tspan font-weight="700" fill="#111827">${okCount}/${services.length}</tspan> layanan normal
      </text>
    </g>
  </g>

  <!-- BODY: SERVICES TABLE -->
  <g transform="translate(44, 168)">
    <rect width="626" height="274" rx="14" fill="#f7f8fa" stroke="#e3e7ee" stroke-width="1" />

    <!-- Table Header -->
    <text x="20" y="24" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="500" fill="#7c8596" letter-spacing="1.2">LAYANAN</text>
    <text x="210" y="24" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="500" fill="#7c8596" letter-spacing="1.2">STATUS</text>
    <text x="328" y="24" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="500" fill="#7c8596" letter-spacing="1.2" text-anchor="end">LATENSI</text>
    <text x="350" y="24" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="500" fill="#7c8596" letter-spacing="1.2">30 HARI TERAKHIR</text>
    <text x="604" y="24" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="500" fill="#7c8596" letter-spacing="1.2" text-anchor="end">UPTIME</text>

    <!-- Table Rows -->
    ${rowsMarkup}
  </g>

  ${renderMascotStage(st.pose, st.bubble, st.tone)}

  ${renderCardFooter('Cek otomatis tiap 60 detik', 'EasyLegal Secure Monitoring Enclave', `UPDATE BERIKUTNYA ${serverNextStr}`)}
</svg>`;
}

export interface DailyDigestCardInput {
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
}

/**
 * Generates an SVG string for Daily Executive Digest using the Server Status card template
 */
export function generateDailyDigestCardSvg(data: DailyDigestCardInput): string {
  const isHealthy = data.totalMultiIp === 0 && data.urgentTickets === 0;
  const stateKey = isHealthy ? 'normal' : 'gangguan';

  const customServices = [
    { key: 'portal', name: 'Customer Portal', ms: 142, up: 99.99, status: 'ok' },
    { key: 'api', name: 'API Backend', ms: 88, up: 99.98, status: 'ok' },
    { key: 'resi', name: 'Tracking Resi', ms: 156, up: 99.97, status: 'ok' },
    { key: 'mail', name: 'Webmail Cluster', ms: 212, up: 99.95, status: 'ok' },
    { key: 'wa', name: 'WhatsApp Gateway', ms: data.totalMultiIp > 0 ? 2840 : 318, up: 99.93, status: data.totalMultiIp > 0 ? 'slow' : 'ok' },
    { key: 'ai', name: 'AI Assistant', ms: 640, up: 99.96, status: 'ok' },
  ];

  let bubble = 'Semua layanan aman. Tim bisa kerja tenang!';
  let pill = 'SEMUA SISTEM NORMAL';
  if (data.urgentTickets > 0) {
    bubble = `${data.urgentTickets} tiket urgent membutuhkan penanganan segera!`;
    pill = `${data.urgentTickets} TIKET URGENT PERLU TINDAKAN`;
  } else if (data.totalMultiIp > 0) {
    bubble = `${data.totalMultiIp} anomali Multi-IP login terdeteksi pada radar keamanan.`;
    pill = `${data.totalMultiIp} ANOMALI MULTI-IP TERDETEKSI`;
  }

  return generateServerStatusCardSvg({
    stateKey,
    serverTime: `${data.dateStr} WIB`,
    serverNext: 'Besok 07:00 WIB',
    services: customServices,
    uptimePct: isHealthy ? '99,98' : '99,85',
    pose: isHealthy ? 'senang' : 'memikirkan',
    toneColor: isHealthy ? '#22c55e' : '#ef4444',
    deepColor: isHealthy ? '#15803d' : '#b91c1c',
    pillText: isHealthy ? 'SEMUA SISTEM SEHAT' : pill,
    bubbleText: bubble,
  });
}

export interface SecurityAlertInput {
  accountName: string;
  mailboxAddress: string;
  uniqueIps: string[];
  sessionCount: number;
}

/**
 * Generates an SVG string for Security Incident Alerts based on the same design system
 */
export function generateSecurityAlertCardSvg(data: SecurityAlertInput): string {
  const ipList = data.uniqueIps.join(' • ');
  const st = {
    pill: 'ANOMALI MULTI-IP TERDETEKSI',
    tone: '#ef4444',
    deep: '#b91c1c',
  };

  return `<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="55%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#fff5f5" />
    </linearGradient>
    <linearGradient id="toplineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#b91c1c" />
      <stop offset="100%" stop-color="#ef4444" />
    </linearGradient>
    <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d7232c" />
      <stop offset="100%" stop-color="#a8141c" />
    </linearGradient>
    <linearGradient id="pillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="100%" stop-color="#b91c1c" />
    </linearGradient>
    <radialGradient id="visorGrad" cx="20%" cy="0%" r="140%">
      <stop offset="0%" stop-color="#2a1215" />
      <stop offset="55%" stop-color="#140507" />
    </radialGradient>
    <radialGradient id="orbTop" cx="100%" cy="0%" r="100%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.22" />
      <stop offset="55%" stop-color="#ef4444" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowBottom" cx="100%" cy="100%" r="100%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.16" />
      <stop offset="68%" stop-color="#ef4444" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- BASE CARD -->
  <rect width="900" height="520" rx="18" fill="url(#cardBg)" stroke="#fecaca" stroke-width="1.2" />
  <circle cx="820" cy="30" r="160" fill="url(#orbTop)" />
  <circle cx="850" cy="460" r="150" fill="url(#glowBottom)" />

  ${renderCardHeader('EASYLEGAL SECURITY RADAR', 'PERINGATAN ANOMALI AKSES AKUN', st)}

  <!-- BODY: SECURITY ALERT PANEL -->
  <g transform="translate(44, 114)">
    <rect width="626" height="326" rx="14" fill="#ffffff" stroke="#fee2e2" stroke-width="1.5" />

    <g transform="translate(28, 26)">
      <text x="0" y="10" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#dc2626" letter-spacing="1.2">AKUN TERDAMPAK</text>
      <text x="0" y="38" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="700" fill="#111827">${escapeXml(data.accountName)}</text>
      <text x="0" y="64" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14.5" font-weight="500" fill="#2563eb">${escapeXml(data.mailboxAddress)}</text>

      <line x1="0" y1="90" x2="570" y2="90" stroke="#fecaca" stroke-width="1" stroke-dasharray="4,4" />

      <text x="0" y="120" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#dc2626" letter-spacing="1.2">STATUS LOGIN SERENTAK</text>
      <text x="0" y="150" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800" fill="#dc2626">${data.uniqueIps.length} Alamat IP Berbeda (${data.sessionCount} Sesi Aktif)</text>

      <text x="0" y="190" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#7c8596" letter-spacing="1.2">DAFTAR IP TERDETEKSI</text>
      <rect x="0" y="202" width="570" height="42" rx="8" fill="#fff1f2" stroke="#fecaca" stroke-width="1" />
      <text x="16" y="228" font-family="'JBMono', monospace" font-size="13" font-weight="600" fill="#991b1b">${escapeXml(ipList)}</text>
    </g>
  </g>

  ${renderMascotStage('menyapa', `${data.uniqueIps.length} IP berbeda login serentak di akun ${data.accountName}!`, '#ef4444')}

  ${renderCardFooter('Security Radar Active', 'EasyLegal Real-time Threat Intelligence', 'BUKA SECURITY RADAR DESK')}
</svg>`;
}

/**
 * Converts SVG string to PNG Buffer using resvg-js in-memory
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
export async function generateTicketCardPng(data: TicketCardInput): Promise<Buffer | null> {
  try {
    const svg = generateTicketCardSvg(data);
    return await renderSvgToPng(svg, 900);
  } catch (err) {
    console.error('[CardGenerator] Failed to generate ticket card PNG:', err);
    return null;
  }
}

/**
 * High-level wrapper to generate Server Status Card PNG
 */
export async function generateServerStatusCardPng(data?: ServerCardInput): Promise<Buffer | null> {
  try {
    const svg = generateServerStatusCardSvg(data);
    return await renderSvgToPng(svg, 900);
  } catch (err) {
    console.error('[CardGenerator] Failed to generate server status card PNG:', err);
    return null;
  }
}

/**
 * High-level wrapper to generate Daily Digest Card PNG
 */
export async function generateDailyDigestCardPng(data: DailyDigestCardInput): Promise<Buffer | null> {
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
export async function generateSecurityAlertCardPng(data: SecurityAlertInput): Promise<Buffer | null> {
  try {
    const svg = generateSecurityAlertCardSvg(data);
    return await renderSvgToPng(svg, 900);
  } catch (err) {
    console.error('[CardGenerator] Failed to generate security alert card PNG:', err);
    return null;
  }
}

export interface AiAssistantCardInput {
  query: string;
  replySummary: string;
  senderName?: string;
  category?: string;
  pillText?: string;
  toneColor?: string;
  deepColor?: string;
  pose?: string;
  bubbleText?: string;
  timestampStr?: string;
}

/**
 * Generates an SVG string for AI Assistant Chat Response Card based on easylegal-kartu-notifikasi.html
 */
export function generateAiAssistantCardSvg(data: AiAssistantCardInput): string {
  const toneColor = data.toneColor || '#8b5cf6';
  const deepColor = data.deepColor || '#6d28d9';
  const pillText = data.pillText || 'JAWABAN AI • REAL-TIME';
  const category = data.category || 'AI EXECUTIVE ASSISTANT';
  const pose = data.pose || 'tips';
  const bubbleText = data.bubbleText || 'Jawaban sudah siap! Cek detailnya di bawah ya.';
  const senderName = data.senderName || 'Super Admin';
  const timestampStr = data.timestampStr || 'Hari ini - Real-time';

  const truncatedQuery = data.query.length > 36 ? data.query.slice(0, 33) + '...' : data.query;

  // Format summary text into clean rows
  const rawLines = data.replySummary
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const formattedLines: string[] = [];
  for (const line of rawLines) {
    const wrapped = wrapText(line, 56);
    for (const w of wrapped) {
      if (formattedLines.length < 6) {
        formattedLines.push(w);
      }
    }
  }

  if (formattedLines.length === 0) {
    formattedLines.push('Informasi data real-time telah berhasil dihimpun dari database.');
  }

  const summaryRowsSvg = formattedLines.map((line, idx) => {
    const rowY = 56 + idx * 26;
    const isBullet = line.startsWith('•') || line.startsWith('-');
    const cleanText = isBullet ? line.replace(/^[•\-]\s*/, '') : line;

    if (isBullet) {
      return `
      <g>
        <circle cx="6" cy="${rowY - 4}" r="3" fill="${toneColor}" />
        <text x="18" y="${rowY}" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="#1f2937">${escapeXml(cleanText)}</text>
      </g>`;
    }

    return `<text x="2" y="${rowY}" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="#1f2937">${escapeXml(line)}</text>`;
  }).join('');

  return `<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="55%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f6f7fa" />
    </linearGradient>
    <linearGradient id="toplineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${deepColor}" />
      <stop offset="100%" stop-color="${toneColor}" />
    </linearGradient>
    <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d7232c" />
      <stop offset="100%" stop-color="#a8141c" />
    </linearGradient>
    <linearGradient id="pillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${toneColor}" />
      <stop offset="100%" stop-color="${deepColor}" />
    </linearGradient>
    <radialGradient id="orbTop" cx="100%" cy="0%" r="100%">
      <stop offset="0%" stop-color="${toneColor}" stop-opacity="0.20" />
      <stop offset="55%" stop-color="${toneColor}" stop-opacity="0.07" />
      <stop offset="100%" stop-color="${toneColor}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowBottom" cx="100%" cy="100%" r="100%">
      <stop offset="0%" stop-color="${toneColor}" stop-opacity="0.16" />
      <stop offset="68%" stop-color="${toneColor}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- BASE CARD -->
  <rect width="900" height="520" rx="18" fill="url(#cardBg)" stroke="#dde2ea" stroke-width="1" />
  <circle cx="820" cy="30" r="160" fill="url(#orbTop)" />
  <circle cx="850" cy="460" r="150" fill="url(#glowBottom)" />

  ${renderCardHeader('EASYLEGAL AI ASSISTANT', category, { pill: pillText, tone: toneColor, deep: deepColor })}

  <!-- BODY: QUERY & SENDER -->
  <g transform="translate(44, 102)">
    <text x="0" y="10" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#7c8596" letter-spacing="1.2">TOPIK / PERTANYAAN ADMIN</text>
    <text x="0" y="36" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#111827">"${escapeXml(truncatedQuery)}"</text>

    <g transform="translate(380, 18)">
      <g transform="translate(0, 2) scale(0.7)" stroke="#7c8596" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS.user}
      </g>
      <text x="18" y="14" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#4b5565">${escapeXml(senderName)} • ${escapeXml(timestampStr)}</text>
    </g>
  </g>

  <!-- BODY: SUMMARY PANEL -->
  <g transform="translate(44, 160)">
    <rect width="626" height="282" rx="14" fill="#f7f8fa" stroke="#e3e7ee" stroke-width="1" />

    <!-- Panel Header -->
    <g transform="translate(24, 22)">
      <g transform="translate(0, -1) scale(0.8)" stroke="${toneColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS.zap}
      </g>
      <text x="22" y="13" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="700" fill="${toneColor}" letter-spacing="1.1">RINGKASAN JAWABAN &amp; ANALISIS AI</text>
      <line x1="0" y1="26" x2="578" y2="26" stroke="#e3e7ee" stroke-width="1" />

      <!-- Text Lines / Bullet Points -->
      ${summaryRowsSvg}
    </g>
  </g>

  ${renderMascotStage(pose, bubbleText, toneColor)}

  ${renderCardFooter('AI Assistant Ready', 'EasyLegal Secure In-Memory Enclave', 'KLIK TOMBOL DI BAWAH UNTUK AKSI CEPAT')}
</svg>`;
}

/**
 * High-level wrapper to generate AI Assistant Response Card PNG
 */
export async function generateAiAssistantCardPng(data: AiAssistantCardInput): Promise<Buffer | null> {
  try {
    const svg = generateAiAssistantCardSvg(data);
    return await renderSvgToPng(svg, 900);
  } catch (err) {
    console.error('[CardGenerator] Failed to generate AI assistant card PNG:', err);
    return null;
  }
}
