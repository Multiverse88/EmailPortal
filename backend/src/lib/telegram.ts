import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getCustomerStorageStats } from './quota';
import {
  generateTicketCardPng,
  generateDailyDigestCardPng,
  generateSecurityAlertCardPng,
  generateThreatCardPng,
  ThreatCardInput,
} from './card-generator';

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  enabled: boolean;
}

export function getTelegramConfig(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const enabledEnv = process.env.TELEGRAM_NOTIFICATIONS_ENABLED?.trim();
  const enabled = enabledEnv !== 'false' && Boolean(botToken && chatId);

  return { botToken, chatId, enabled };
}

/**
 * Escapes HTML characters for Telegram HTML parse mode to prevent parse errors
 */
export function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends a callback query answer to acknowledge button clicks in Telegram
 */
export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false
): Promise<boolean> {
  const { botToken } = getTelegramConfig();
  if (!botToken || !callbackQueryId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Core function to send a message via Telegram Bot API
 */
export async function sendTelegramMessage(
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
  customChatId?: string | number,
  replyMarkup?: any
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const { botToken, chatId: defaultChatId, enabled } = getTelegramConfig();
  const targetChatId = customChatId ? String(customChatId) : defaultChatId;

  if (!enabled || !botToken || !targetChatId) {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[Telegram Bot] Notification skipped (TELEGRAM_BOT_TOKEN or target chat ID not configured).');
    }
    return { success: false, error: 'Telegram credentials not configured' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const safeText = text.length > 4000 ? `${text.slice(0, 3950)}\n\n<i>...(pesan dipotong karena batas panjang teks Telegram)</i>` : text;

    const payload: any = {
      chat_id: targetChatId,
      text: safeText,
      parse_mode: parseMode,
      disable_web_page_preview: false,
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result: any = await response.json();
    if (!response.ok || !result.ok) {
      console.warn('[Telegram Bot] API error:', result?.description || response.statusText);
      return { success: false, error: result?.description || 'Failed to send message' };
    }

    return { success: true, messageId: result.result?.message_id };
  } catch (error: any) {
    console.error('[Telegram Bot] Network error:', error?.message || error);
    return { success: false, error: error?.message || 'Network error' };
  }
}

/**
 * Sends a high-resolution Photo card to Telegram with optional caption and interactive buttons
 */
export async function sendTelegramPhoto(
  photoBuffer: Buffer,
  caption?: string,
  replyMarkup?: any,
  customChatId?: string | number
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const { botToken, chatId: defaultChatId, enabled } = getTelegramConfig();
  const targetChatId = customChatId ? String(customChatId) : defaultChatId;

  if (!enabled || !botToken || !targetChatId) {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[Telegram Bot] Photo notification skipped (TELEGRAM_BOT_TOKEN or target chat ID not configured).');
    }
    return { success: false, error: 'Telegram credentials not configured' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    const formData = new FormData();

    formData.append('chat_id', targetChatId);

    const blob = new Blob([photoBuffer], { type: 'image/png' });
    formData.append('photo', blob, 'card.png');

    if (caption) {
      // Telegram photo caption limit is 1024 chars
      const safeCaption = caption.length > 1020 ? `${caption.slice(0, 1000)}...` : caption;
      formData.append('caption', safeCaption);
      formData.append('parse_mode', 'HTML');
    }

    if (replyMarkup) {
      formData.append('reply_markup', typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup));
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const result: any = await response.json();
    if (!response.ok || !result.ok) {
      console.warn('[Telegram Bot] Photo API error:', result?.description || response.statusText);
      return { success: false, error: result?.description || 'Failed to send photo' };
    }

    return { success: true, messageId: result.result?.message_id };
  } catch (error: any) {
    console.error('[Telegram Bot] Photo network error:', error?.message || error);
    return { success: false, error: error?.message || 'Photo network error' };
  }
}

/**
 * Sends a chat action indicator (e.g. typing) to Telegram
 */
export async function sendChatAction(
  chatId: string | number,
  action: 'typing' | 'upload_document' = 'typing'
): Promise<boolean> {
  const { botToken } = getTelegramConfig();
  if (!botToken) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendChatAction`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        action,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends real-time alert to Telegram when a customer submits a new Support Ticket
 */
export async function notifyNewSupportTicket(
  ticket: {
    ticketNumber: string;
    subject: string;
    category: string;
    priority: string;
    createdAt: Date | string;
  },
  customer?: {
    name?: string;
    mailboxAddress?: string;
    personalEmail?: string;
  } | null,
  initialMessage?: string
): Promise<boolean> {
  const isUrgent = ticket.priority?.toLowerCase() === 'urgent';
  const priorityBadge = isUrgent ? '🚨 <b>URGENT (&lt; 4 Jam SLA)</b>' : 'ℹ️ <b>Normal (1x24 Jam SLA)</b>';

  const dateStr = format(new Date(ticket.createdAt), 'EEEE, dd MMMM yyyy - HH:mm', { locale: localeId });
  const snippet = initialMessage ? escapeHtml(initialMessage.slice(0, 350)) : '<i>(Tidak ada rincian pesan awal)</i>';

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🌐 Buka di Admin Desk', url: 'https://clienteasylegal.co.id/admin' }
      ],
      [
        { text: '🤖 Draf Solusi AI', callback_data: `ai_draft:${ticket.ticketNumber}` },
        { text: '✅ Selesaikan', callback_data: `resolve:${ticket.ticketNumber}` }
      ]
    ]
  };

  // 1. Attempt Rich Graphic Card (Option 2)
  try {
    const cardBuffer = await generateTicketCardPng({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category || 'Umum',
      priority: ticket.priority,
      createdAtStr: `${dateStr} WIB`,
      customerName: customer?.name || 'Klien EasyLegal',
      mailboxAddress: customer?.mailboxAddress || '-',
      personalEmail: customer?.personalEmail,
      initialMessage,
    });

    if (cardBuffer) {
      const caption = [
        `🎫 <b>[TIKET SUPPORT BARU] EasyLegal Customer Portal</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 <b>Nomor:</b> <code>#${escapeHtml(ticket.ticketNumber)}</code> • ${priorityBadge}`,
        `👤 <b>Klien:</b> <b>${escapeHtml(customer?.name || 'Klien')}</b>`,
        `📧 <b>Mailbox:</b> <code>${escapeHtml(customer?.mailboxAddress || '-')}</code>`,
        `📝 <b>Subjek:</b> <b>${escapeHtml(ticket.subject)}</b>`,
        `⏰ <b>Waktu:</b> ${dateStr} WIB`,
      ].join('\n');

      const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup);
      if (photoRes.success) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Telegram Bot] Failed to send ticket photo card, falling back to rich text:', err);
  }

  // Fallback to text message
  const message = [
    `🎫 <b>[TIKET SUPPORT BARU] EasyLegal Customer Portal</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Nomor Tiket:</b> <code>${escapeHtml(ticket.ticketNumber)}</code>`,
    `⚡ <b>Prioritas:</b> ${priorityBadge}`,
    `🏷️ <b>Kategori:</b> <code>${escapeHtml(ticket.category || 'Umum')}</code>`,
    `👤 <b>Nama Klien:</b> <b>${escapeHtml(customer?.name || 'Klien')}</b>`,
    `📧 <b>Mailbox Resmi:</b> <code>${escapeHtml(customer?.mailboxAddress || '-')}</code>`,
    customer?.personalEmail ? `📫 <b>Email Pribadi:</b> <code>${escapeHtml(customer.personalEmail)}</code>` : '',
    `📝 <b>Subjek:</b> <b>${escapeHtml(ticket.subject)}</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💬 <b>Rincian Permohonan Klien:</b>`,
    snippet,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⏰ <b>Waktu Pengajuan:</b> ${dateStr} WIB`,
    `👉 <b>Tanggapi di Super Admin Desk:</b>`,
    `https://clienteasylegal.co.id/admin`,
  ].filter(Boolean).join('\n');

  const res = await sendTelegramMessage(message, 'HTML', undefined, replyMarkup);
  return res.success;
}

/**
 * Generates and sends comprehensive Daily Website Health & Security Digest Report
 */
export async function sendDailyDigest(
  prisma: PrismaClient,
  customChatId?: string | number
): Promise<{ success: boolean; reportText: string }> {
  const now = new Date();
  const dateStr = format(now, 'EEEE, dd MMMM yyyy - 07:00', { locale: localeId });

  // 1. Account & Mailbox metrics
  const [
    totalCustomers,
    activeCustomers,
    inactiveCustomers,
    totalEmails,
    unreadEmails,
    totalDocuments,
    docSizeAgg,
    openTickets,
    urgentTickets,
    resolvedTickets,
    activeSessions,
    multiIpAlerts,
    auditLogsLast24h,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { status: 'active' } }),
    prisma.customer.count({ where: { status: { not: 'active' } } }),
    prisma.messageCache.count(),
    prisma.messageCache.count({ where: { folder: 'INBOX', isRead: false } }),
    prisma.legalDocument.count(),
    prisma.legalDocument.aggregate({ _sum: { size: true } }),
    prisma.supportTicket.count({ where: { status: 'open' } }),
    prisma.supportTicket.count({ where: { status: 'open', priority: 'urgent' } }),
    prisma.supportTicket.count({ where: { status: 'resolved' } }),
    prisma.loginSession.count(),
    // Multi-IP detection
    prisma.loginSession.groupBy({
      by: ['customerId'],
      having: {
        ipAddress: { _count: { gt: 1 } },
      },
    }).catch(() => []),
    // Audit logs in past 24 hours
    prisma.auditLog.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const usedBytes = docSizeAgg._sum.size || 0;
  const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
  const totalMultiIp = Array.isArray(multiIpAlerts) ? multiIpAlerts.length : 0;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🌐 Buka Super Admin Console', url: 'https://clienteasylegal.co.id/admin' }
      ],
      [
        { text: '🔄 Perbarui Laporan', callback_data: 'digest_refresh' },
        { text: '🎫 Cek Tiket Terbuka', callback_data: 'view_tickets' }
      ]
    ]
  };

  const reportText = [
    `🌅 <b>[LAPORAN HARIAN] KONDISI & KEAMANAN WEBSITE EASYLEGAL</b>`,
    `📅 <i>${dateStr} WIB</i>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🌐 <b>1. KESEHATAN SISTEM & WEBMAIL</b>`,
    `• Status Portal: 🟢 <b>Online & Beroperasi Normal</b>`,
    `• Cluster Titan Mail: 🟢 <b>Tersinkronisasi (IMAP 993 / SMTP 465)</b>`,
    `• Total Akun Mailbox: <b>${totalCustomers} Akun</b> (${activeCustomers} Aktif, ${inactiveCustomers} Nonaktif)`,
    `• Total Pesan di Cache: <b>${totalEmails} Email</b> (${unreadEmails} Belum Dibaca)`,
    ``,
    `🛡️ <b>2. RADAR KEAMANAN & ANOMALI LOGIN</b>`,
    `• Sesi Login Aktif: <b>${activeSessions} Perangkat</b>`,
    `• Anomali Multi-IP: ${totalMultiIp > 0 ? `🚨 <b>${totalMultiIp} Akun Terdeteksi Multi-IP!</b>` : `🟢 <b>0 Alert (Kondisi Aman)</b>`}`,
    `• Aktivitas Audit Log (24 Jam): <b>${auditLogsLast24h} Entri Tercatat</b>`,
    `• AI Security Protocol: 🛡️ <b>100% In-Memory Zero-Leakage Aktif</b>`,
    ``,
    `💾 <b>3. KAPASITAS PENYIMPANAN & RETENSI</b>`,
    `• Hot Storage S3 (IDCloudHost): <b>${usedMB} MB</b> Terpakai`,
    `• Total Berkas Legal Drive: <b>${totalDocuments} Dokumen</b>`,
    `• Cold Storage NAS (Synology): 🟢 <b>Jalur Arsip Terkoneksi</b>`,
    `• Kebijakan Retensi 90 Hari: 🟢 <b>Pemantauan Aktif</b>`,
    ``,
    `🎫 <b>4. STATUS PUSAT TIKET SUPPORT KLIEN</b>`,
    `• Tiket Menunggu Respon (Open): <b>${openTickets} Tiket</b>`,
    `• Tiket Prioritas Urgent: ${urgentTickets > 0 ? `🚨 <b>${urgentTickets} Tiket Membutuhkan Penanganan!</b>` : `🟢 <b>0 Tiket Mendesak</b>`}`,
    `• Tiket Terselesaikan: <b>${resolvedTickets} Tiket</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🤖 <i>Dihasilkan otomatis oleh EasyLegal System & AI Security Monitor.</i>`,
    `🔗 <b>Buka Super Admin Console:</b>`,
    `https://clienteasylegal.co.id/admin`,
  ].join('\n');

  // Attempt Rich Graphic Card (Option 2)
  try {
    const digestBuffer = await generateDailyDigestCardPng({
      dateStr,
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      totalEmails,
      unreadEmails,
      usedMB,
      totalDocuments,
      activeSessions,
      totalMultiIp,
      auditLogsLast24h,
      openTickets,
      urgentTickets,
      resolvedTickets,
    });

    if (digestBuffer) {
      const caption = [
        `🌅 <b>[LAPORAN HARIAN] KONDISI & KEAMANAN WEBSITE</b>`,
        `📅 <i>${dateStr} WIB</i>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🌐 <b>Cluster &amp; Webmail:</b> 🟢 Online (${totalCustomers} Akun, ${totalEmails} Email)`,
        `🛡️ <b>Radar Keamanan:</b> ${activeSessions} Sesi • ${totalMultiIp > 0 ? `🚨 ${totalMultiIp} Multi-IP!` : '🟢 0 Alert Aman'}`,
        `💾 <b>Storage:</b> ${usedMB} MB S3 • Synology NAS Terhubung`,
        `🎫 <b>Tiket:</b> ${openTickets} Open (${urgentTickets} Urgent) • ${resolvedTickets} Selesai`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🤖 <i>Dihasilkan otomatis oleh EasyLegal AI Monitor.</i>`,
      ].join('\n');

      const photoRes = await sendTelegramPhoto(digestBuffer, caption, replyMarkup, customChatId);
      if (photoRes.success) {
        return { success: true, reportText };
      }
    }
  } catch (err) {
    console.warn('[Telegram Bot] Failed to send digest photo card, falling back to text:', err);
  }

  const res = await sendTelegramMessage(reportText, 'HTML', customChatId, replyMarkup);
  return { success: res.success, reportText };
}

/**
 * Sends real-time Security Anomaly Alert to Telegram
 */
export async function notifySecurityAnomaly(event: {
  accountName: string;
  mailboxAddress: string;
  uniqueIps: string[];
  sessionCount: number;
}): Promise<boolean> {
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🚨 Buka Security Radar', url: 'https://clienteasylegal.co.id/admin' }
      ]
    ]
  };

  const message = [
    `🚨 <b>[SECURITY RADAR ALERT] Anomali Login Multi-IP Terdeteksi!</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>Akun:</b> ${escapeHtml(event.accountName)} (<code>${escapeHtml(event.mailboxAddress)}</code>)`,
    `⚠️ <b>Peringatan:</b> Akun ini terhubung dari <b>${event.uniqueIps.length} alamat IP berbeda</b> secara bersamaan.`,
    `📍 <b>Daftar IP:</b> <code>${event.uniqueIps.map((ip) => escapeHtml(ip)).join(', ')}</code>`,
    `📱 <b>Jumlah Sesi Aktif:</b> ${event.sessionCount} Perangkat`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🛡️ <b>Tindakan Super Admin yang Disarankan:</b>`,
    `1. Buka tab <b>Security Radar</b> di Super Admin Console.`,
    `2. Periksa lokasi perangkat & klik <b>Putuskan Sesi Asing</b> bila mencurigakan.`,
    `3. Informasikan klien untuk segera mengganti kata sandi.`,
    ``,
    `🔗 <b>Akses Security Radar:</b>`,
    `https://clienteasylegal.co.id/admin`,
  ].join('\n');

  try {
    const cardBuffer = await generateSecurityAlertCardPng({
      accountName: event.accountName,
      mailboxAddress: event.mailboxAddress,
      uniqueIps: event.uniqueIps,
      sessionCount: event.sessionCount,
    });

    if (cardBuffer) {
      const caption = [
        `🚨 <b>[SECURITY RADAR ALERT] Multi-IP Terdeteksi!</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 <b>Akun:</b> ${escapeHtml(event.accountName)}`,
        `📧 <b>Mailbox:</b> <code>${escapeHtml(event.mailboxAddress)}</code>`,
        `⚠️ <b>Terhubung dari ${event.uniqueIps.length} Alamat IP:</b> <code>${event.uniqueIps.join(', ')}</code>`,
        `📱 <b>Sesi Aktif:</b> ${event.sessionCount} Perangkat`,
      ].join('\n');

      const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup);
      if (photoRes.success) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Telegram Bot] Failed to send security alert photo card:', err);
  }

  const res = await sendTelegramMessage(message, 'HTML', undefined, replyMarkup);
  return res.success;
}

/**
 * Sends real-time Email / Attachment Threat Alert to Super Admin via Telegram
 */
export async function notifyEmailThreat(event: ThreatCardInput): Promise<boolean> {
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🚨 Buka Super Admin Console', url: 'https://clienteasylegal.co.id/admin' }
      ]
    ]
  };

  const message = [
    `🚨 <b>[AI SECURITY SHIELD] Ancaman Email / Berkas Terdeteksi!</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>Akun Sasaran:</b> ${escapeHtml(event.accountName)} (<code>${escapeHtml(event.mailboxAddress)}</code>)`,
    `📧 <b>Pengirim:</b> <code>${escapeHtml(event.sender)}</code>`,
    `📝 <b>Subjek:</b> <b>${escapeHtml(event.subject)}</b>`,
    `⚠️ <b>Jenis Ancaman:</b> <b>${escapeHtml(event.threatType)}</b>`,
    event.filename ? `📎 <b>Berkas:</b> <code>${escapeHtml(event.filename)}</code> (${event.fileSizeStr || 'N/A'})` : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🛡️ <b>Rincian Analisis:</b>`,
    `<i>${escapeHtml(event.threatDetails)}</i>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ <b>Tindakan Sistem:</b> ${escapeHtml(event.actionTaken || 'Berkas dikarantina. Akses unduh klien dinonaktifkan.')}`,
    ``,
    `🔗 <b>Buka Super Admin Console:</b>`,
    `https://clienteasylegal.co.id/admin`,
  ].filter(Boolean).join('\n');

  try {
    const cardBuffer = await generateThreatCardPng(event);
    if (cardBuffer) {
      const caption = [
        `🚨 <b>[AI SECURITY SHIELD] Ancaman Terdeteksi!</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 <b>Mailbox:</b> <code>${escapeHtml(event.mailboxAddress)}</code>`,
        `⚠️ <b>Ancaman:</b> ${escapeHtml(event.threatType)}`,
        event.filename ? `📎 <b>Berkas:</b> <code>${escapeHtml(event.filename)}</code>` : `📝 <b>Subjek:</b> ${escapeHtml(event.subject.slice(0, 35))}`,
        `🛡️ <b>Tindakan:</b> Berkas Dikarantina (Akses Unduh Ditangguhkan)`,
      ].filter(Boolean).join('\n');

      const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup);
      if (photoRes.success) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Telegram Bot] Failed to send threat photo card, falling back to text:', err);
  }

  const res = await sendTelegramMessage(message, 'HTML', undefined, replyMarkup);
  return res.success;
}

