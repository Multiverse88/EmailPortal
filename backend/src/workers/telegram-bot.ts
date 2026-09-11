import { PrismaClient } from '@prisma/client';
import {
  getTelegramConfig,
  sendTelegramMessage,
  sendChatAction,
  escapeHtml,
  answerTelegramCallbackQuery,
  sendDailyDigest,
} from '../lib/telegram';
import { processTelegramAiMessage } from '../lib/telegram-ai';

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

      await sendTelegramMessage(aiDraftResponse, 'HTML', chatId, {
        inline_keyboard: [
          [
            { text: '🌐 Buka di Admin Desk', url: 'https://clienteasylegal.co.id/admin' },
            { text: '✅ Selesaikan Tiket', callback_data: `resolve:${ticket.ticketNumber}` },
          ],
        ],
      });
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

      await sendTelegramMessage(
        [
          `✅ <b>[TIKET BERHASIL DISELESAIKAN]</b>`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 <b>Nomor Tiket:</b> <code>#${escapeHtml(ticketNumber)}</code>`,
          `Status tiket telah diperbarui menjadi <b>RESOLVED (Selesai)</b> di sistem.`,
          `Waktu Update: ${new Date().toLocaleTimeString('id-ID')} WIB`,
        ].join('\n'),
        'HTML',
        chatId
      );
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
        await sendTelegramMessage(
          `🟢 <b>Tidak Ada Tiket Terbuka</b>\nSemua tiket bantuan telah terselesaikan dengan baik!`,
          'HTML',
          chatId
        );
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

      await sendTelegramMessage(lines.join('\n'), 'HTML', chatId, {
        inline_keyboard: inlineKeyboard,
      });
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

    if (replyText) {
      await sendTelegramMessage(replyText, 'HTML', chatId);
    }
  } catch (err: any) {
    console.error('[Telegram Bot] Error processing AI chat message:', err);
    await sendTelegramMessage(
      `⚠️ <i>Maaf, terjadi kesalahan saat memproses pertanyaan Anda: ${err?.message || 'Internal error'}</i>`,
      'HTML',
      chatId
    );
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
