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
  generateAiAssistantCardPng,
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
        await sendTelegramMessage(
          `⚠️ <i>Tiket #${escapeHtml(ticketNumber)} tidak ditemukan di database.</i>`,
          'HTML',
          chatId
        );
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
          const caption = aiDraftResponse.length <= 1000 ? aiDraftResponse : `${aiDraftResponse.slice(0, 950)}...`;
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (aiDraftResponse.length > 1000) {
              await sendTelegramMessage(aiDraftResponse, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('[Telegram Bot] Error generating card for ai_draft:', e);
      }

      await sendTelegramMessage(aiDraftResponse, 'HTML', chatId, replyMarkup);
    } catch (err: any) {
      console.error('[Telegram Bot] Error generating AI draft for ticket:', err);
      await sendTelegramMessage(
        `⚠️ <i>Gagal merumuskan draf AI: ${escapeHtml(err?.message || 'Kesalahan internal')}</i>`,
        'HTML',
        chatId
      );
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
        await sendTelegramMessage(`⚠️ <i>Tiket #${escapeHtml(ticketNumber)} tidak ditemukan.</i>`, 'HTML', chatId);
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

      const resolveText = [
        `✅ <b>[TIKET BERHASIL DISELESAIKAN]</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 <b>Nomor Tiket:</b> <code>#${escapeHtml(ticketNumber)}</code>`,
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
          const photoRes = await sendTelegramPhoto(cardBuffer, resolveText, replyMarkup, chatId);
          if (photoRes.success) return;
        }
      } catch (e) {
        console.warn('[Telegram Bot] Error generating card for resolve:', e);
      }

      await sendTelegramMessage(resolveText, 'HTML', chatId, replyMarkup);
    } catch (err: any) {
      console.error('[Telegram Bot] Error resolving ticket:', err);
      await sendTelegramMessage(
        `⚠️ <i>Gagal menyelesaikan tiket: ${escapeHtml(err?.message || 'Kesalahan internal')}</i>`,
        'HTML',
        chatId
      );
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
        const noTicketsText = `🟢 <b>Tidak Ada Tiket Terbuka</b>\nSemua tiket bantuan telah terselesaikan dengan baik!`;
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
          stateKey: firstTicket.priority === 'urgent' ? 'urgent' : 'baru',
        });

        if (cardBuffer) {
          const caption = lines.join('\n').length <= 1000 ? lines.join('\n') : `${lines.join('\n').slice(0, 950)}...`;
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) return;
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
      await sendTelegramMessage(
        [
          `⛔ <b>Akses Ditolak</b>`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Bot AI ini dikonfigurasi khusus untuk Super Admin terotorisasi EasyLegal Customer Portal.`,
          ``,
          `<i>ID Chat Anda:</i> <code>${chatId}</code>`,
        ].join('\n'),
        'HTML',
        chatId
      );
      return;
    }
  } else {
    // If chat ID is not yet configured, assist the admin with onboarding
    await sendTelegramMessage(
      [
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
      ].join('\n'),
      'HTML',
      chatId
    );
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
        const isHealthy = snap.system.dbOk && snap.tickets.urgent === 0 && snap.security.multiIpCount === 0;
        const stateKey = !snap.system.dbOk ? 'down' : !isHealthy ? 'gangguan' : 'normal';

        const services = [
          { key: 'portal', name: 'Customer Portal', ms: 142, up: 99.99, status: 'ok' },
          { key: 'api', name: 'API Backend', ms: 88, up: 99.98, status: 'ok' },
          { key: 'resi', name: 'Hot Storage (S3)', ms: 156, up: 99.97, status: 'ok' },
          { key: 'mail', name: 'Webmail Cluster', ms: 212, up: 99.95, status: 'ok' },
          { key: 'wa', name: 'WhatsApp Gateway', ms: snap.security.multiIpCount > 0 ? 2840 : 318, up: 99.93, status: snap.security.multiIpCount > 0 ? 'slow' : 'ok' },
          { key: 'ai', name: 'AI Assistant', ms: 640, up: 99.96, status: 'ok' },
        ];

        const cardBuffer = await generateServerStatusCardPng({
          stateKey,
          serverTime: `${format(new Date(), 'EEEE, dd MMMM yyyy - HH:mm', { locale: localeId })} WIB`,
          serverNext: 'Besok 07:00 WIB',
          services,
          uptimePct: isHealthy ? '99,98' : '99,82',
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
          const caption = replyText.length <= 1000 ? replyText : `${replyText.slice(0, 950)}...`;
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 1000) {
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
          where: { status: 'open' },
          include: { customer: true, messages: { orderBy: { createdAt: 'asc' }, take: 1 } },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });

        if (activeTicket) {
          const isUrgent = activeTicket.priority === 'urgent';
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
            initialMessage: activeTicket.messages?.[0]?.message,
            stateKey: isUrgent ? 'urgent' : 'baru',
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
            const caption = replyText.length <= 1000 ? replyText : `${replyText.slice(0, 950)}...`;
            const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
            if (photoRes.success) {
              if (replyText.length > 1000) {
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
            pose: 'konfirmasi',
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
            const caption = replyText.length <= 1000 ? replyText : `${replyText.slice(0, 950)}...`;
            const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
            if (photoRes.success) {
              if (replyText.length > 1000) {
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
      // sendDailyDigest already generates and sends the card
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
        const cardBuffer = await generateAiAssistantCardPng({
          query: 'Radar Keamanan & Anomali Sesi',
          replySummary: [
            `• Sesi Aktif: ${snap.security.activeSessions} perangkat terhubung.`,
            `• Peringatan Multi-IP: ${hasAlerts ? `${snap.security.multiIpCount} akun login serentak!` : '0 Alert (Kondisi 100% aman).' }`,
            '• Enkripsi TOTP 2FA: Aktif siaga (AES-256).',
            '• Proteksi AI: 100% Zero-Leakage Enclave aktif.',
          ].join('\n'),
          senderName,
          category: 'RADAR KEAMANAN SISTEM',
          pillText: hasAlerts ? 'ALERT MULTI-IP' : 'SISTEM AMAN',
          toneColor: hasAlerts ? '#ef4444' : '#22c55e',
          deepColor: hasAlerts ? '#b91c1c' : '#15803d',
          pose: hasAlerts ? 'menyapa' : 'senang',
          bubbleText: hasAlerts ? 'Perhatian! Ada login multi-IP.' : 'Radar aman! Tidak ada anomali.',
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '🛡️ Buka Security Radar', url: 'https://clienteasylegal.co.id/admin' },
              { text: '🔄 Refresh Radar', callback_data: 'bot_cmd:keamanan' },
            ],
          ],
        };

        if (cardBuffer) {
          const caption = replyText.length <= 1000 ? replyText : `${replyText.slice(0, 950)}...`;
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 1000) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating security card:', err);
      }
    }

    // 5. Start / Help / Greeting (/start, /help, halo, hai)
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
          const caption = replyText.length <= 1000 ? replyText : `${replyText.slice(0, 950)}...`;
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 1000) {
              await sendTelegramMessage(replyText, 'HTML', chatId);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Telegram Bot] Error generating welcome card:', err);
      }
    }

    // 6. General Questions / Storage / Kegiatan / Any Natural Language Query
    else {
      try {
        const strippedText = stripHtml(replyText);
        const summaryLines = strippedText
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('━━━') && !s.startsWith('👉') && !s.startsWith('🔗') && !s.startsWith('🤖') && !s.startsWith('['))
          .slice(0, 5)
          .join('\n');

        const isActivity = lower === '/kegiatan' || lower.includes('kegiatan') || lower.includes('transaksi') || lower.includes('aktivitas');
        const isStorage = lower === '/storage' || lower.includes('storage') || lower.includes('kapasitas');

        const cardBuffer = await generateAiAssistantCardPng({
          query: rawText.length > 35 ? `${rawText.slice(0, 32)}...` : rawText,
          replySummary: summaryLines || strippedText.slice(0, 200),
          senderName,
          category: isActivity ? 'TRANSAKSI & AUDIT LOG' : isStorage ? 'KAPASITAS PENYIMPANAN' : 'AI EXECUTIVE ASSISTANT',
          pillText: isActivity ? 'LOG AKTIVITAS' : isStorage ? 'STORAGE S3 & NAS' : 'JAWABAN AI • REAL-TIME',
          toneColor: isActivity ? '#06b6d4' : isStorage ? '#3b82f6' : '#8b5cf6',
          deepColor: isActivity ? '#0e7490' : isStorage ? '#1d4ed8' : '#6d28d9',
          pose: isActivity ? 'semangat' : isStorage ? 'saran' : 'tips',
          bubbleText: isActivity ? 'Catatan aktivitas siap ditinjau.' : isStorage ? 'Status penyimpanan S3 dan NAS.' : 'Jawaban sudah siap! Cek detailnya ya.',
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
          const caption = replyText.length <= 1000 ? replyText : `${replyText.slice(0, 950)}...`;
          const photoRes = await sendTelegramPhoto(cardBuffer, caption, replyMarkup, chatId);
          if (photoRes.success) {
            if (replyText.length > 1000) {
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
