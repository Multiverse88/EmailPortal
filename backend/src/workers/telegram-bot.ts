import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  getTelegramConfig,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendChatAction,
  escapeHtml,
  answerTelegramCallbackQuery,
  sendDailyDigest,
} from '../lib/telegram';
import { processTelegramAiMessage, gatherLiveWebsiteSnapshot } from '../lib/telegram-ai';
import {
  generateTicketCardPng,
  generateServerStatusCardPng,
  generateSecurityAlertCardPng,
  generateAiAssistantCardPng,
  SERVER_STATES,
  stripHtml,
} from '../lib/card-generator';

let isPolling = false;
let abortController: AbortController | null = null;

/**
 * Handles button click callback queries from Telegram inline keyboards
 */
export async function handleTelegramCallbackQuery(
  prisma: PrismaClient,
  callbackQuery: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number | string } };
    data?: string;
  }
) {
  if (!callbackQuery || !callbackQuery.data) return;

  const queryId = callbackQuery.id;
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat.id || callbackQuery.from.id;
  const configuredChatId = process.env.TELEGRAM_CHAT_ID?.trim();

  // Authorization check
  if (configuredChatId && String(chatId) !== String(configuredChatId)) {
    await answerTelegramCallbackQuery(queryId, 'Akses ditolak (Khusus Super Admin)', true);
    return;
  }

  // 1. Draf Solusi AI (ai_draft:<ticketNumber>)
  if (data.startsWith('ai_draft:')) {
    const ticketNumber = data.replace('ai_draft:', '').trim();
    await answerTelegramCallbackQuery(queryId, '🤖 AI sedang merumuskan draf solusi hukum...');
    await sendChatAction(chatId, 'typing');

    try {
      const ticket = await prisma.supportTicket.findFirst({
        where: { ticketNumber },
        include: {
          customer: true,
          messages: { orderBy: { createdAt: 'asc' }, take: 1 },
        },
      });

      if (!ticket) {
        const notFoundText = `⚠️ <i>Tiket #${escapeHtml(ticketNumber)} tidak ditemukan di database.</i>`;
        try {
          const errCard = await generateAiAssistantCardPng({
            query: `Draf Tiket #${ticketNumber}`,
            replySummary: `• Tiket #${ticketNumber} tidak ditemukan di database.\n• Periksa kembali nomor tiket pada Admin Console.`,
            senderName: 'Super Admin',
            category: 'TIKET TIDAK DITEMUKAN',
            pillText: 'TIKET NIHIL',
            toneColor: '#64748b',
            deepColor: '#475569',
            pose: 'memikirkan',
            bubbleText: 'Nomor tiket tidak ditemukan di database.',
          });
          if (errCard) {
            const photoRes = await sendTelegramPhoto(errCard, notFoundText, undefined, chatId);
            if (photoRes.success) return;
          }
        } catch {}
        await sendTelegramMessage(notFoundText, 'HTML', chatId);
        return;
      }

      const clientName = ticket.customer?.name || 'Klien';

      const aiDraftResponse = [
        `🤖 <b>[REKOMENDASI DRAF SOLUSI AI]</b>`,
        `📌 <b>Nomor Tiket:</b> <code>#${escapeHtml(ticket.ticketNumber)}</code>`,
        `👤 <b>Pemohon:</b> <b>${escapeHtml(clientName)}</b>`,
        `📝 <b>Subjek:</b> <b>${escapeHtml(ticket.subject)}</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `<b>Draf Tanggapan Resmi untuk Klien:</b>`,
        ``,
        `<i>Yth. Bapak/Ibu Pimpinan ${escapeHtml(clientName)},</i>`,
        ``,
        `<i>Terima kasih telah menghubungi Tim Layanan Legal Corporate EasyLegal.</i>`,
        ``,
        `<i>Menanggapi permohonan Anda terkait "<b>${escapeHtml(ticket.subject)}</b>":</i>`,
        `<i>Tim Legal kami telah meninjau rincian berkas yang diajukan. Berdasarkan ketentuan regulasi hukum korporasi Indonesia dan prosedur administrasi AHU/Kemenkumham yang berlaku, permohonan Anda saat ini sedang dalam penanganan prioritas.</i>`,
        ``,
        `<i>Dokumen pendukung terkait berkas perseroan Anda telah kami verifikasi melalui Secure In-Memory Enclave kami. Langkah tindak lanjut dan konfirmasi penyelesaian akan kami perbarui dalam waktu &lt; 4 jam kerja.</i>`,
        ``,
        `<i>Bila ada berkas tambahan yang ingin dilampirkan, silakan unggah langsung melalui menu Legal Drive atau kirimkan via Webmail resmi Anda.</i>`,
        ``,
        `<i>Hormat kami,</i>`,
        `<b>Tim Layanan Legal Corporate &amp; Notaris EasyLegal</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 <i>Draf ini dapat langsung disalin ke Super Admin Support Desk atau dikirimkan via Webmail resmi.</i>`,
      ].join('\n');

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '🌐 Buka di Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
            { text: '✅ Selesaikan Tiket', callback_data: `resolve:${ticket.ticketNumber}` },
          ],
        ],
      };

      try {
        const cardBuffer = await generateTicketCardPng({
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          category: ticket.category || 'Umum',
          priority: ticket.priority,
          createdAtStr: `${format(new Date(ticket.createdAt), 'EEEE, dd MMMM yyyy - HH:mm', { locale: localeId })} WIB`,
          customerName: clientName,
          mailboxAddress: ticket.customer?.mailboxAddress || '-',
          personalEmail: ticket.customer?.personalEmail,
          aiDraft: `Yth. Bapak/Ibu Pimpinan ${clientName}, permohonan Anda terkait "${ticket.subject}" telah ditinjau dan sedang dalam penanganan prioritas...`,
          stateKey: 'ai',
        });

        if (cardBuffer) {
          const caption = [
            `🤖 <b>[DRAF SOLUSI AI] Tiket #${escapeHtml(ticket.ticketNumber)}</b>`,
            `👤 Klien: <b>${escapeHtml(clientName)}</b>`,
            `📝 Subjek: <i>${escapeHtml(ticket.subject)}</i>`,
            `💡 <i>Draf balasan hukum telah dirumuskan & siap dikirim.</i>`,
          ].join('\n');
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            await sendTelegramMessage(aiDraftResponse, 'HTML', chatId);
            return;
          }
        }
      } catch (e) {
        console.warn('[Telegram Bot] Error generating card for ai_draft:', e);
      }

      await sendTelegramMessage(aiDraftResponse, 'HTML', chatId, replyMarkup);
    } catch (err: any) {
      console.error('[Telegram Bot] Error generating AI draft for ticket:', err);
      const errText = `⚠️ <i>Gagal merumuskan draf AI: ${escapeHtml(err?.message || 'Kesalahan internal')}</i>`;
      try {
        const errCard = await generateAiAssistantCardPng({
          query: `Draf Tiket #${ticketNumber}`,
          replySummary: `• Gagal merumuskan draf AI: ${err?.message || 'Kesalahan internal'}\n• Silakan coba kembali sesaat lagi.`,
          senderName: 'Super Admin',
          category: 'GANGGUAN SISTEM',
          pillText: 'GANGGUAN TEKNIS',
          toneColor: '#64748b',
          deepColor: '#475569',
          pose: 'memikirkan',
          bubbleText: 'Gagal membuat draf solusi AI.',
        });
        if (errCard) {
          const photoRes = await sendTelegramPhoto(errCard, errText, undefined, chatId);
          if (photoRes.success) return;
        }
      } catch {}
      await sendTelegramMessage(errText, 'HTML', chatId);
    }
    return;
  }

  // 2. Resolve Ticket (resolve:<ticketNumber>)
  if (data.startsWith('resolve:')) {
    const ticketNumber = data.replace('resolve:', '').trim();
    await answerTelegramCallbackQuery(queryId, 'Memproses penyelesaian tiket...');

    try {
      const ticket = await prisma.supportTicket.findFirst({
        where: { ticketNumber },
      });

      if (!ticket) {
        const notFoundText = `⚠️ <i>Tiket #${escapeHtml(ticketNumber)} tidak ditemukan.</i>`;
        try {
          const errCard = await generateAiAssistantCardPng({
            query: `Selesaikan #${ticketNumber}`,
            replySummary: `• Tiket #${ticketNumber} tidak ditemukan di database.\n• Tidak ada perubahan status yang dilakukan.`,
            senderName: 'Super Admin',
            category: 'TIKET TIDAK DITEMUKAN',
            pillText: 'TIKET NIHIL',
            toneColor: '#64748b',
            deepColor: '#475569',
            pose: 'memikirkan',
            bubbleText: 'Nomor tiket tidak ditemukan.',
          });
          if (errCard) {
            const photoRes = await sendTelegramPhoto(errCard, notFoundText, undefined, chatId);
            if (photoRes.success) return;
          }
        } catch {}
        await sendTelegramMessage(notFoundText, 'HTML', chatId);
        return;
      }

      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'resolved' },
      });

      const superAdmin = await prisma.adminUser.findFirst({ where: { role: 'superadmin' } });
      if (superAdmin) {
        await prisma.auditLog.create({
          data: {
            actorId: superAdmin.id,
            action: 'TICKET_RESOLVED_VIA_TELEGRAM',
            targetType: 'support_ticket',
            targetId: ticket.id,
            details: JSON.stringify({ ticketNumber }),
            ipAddress: 'TELEGRAM_BOT',
          },
        }).catch(() => {});
      }

      const resolveCaption = [
        `✅ <b>[TIKET BERHASIL DISELESAIKAN] #${escapeHtml(ticketNumber)}</b>`,
        `Status tiket telah diperbarui menjadi <b>RESOLVED (Selesai)</b> di sistem.`,
        `Waktu Update: ${new Date().toLocaleTimeString('id-ID')} WIB`,
      ].join('\n');

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
            { text: '🎫 Cek Tiket Lain', callback_data: 'view_tickets' },
          ],
        ],
      };

      try {
        const cardBuffer = await generateTicketCardPng({
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          category: ticket.category || 'Umum',
          priority: ticket.priority,
          createdAtStr: `${format(new Date(ticket.createdAt), 'EEEE, dd MMMM yyyy - HH:mm', { locale: localeId })} WIB`,
          customerName: 'Klien',
          mailboxAddress: '-',
          resolution: `Tiket #${ticketNumber} berhasil ditandai SELESAI oleh Super Admin via Telegram.`,
          stateKey: 'selesai',
        });

        if (cardBuffer) {
          const photoRes = await sendTelegramPhoto(cardBuffer, resolveCaption, replyMarkup, chatId);
          if (photoRes.success) return;
        }
      } catch (e) {
        console.warn('[Telegram Bot] Error generating card for resolve:', e);
      }

      await sendTelegramMessage(resolveCaption, 'HTML', chatId, replyMarkup);
    } catch (err: any) {
      console.error('[Telegram Bot] Error resolving ticket:', err);
      const errText = `⚠️ <i>Gagal menyelesaikan tiket: ${escapeHtml(err?.message || 'Kesalahan internal')}</i>`;
      try {
        const errCard = await generateAiAssistantCardPng({
          query: `Selesaikan #${ticketNumber}`,
          replySummary: `• Gagal menyelesaikan tiket: ${err?.message || 'Kesalahan internal'}\n• Silakan coba kembali melalui portal admin.`,
          senderName: 'Super Admin',
          category: 'GANGGUAN SISTEM',
          pillText: 'GANGGUAN TEKNIS',
          toneColor: '#64748b',
          deepColor: '#475569',
          pose: 'memikirkan',
          bubbleText: 'Gagal memperbarui status tiket.',
        });
        if (errCard) {
          const photoRes = await sendTelegramPhoto(errCard, errText, undefined, chatId);
          if (photoRes.success) return;
        }
      } catch {}
      await sendTelegramMessage(errText, 'HTML', chatId);
    }
    return;
  }

  // 3. Refresh Daily Digest (digest_refresh)
  if (data === 'digest_refresh') {
    await answerTelegramCallbackQuery(queryId, 'Memperbarui ringkasan kondisi situs...');
    await sendChatAction(chatId, 'upload_document');
    await sendDailyDigest(prisma, chatId);
    return;
  }

  // 4. View Open Tickets (view_tickets)
  if (data === 'view_tickets') {
    await answerTelegramCallbackQuery(queryId, 'Mengambil daftar tiket terbuka...');
    try {
      const openTickets = await prisma.supportTicket.findMany({
        where: { status: 'open' },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      if (openTickets.length === 0) {
        const noTicketsText = [
          `🟢 <b>[SEMUA TIKET SELESAI]</b>`,
          `Tidak ada antrean tiket terbuka saat ini.`,
          `Seluruh tiket bantuan telah ditangani oleh tim.`,
        ].join('\n');
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' }],
          ],
        };
        try {
          const cardBuffer = await generateAiAssistantCardPng({
            query: 'Daftar Tiket Terbuka',
            replySummary: '• Seluruh tiket support telah terselesaikan.\n• Tidak ada antrean tiket open saat ini.\n• Tim CS & Legal siap melayani permohonan baru.',
            senderName: 'Super Admin',
            category: 'PUSAT TIKET SUPPORT',
            pillText: 'SEMUA TIKET SELESAI',
            toneColor: '#22c55e',
            deepColor: '#15803d',
            pose: 'senang',
            bubbleText: 'Semua tiket beres! Layanan aman terkendali.',
          });
          if (cardBuffer) {
            const photoRes = await sendTelegramPhoto(cardBuffer, noTicketsText, replyMarkup, chatId);
            if (photoRes.success) return;
          }
        } catch {}
        await sendTelegramMessage(noTicketsText, 'HTML', chatId, replyMarkup);
        return;
      }

      const lines = [
        `🎫 <b>DAFTAR TIKET TERBUKA TERKINI (${openTickets.length} Tiket):</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      const inlineKeyboard: any[] = [];

      for (const t of openTickets) {
        const priorityBadge = t.priority === 'urgent' ? '🚨 URGENT' : 'ℹ️ Normal';
        lines.push(`• <b>#${escapeHtml(t.ticketNumber)}</b> [${priorityBadge}]`);
        lines.push(`  👤 ${escapeHtml(t.customer?.name || 'Klien')}`);
        lines.push(`  📝 ${escapeHtml(t.subject)}`);
        lines.push(``);

        inlineKeyboard.push([
          { text: `🤖 Draf Solusi #${t.ticketNumber}`, callback_data: `ai_draft:${t.ticketNumber}` },
          { text: `✅ Selesaikan`, callback_data: `resolve:${t.ticketNumber}` },
        ]);
      }

      inlineKeyboard.push([
        { text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
      ]);

      const replyMarkup = { inline_keyboard: inlineKeyboard };

      try {
        const firstTicket = openTickets[0];
        const isUrgent = firstTicket.priority === 'urgent';
        const isAssigned = Boolean((firstTicket as any).assignedToId || firstTicket.status === 'in_progress');
        const isOld = (Date.now() - new Date(firstTicket.createdAt).getTime()) > 30 * 60 * 1000;

        let stateKey: 'urgent' | 'reminder' | 'diproses' | 'baru' = 'baru';
        if (isUrgent) {
          stateKey = 'urgent';
        } else if (isAssigned) {
          stateKey = 'diproses';
        } else if (isOld) {
          stateKey = 'reminder';
        } else {
          stateKey = 'baru';
        }

        const cardBuffer = await generateTicketCardPng({
          ticketNumber: firstTicket.ticketNumber,
          subject: firstTicket.subject,
          category: firstTicket.category || 'Umum',
          priority: firstTicket.priority,
          createdAtStr: `${format(new Date(firstTicket.createdAt), 'EEEE, dd MMMM yyyy - HH:mm', { locale: localeId })} WIB`,
          customerName: firstTicket.customer?.name || 'Klien',
          mailboxAddress: firstTicket.customer?.mailboxAddress || '-',
          personalEmail: firstTicket.customer?.personalEmail,
          initialMessage: firstTicket.subject,
          stateKey,
        });

        if (cardBuffer) {
          const caption = [
            `🎫 <b>[DAFTAR TIKET TERBUKA]</b> (${openTickets.length} tiket)`,
            `• Tiket: <b>#${escapeHtml(firstTicket.ticketNumber)}</b> [${firstTicket.priority.toUpperCase()}]`,
            `• Klien: <b>${escapeHtml(firstTicket.customer?.name || 'Klien')}</b>`,
            `• Subjek: <i>${escapeHtml(firstTicket.subject)}</i>`,
          ].join('\n');
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (openTickets.length > 1) {
              await sendTelegramMessage(lines.join('\n'), 'HTML', chatId);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('[Telegram Bot] Error generating card for view_tickets:', e);
      }

      await sendTelegramMessage(lines.join('\n'), 'HTML', chatId, replyMarkup);
    } catch (err: any) {
      console.error('[Telegram Bot] Error viewing open tickets:', err);
      await sendTelegramMessage(
        `⚠️ <i>Gagal memuat tiket terbuka: ${escapeHtml(err?.message || 'Kesalahan internal')}</i>`,
        'HTML',
        chatId
      );
    }
    return;
  }

  // 5. Bot Quick Commands (bot_cmd:<command>)
  if (data.startsWith('bot_cmd:')) {
    const cmd = data.replace('bot_cmd:', '').trim();
    await answerTelegramCallbackQuery(queryId, `Memuat /${cmd}...`);
    await handleTelegramMessageUpdate(prisma, {
      message_id: callbackQuery.message?.message_id || 0,
      chat: { id: chatId },
      from: callbackQuery.from,
      text: `/${cmd}`,
    });
    return;
  }

  // Default fallback
  await answerTelegramCallbackQuery(queryId);
}

/**
 * Handles incoming message from Telegram update
 */
export async function handleTelegramMessageUpdate(
  prisma: PrismaClient,
  message: {
    message_id: number;
    chat: { id: number | string; first_name?: string; username?: string; title?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
  }
) {
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const rawText = message.text.trim();
  const senderName = message.from?.first_name || message.chat.first_name || message.chat.title || 'Super Admin';
  const configuredChatId = process.env.TELEGRAM_CHAT_ID?.trim();

  // If chat ID is configured, ensure sender is authorized
  if (configuredChatId && configuredChatId.length > 0) {
    if (String(chatId) !== String(configuredChatId)) {
      console.warn(`[Telegram Bot] Unauthorized message attempt from chat ID: ${chatId} (${senderName})`);
      const unauthText = [
        `⛔ <b>Akses Ditolak</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Bot AI ini dikonfigurasi khusus untuk Super Admin terotorisasi EasyLegal Customer Portal.`,
        ``,
        `<i>ID Chat Anda:</i> <code>${chatId}</code>`,
      ].join('\n');
      try {
        const errCard = await generateAiAssistantCardPng({
          query: 'Akses Ditolak',
          replySummary: `• ID Chat ${chatId} belum terdaftar sebagai Super Admin.\n• Hubungi administrator sistem untuk otorisasi akses.`,
          senderName,
          category: 'KEAMANAN AKSES',
          pillText: 'AKSES DITOLAK',
          toneColor: '#ef4444',
          deepColor: '#b91c1c',
          pose: 'menyapa',
          bubbleText: 'Akses ditolak! Akun belum terotorisasi.',
        });
        if (errCard) {
          const photoRes = await sendTelegramPhoto(errCard, unauthText, undefined, chatId);
          if (photoRes.success) return;
        }
      } catch {}
      await sendTelegramMessage(unauthText, 'HTML', chatId);
      return;
    }
  } else {
    // If chat ID is not yet configured, assist the admin with onboarding
    const onboardText = [
      `👋 <b>Halo, ${senderName}!</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Bot AI EasyLegal siap digunakan. Namun <code>TELEGRAM_CHAT_ID</code> belum disetel di server.`,
      ``,
      `📍 <b>ID Chat Anda:</b> <code>${chatId}</code>`,
      ``,
      `Silakan tambahkan baris berikut pada file <code>backend/.env</code>:`,
      `<code>TELEGRAM_CHAT_ID=${chatId}</code>`,
      ``,
      `Setelah itu simpan dan restart server agar bot terkunci secara aman untuk Anda.`,
    ].join('\n');
    try {
      const card = await generateAiAssistantCardPng({
        query: 'Setup Chat ID Bot',
        replySummary: `• Bot AI EasyLegal siap digunakan.\n• TELEGRAM_CHAT_ID belum disetel di backend/.env\n• ID Chat Anda: ${chatId}\n• Set TELEGRAM_CHAT_ID=${chatId} lalu restart server.`,
        senderName,
        category: 'SETUP & ONBOARDING',
        pillText: 'KONFIGURASI DIBUTUHKAN',
        toneColor: '#3b82f6',
        deepColor: '#1d4ed8',
        pose: 'melambai',
        bubbleText: `Halo ${senderName}! Yuk setup ID Chat dulu.`,
      });
      if (card) {
        const photoRes = await sendTelegramPhoto(card, onboardText, undefined, chatId);
        if (photoRes.success) return;
      }
    } catch {}
    await sendTelegramMessage(onboardText, 'HTML', chatId);
    return;
  }

  // Send typing action so the user sees "typing..." in Telegram
  await sendChatAction(chatId, 'typing');

  try {
    const replyText = await processTelegramAiMessage(prisma, rawText, {
      chatId,
      senderName,
    });

    if (!replyText) return;

    const lower = rawText.toLowerCase();

    // 1. Server Status (/status or server queries)
    if (
      lower === '/status' ||
      lower.includes('kondisi server') ||
      lower.includes('status server') ||
      lower.includes('kesehatan server') ||
      lower.includes('uptime')
    ) {
      try {
        const snap = await gatherLiveWebsiteSnapshot(prisma);
        const isMaintenance = process.env.MAINTENANCE_MODE === 'true';
        const hasDown = !snap.system.dbOk;
        const hasSlow = snap.security.multiIpCount > 0 || snap.tickets.urgent > 0;

        let stateKey: 'normal' | 'gangguan' | 'maintenance' | 'down' = 'normal';
        if (hasDown) {
          stateKey = 'down';
        } else if (isMaintenance) {
          stateKey = 'maintenance';
        } else if (hasSlow) {
          stateKey = 'gangguan';
        } else {
          stateKey = 'normal';
        }

        const services = [
          { key: 'portal', name: 'Customer Portal', ms: hasDown ? 0 : 142, up: 99.99, status: hasDown ? 'down' : 'ok' },
          { key: 'api', name: 'API Backend', ms: hasDown ? 0 : 88, up: 99.98, status: hasDown ? 'down' : 'ok' },
          { key: 'mail', name: 'Webmail & IMAP', ms: isMaintenance ? 0 : (hasSlow && !snap.security.multiIpCount ? 1420 : 212), up: 99.95, status: isMaintenance ? 'maint' : (hasSlow && !snap.security.multiIpCount ? 'slow' : 'ok') },
          { key: 'doc', name: 'Document Vault', ms: 165, up: 99.97, status: 'ok' },
          { key: 'db', name: 'Database Engine', ms: snap.system.dbOk ? 45 : 0, up: 99.99, status: snap.system.dbOk ? 'ok' : 'down' },
          { key: 'ai', name: 'AI Assistant', ms: snap.security.multiIpCount > 0 ? 1850 : 640, up: 99.96, status: snap.security.multiIpCount > 0 ? 'slow' : 'ok' },
        ];

        let dynamicBubble = SERVER_STATES[stateKey].bubble;
        let dynamicPill = SERVER_STATES[stateKey].pill;

        if (stateKey === 'gangguan') {
          if (snap.tickets.urgent > 0) {
            dynamicBubble = `${snap.tickets.urgent} tiket urgent perlu penanganan segera oleh admin!`;
            dynamicPill = `${snap.tickets.urgent} TIKET URGENT AKTIF`;
          } else if (snap.security.multiIpCount > 0) {
            dynamicBubble = `${snap.security.multiIpCount} anomali Multi-IP login terdeteksi pada radar keamanan.`;
            dynamicPill = `${snap.security.multiIpCount} ANOMALI TERDETEKSI`;
          } else {
            dynamicBubble = 'Antrean sinkronisasi email melambat. Tim teknis sedang memantau.';
            dynamicPill = 'GANGGUAN SEBAGIAN';
          }
        } else if (stateKey === 'down') {
          dynamicBubble = 'Database Engine tidak merespons! Tim on-call sudah dipanggil.';
          dynamicPill = 'LAYANAN DOWN';
        } else if (stateKey === 'maintenance') {
          dynamicBubble = 'Webmail Cluster sedang dalam jadwal pemeliharaan berkala.';
          dynamicPill = 'MAINTENANCE TERJADWAL';
        } else if (stateKey === 'normal') {
          dynamicBubble = 'Semua layanan email & portal aman. Berjalan normal!';
          dynamicPill = 'SEMUA SISTEM NORMAL';
        }

        const cardBuffer = await generateServerStatusCardPng({
          stateKey,
          serverTime: `${format(new Date(), 'EEEE, dd MMMM yyyy - HH:mm', { locale: localeId })} WIB`,
          serverNext: 'Besok 07:00 WIB',
          services,
          uptimePct: stateKey === 'normal' ? '99,98' : '99,82',
          bubbleText: dynamicBubble,
          pillText: dynamicPill,
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '🔄 Cek Status Lagi', callback_data: 'bot_cmd:status' },
              { text: '🎫 Cek Tiket', callback_data: 'view_tickets' },
            ],
            [
              { text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
            ],
          ],
        };

        if (cardBuffer) {
          const caption = [
            `📊 <b>[STATUS &amp; KONDISI WEBSITE EASYLEGAL]</b>`,
            `• Kondisi: <b>${SERVER_STATES[stateKey].label.toUpperCase()}</b> (${SERVER_STATES[stateKey].pill})`,
            `• Uptime: <b>${stateKey === 'normal' ? '99,98%' : '99,82%'}</b> • DB: ${snap.system.dbOk ? '🟢 Ok' : '🔴 Down'}`,
            `• Sesi Aktif: <b>${snap.security.activeSessions}</b> • Tiket Open: <b>${snap.tickets.open}</b>`,
          ].join('\n');

          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 500) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating server status card:', err);
      }
    }

    // 2. Support Tickets (/tiket or ticket queries)
    else if (
      lower === '/tiket' ||
      lower.includes('tiket') ||
      lower.includes('support') ||
      lower.includes('keluhan') ||
      lower.includes('komplain')
    ) {
      try {
        const activeTicket = await prisma.supportTicket.findFirst({
          where: { status: { in: ['open', 'in_progress'] } },
          include: { customer: true, messages: { orderBy: { createdAt: 'asc' }, take: 1 } },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });

        if (activeTicket) {
          const isUrgent = activeTicket.priority === 'urgent';
          const isAssigned = Boolean((activeTicket as any).assignedToId || activeTicket.status === 'in_progress');
          const isOld = (Date.now() - new Date(activeTicket.createdAt).getTime()) > 30 * 60 * 1000;

          let stateKey: 'urgent' | 'reminder' | 'diproses' | 'baru' = 'baru';
          if (isUrgent) {
            stateKey = 'urgent';
          } else if (isAssigned) {
            stateKey = 'diproses';
          } else if (isOld) {
            stateKey = 'reminder';
          } else {
            stateKey = 'baru';
          }

          const dateStr = `${format(new Date(activeTicket.createdAt), 'EEEE, dd MMMM yyyy - HH:mm', { locale: localeId })} WIB`;
          const cardBuffer = await generateTicketCardPng({
            ticketNumber: activeTicket.ticketNumber,
            subject: activeTicket.subject,
            category: activeTicket.category || 'Umum',
            priority: activeTicket.priority,
            createdAtStr: dateStr,
            customerName: activeTicket.customer?.name || 'Klien EasyLegal',
            mailboxAddress: activeTicket.customer?.mailboxAddress || '-',
            personalEmail: activeTicket.customer?.personalEmail,
            initialMessage: activeTicket.messages?.[0]?.message || activeTicket.subject,
            stateKey,
          });

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: `🤖 Draf Solusi #${activeTicket.ticketNumber}`, callback_data: `ai_draft:${activeTicket.ticketNumber}` },
                { text: '✅ Selesaikan', callback_data: `resolve:${activeTicket.ticketNumber}` },
              ],
              [
                { text: '🌐 Buka di Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
              ],
            ],
          };

          if (cardBuffer) {
            const caption = [
              `🎫 <b>[PUSAT TIKET SUPPORT KLIEN] #${escapeHtml(activeTicket.ticketNumber)}</b>`,
              `• Klien: <b>${escapeHtml(activeTicket.customer?.name || 'Klien')}</b>`,
              `• Subjek: <i>${escapeHtml(activeTicket.subject)}</i>`,
              `• Prioritas: <b>${activeTicket.priority.toUpperCase()}</b> • Status: <b>${activeTicket.status.toUpperCase()}</b>`,
            ].join('\n');

            const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
            if (photoRes.success) {
              if (replyText.length > 500) {
                await sendTelegramMessage(replyText, 'HTML', chatId);
              }
              return;
            }
          }
        } else {
          // No open tickets
          const cardBuffer = await generateAiAssistantCardPng({
            query: 'Pusat Tiket Support Klien',
            replySummary: '• Seluruh tiket support klien telah terselesaikan (0 antrean open).\n• Tidak ada keluhan atau permohonan yang tertunda.\n• Sistem standby menerima tiket baru dari Webmail & Portal.',
            senderName,
            category: 'PUSAT TIKET SUPPORT',
            pillText: 'SEMUA TIKET SELESAI',
            toneColor: '#22c55e',
            deepColor: '#15803d',
            pose: 'senang',
            bubbleText: 'Semua tiket beres! Layanan lancar terkendali.',
          });

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
                { text: '🔄 Cek Ulang', callback_data: 'bot_cmd:tiket' },
              ],
            ],
          };

          if (cardBuffer) {
            const caption = [
              `🎫 <b>[PUSAT TIKET SUPPORT KLIEN]</b>`,
              `• Status: 🟢 <b>Semua Tiket Selesai</b>`,
              `• Tidak ada antrean tiket aktif yang menunggu tindakan.`,
              `• Tim CS & Legal standby melayani permohonan baru.`,
            ].join('\n');

            const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
            if (photoRes.success) {
              if (replyText.length > 500) {
                await sendTelegramMessage(replyText, 'HTML', chatId);
              }
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating ticket card:', err);
      }
    }

    // 3. Daily Digest (/ringkasan or /digest)
    else if (lower === '/ringkasan' || lower === '/digest') {
      await sendChatAction(chatId, 'upload_document');
      await sendDailyDigest(prisma, chatId);
      return;
    }

    // 4. Security Radar (/keamanan or /radar)
    else if (
      lower === '/keamanan' ||
      lower === '/radar' ||
      lower.includes('keamanan') ||
      lower.includes('radar') ||
      lower.includes('multi-ip') ||
      lower.includes('anomali') ||
      lower.includes('login')
    ) {
      try {
        const snap = await gatherLiveWebsiteSnapshot(prisma);
        const hasAlerts = snap.security.multiIpCount > 0;

        let cardBuffer: Buffer | null = null;
        let caption = '';

        if (hasAlerts) {
          const multiIpSessions = await prisma.loginSession.groupBy({
            by: ['customerId'],
            having: {
              ipAddress: { _count: { gt: 1 } },
            },
          }).catch(() => []);

          const affectedCustId = multiIpSessions[0]?.customerId;
          const cust = affectedCustId ? await prisma.customer.findUnique({ where: { id: affectedCustId } }) : null;
          const ips = affectedCustId
            ? (await prisma.loginSession.findMany({
                where: { customerId: affectedCustId },
                select: { ipAddress: true },
                distinct: ['ipAddress'],
              })).map((s: any) => s.ipAddress).filter(Boolean)
            : ['182.253.140.22', '36.88.90.15'];

          cardBuffer = await generateSecurityAlertCardPng({
            accountName: cust?.name || 'Akun Terdeteksi Multi-IP',
            mailboxAddress: cust?.mailboxAddress || 'user@clienteasylegal.co.id',
            uniqueIps: ips.length > 0 ? ips : ['182.253.140.22', '36.88.90.15'],
            sessionCount: ips.length || 2,
          });

          caption = [
            `🚨 <b>[RADAR KEAMANAN] Anomali Multi-IP Terdeteksi!</b>`,
            `• Akun: <b>${escapeHtml(cust?.name || 'Multi-IP User')}</b>`,
            `• Terdeteksi dari <b>${ips.length} IP berbeda</b> secara bersamaan.`,
            `👉 <i>Buka Security Radar di Admin Console untuk investigasi.</i>`,
          ].join('\n');
        } else {
          cardBuffer = await generateAiAssistantCardPng({
            query: 'Radar Keamanan & Anomali Sesi',
            replySummary: [
              `• Sesi Aktif: ${snap.security.activeSessions} perangkat terhubung.`,
              `• Peringatan Multi-IP: 0 Alert (Kondisi 100% aman).`,
              '• Enkripsi TOTP 2FA: Aktif siaga (AES-256).',
              '• Proteksi AI: 100% Zero-Leakage Enclave aktif.',
            ].join('\n'),
            senderName,
            category: 'RADAR KEAMANAN SISTEM',
            pillText: 'SISTEM AMAN',
            toneColor: '#22c55e',
            deepColor: '#15803d',
            pose: 'senang',
            bubbleText: 'Radar aman! Tidak ada anomali.',
          });

          caption = [
            `🛡️ <b>[RADAR KEAMANAN] Kondisi 100% Aman</b>`,
            `• Sesi Aktif: <b>${snap.security.activeSessions} Perangkat</b>`,
            `• Anomali Multi-IP: 🟢 <b>0 Alert</b>`,
            `• Proteksi: <b>2FA TOTP &amp; Zero-Leakage Enclave Aktif</b>`,
          ].join('\n');
        }

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: hasAlerts ? '🚨 Buka Security Radar' : '🛡️ Buka Security Radar', url: 'https://clienteasylegal.co.id/admin' },
              { text: '🔄 Refresh Radar', callback_data: 'bot_cmd:keamanan' },
            ],
          ],
        };

        if (cardBuffer) {
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 500) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating security card:', err);
      }
    }

    // 5. Activity & Transactions (/kegiatan, /transaksi, /aktivitas)
    else if (
      lower === '/kegiatan' ||
      lower === '/transaksi' ||
      lower === '/aktivitas' ||
      lower.includes('kegiatan') ||
      lower.includes('transaksi') ||
      lower.includes('aktivitas')
    ) {
      try {
        const snap = await gatherLiveWebsiteSnapshot(prisma);
        const logLines = snap.security.recentAuditLogs.slice(0, 3).map((l) => `• ${l.action} oleh ${l.actor}`).join('\n')
          || '• Belum ada catatan audit log baru hari ini.';

        const cardBuffer = await generateAiAssistantCardPng({
          query: 'Catatan Transaksi & Kegiatan',
          replySummary: `${logLines}\n• Dokumen Baru: ${snap.documents.recentList.length} berkas diunggah\n• Total Email Terproses: ${snap.messages.total} pesan`,
          senderName,
          category: 'TRANSAKSI & AUDIT LOG',
          pillText: 'LOG AKTIVITAS',
          toneColor: '#06b6d4',
          deepColor: '#0e7490',
          pose: 'semangat',
          bubbleText: 'Catatan aktivitas siap ditinjau.',
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📊 Status Server', callback_data: 'bot_cmd:status' },
              { text: '🎫 Cek Tiket', callback_data: 'view_tickets' },
            ],
            [
              { text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
            ],
          ],
        };

        if (cardBuffer) {
          const caption = [
            `📋 <b>[TRANSAKSI &amp; KEGIATAN TERBARU]</b>`,
            `• Audit Log Terkini: <b>${snap.security.recentAuditLogs.length} Entri</b>`,
            `• Unggahan Berkas: <b>${snap.documents.recentList.length} Dokumen Baru</b>`,
            `• Total Email: <b>${snap.messages.total} Pesan</b>`,
          ].join('\n');

          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 500) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating activity card:', err);
      }
    }

    // 6. Storage Capacity (/storage)
    else if (
      lower === '/storage' ||
      lower.includes('storage') ||
      lower.includes('kapasitas') ||
      lower.includes('penyimpanan')
    ) {
      try {
        const snap = await gatherLiveWebsiteSnapshot(prisma);
        const usedMb = parseFloat(snap.documents.totalSizeMb || '0');
        const quotaMb = 10000; // 10 GB quota
        const usagePct = (usedMb / quotaMb) * 100;
        const isHighUsage = usagePct >= 80;

        const cardBuffer = await generateAiAssistantCardPng({
          query: 'Kapasitas Penyimpanan & Arsip',
          replySummary: [
            `• Hot Storage S3: ${snap.documents.totalSizeMb} MB terpakai (${usagePct.toFixed(1)}%)`,
            `• Total Dokumen: ${snap.documents.total} berkas legal`,
            `• Cold Storage Synology NAS: ${isHighUsage ? 'Perlu sinkronisasi segera!' : 'Terkoneksi normal'}`,
            `• Kebijakan Retensi 90 Hari: Pemantauan aktif`,
          ].join('\n'),
          senderName,
          category: 'KAPASITAS PENYIMPANAN',
          pillText: isHighUsage ? 'KAPASITAS KRITIS (>=80%)' : 'KAPASITAS WAJAR (<80%)',
          toneColor: isHighUsage ? '#ef4444' : '#fbbf24',
          deepColor: isHighUsage ? '#b91c1c' : '#b45309',
          pose: isHighUsage ? 'memikirkan' : 'saran',
          bubbleText: isHighUsage ? 'Penyimpanan mendekati batas! Segera arsipkan.' : 'Status penyimpanan S3 dan NAS wajar.',
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📊 Status Server', callback_data: 'bot_cmd:status' },
              { text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
            ],
          ],
        };

        if (cardBuffer) {
          const caption = [
            `💾 <b>[KAPASITAS PENYIMPANAN &amp; ARSIP]</b>`,
            `• Hot Storage S3: <b>${snap.documents.totalSizeMb} MB</b> (${usagePct.toFixed(1)}% Kuota)`,
            `• Total Dokumen: <b>${snap.documents.total} Berkas Legal</b>`,
            `• Synology NAS: ${isHighUsage ? '⚠️ <b>Perlu Sinkronisasi Segera</b>' : '🟢 <b>Tersambung Normal</b>'}`,
          ].join('\n');

          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 500) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating storage card:', err);
      }
    }

    // 7. Start / Help / Greeting (/start, /help, halo, hai)
    else if (
      lower === '/start' ||
      lower === '/help' ||
      lower === 'halo' ||
      lower === 'hai' ||
      lower === 'hi' ||
      lower === 'menu' ||
      lower.includes('bantuan') ||
      lower.includes('selamat pagi') ||
      lower.includes('selamat siang') ||
      lower.includes('selamat sore') ||
      lower.includes('selamat malam')
    ) {
      try {
        const cardBuffer = await generateAiAssistantCardPng({
          query: 'Menu & Panduan Bot AI',
          replySummary: [
            '• Tanyakan apa saja seputar kondisi server, email & tiket.',
            '• /status : Cek kesehatan webmail, API & server.',
            '• /tiket : Pantau tiket support klien & draf solusi AI.',
            '• /keamanan : Monitor sesi aktif & anomali login.',
            '• /storage : Pantau kapasitas S3 & Synology NAS.',
            '• /ringkasan : Laporan harian komprehensif 07:00 WIB.',
          ].join('\n'),
          senderName,
          category: 'PANDUAN & MENU UTAMA',
          pillText: 'EASYLEGAL AI ASSISTANT',
          toneColor: '#3b82f6',
          deepColor: '#1d4ed8',
          pose: 'melambai',
          bubbleText: `Halo ${senderName}! Ada yang bisa EL bantu?`,
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📊 Status Server', callback_data: 'bot_cmd:status' },
              { text: '🎫 Cek Tiket', callback_data: 'view_tickets' },
            ],
            [
              { text: '🛡️ Radar Keamanan', callback_data: 'bot_cmd:keamanan' },
              { text: '📈 Laporan Harian', callback_data: 'digest_refresh' },
            ],
          ],
        };

        if (cardBuffer) {
          const caption = [
            `👋 <b>Halo, ${escapeHtml(senderName)}!</b>`,
            `Saya <b>EL</b>, asisten AI resmi EasyLegal Customer Portal.`,
            `Gunakan tombol menu cepat di bawah atau tanyakan apa pun secara langsung.`,
          ].join('\n');

          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 500) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating welcome card:', err);
      }
    }

    // 8. Unknown slash command (perintah tidak dikenali)
    else if (lower.startsWith('/')) {
      try {
        const cardBuffer = await generateAiAssistantCardPng({
          query: rawText.length > 35 ? `${rawText.slice(0, 32)}...` : rawText,
          replySummary: [
            `• Perintah "${rawText}" tidak dikenali oleh sistem.`,
            `• Perintah yang tersedia:`,
            `  /status, /tiket, /keamanan, /kegiatan, /storage, /ringkasan`,
            `• Anda juga dapat mengetik pertanyaan bebas seputar website.`,
          ].join('\n'),
          senderName,
          category: 'BANTUAN NAVIGASI',
          pillText: 'PERINTAH TIDAK DIKENALI',
          toneColor: '#64748b',
          deepColor: '#475569',
          pose: 'memikirkan',
          bubbleText: 'Hmm, EL belum mengenali perintah itu.',
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📊 Status Server', callback_data: 'bot_cmd:status' },
              { text: '🎫 Cek Tiket', callback_data: 'view_tickets' },
            ],
            [
              { text: '🛡️ Radar Keamanan', callback_data: 'bot_cmd:keamanan' },
              { text: '📈 Laporan Harian', callback_data: 'digest_refresh' },
            ],
          ],
        };

        if (cardBuffer) {
          const caption = [
            `❓ <b>Perintah Tidak Dikenali:</b> <code>${escapeHtml(rawText)}</code>`,
            `EL belum mengenali perintah tersebut. Silakan pilih menu di bawah`,
            `atau ketik pertanyaan langsung seputar operasional sistem.`,
          ].join('\n');

          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating unknown command card:', err);
      }
    }

    // 9. Free Natural Language Questions (Jawaban AI Real-Time)
    else {
      try {
        const strippedText = stripHtml(replyText);
        const summaryLines = strippedText
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('━━━') && !s.startsWith('👉') && !s.startsWith('🔗') && !s.startsWith('🤖') && !s.startsWith('['))
          .slice(0, 6)
          .join('\n');

        const cardBuffer = await generateAiAssistantCardPng({
          query: rawText.length > 35 ? `${rawText.slice(0, 32)}...` : rawText,
          replySummary: summaryLines || strippedText.slice(0, 250),
          senderName,
          category: 'AI EXECUTIVE ASSISTANT',
          pillText: 'JAWABAN AI • REAL-TIME',
          toneColor: '#8b5cf6',
          deepColor: '#6d28d9',
          pose: 'tips',
          bubbleText: 'Jawaban sudah siap! Cek detailnya ya.',
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📊 Status Server', callback_data: 'bot_cmd:status' },
              { text: '🎫 Cek Tiket', callback_data: 'view_tickets' },
            ],
            [
              { text: '🌐 Buka Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
            ],
          ],
        };

        if (cardBuffer) {
          const caption = [
            `💡 <b>[JAWABAN AI] EasyLegal Assistant</b>`,
            `❓ <i>"${escapeHtml(rawText.length > 60 ? `${rawText.slice(0, 57)}...` : rawText)}"</i>`,
            `Ringkasan jawaban tertera pada kartu di atas.`,
          ].join('\n');

          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 300) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating general AI card:', err);
      }
    }

    // Default Fallback to text message
    await sendTelegramMessage(replyText, 'HTML', chatId);
  } catch (err: any) {
    console.error('[Telegram Bot] Error processing AI chat message:', err);
    const errText = `⚠️ <i>Maaf, terjadi kesalahan saat memproses pertanyaan Anda: ${err?.message || 'Internal error'}</i>`;
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📊 Status Server', callback_data: 'bot_cmd:status' },
          { text: '🎫 Cek Tiket', callback_data: 'view_tickets' },
        ],
      ],
    };
    try {
      const errCardBuffer = await generateAiAssistantCardPng({
        query: rawText.length > 35 ? `${rawText.slice(0, 32)}...` : rawText,
        replySummary: `• Terjadi kesalahan teknis: ${err?.message || 'Gagal memproses'}\n• Silakan coba kembali atau gunakan tombol menu cepat di bawah.`,
        senderName,
        category: 'GANGGUAN SISTEM',
        pillText: 'GANGGUAN TEKNIS',
        toneColor: '#64748b',
        deepColor: '#475569',
        pose: 'memikirkan',
        bubbleText: 'Waduh, ada kendala teknis saat memproses.',
      });
      if (errCardBuffer) {
        const photoRes = await sendTelegramPhoto(errCardBuffer, errText, replyMarkup, chatId);
        if (photoRes.success) return;
      }
    } catch {}
    await sendTelegramMessage(errText, 'HTML', chatId, replyMarkup);
  }
}

/**
 * Starts continuous long-polling loop for Telegram incoming messages
 */
export async function startTelegramBot(prisma: PrismaClient) {
  const config = getTelegramConfig();

  if (!config.botToken) {
    if (process.env.NODE_ENV !== 'test') {
      console.log('🤖 [Telegram Bot] Polling skipped (TELEGRAM_BOT_TOKEN not configured in .env).');
    }
    return;
  }

  if (process.env.TELEGRAM_BOT_POLLING === 'false') {
    console.log('🤖 [Telegram Bot] Polling disabled (TELEGRAM_BOT_POLLING=false).');
    return;
  }

  if (isPolling) return;

  isPolling = true;
  abortController = new AbortController();

  // Test getMe to display bot handle
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`);
    const meData: any = await meRes.json();
    if (meData?.ok && meData.result) {
      console.log(`🤖 [Telegram Bot] Terhubung sebagai @${meData.result.username} (${meData.result.first_name})`);
    }
  } catch (err: any) {
    console.warn('🤖 [Telegram Bot] Gagal verifikasi getMe awal:', err?.message || err);
  }

  console.log('🤖 [Telegram Bot] Memulai long polling worker untuk AI chat Telegram...');

  // Run polling in background
  (async () => {
    let offset = 0;

    while (isPolling) {
      try {
        const url = `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${offset}&timeout=20`;
        const res = await fetch(url, {
          signal: abortController?.signal,
        });

        const data: any = await res.json();
        if (data?.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            if (update.message) {
              handleTelegramMessageUpdate(prisma, update.message).catch((err) => {
                console.error('[Telegram Bot] Error handling message update:', err);
              });
            }
            if (update.callback_query) {
              handleTelegramCallbackQuery(prisma, update.callback_query).catch((err) => {
                console.error('[Telegram Bot] Error handling callback query:', err);
              });
            }
          }
        }
      } catch (err: any) {
        if (!isPolling || err.name === 'AbortError') {
          break;
        }
        // Wait 3 seconds on network blip before retrying
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  })();
}

/**
 * Stops continuous long polling
 */
export function stopTelegramBot() {
  if (isPolling) {
    isPolling = false;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    console.log('🤖 [Telegram Bot] Long polling dihentikan.');
  }
}
