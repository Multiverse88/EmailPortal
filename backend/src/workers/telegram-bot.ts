import { PrismaClient } from '@prisma/client';
import { getTelegramConfig, sendTelegramMessage, sendChatAction } from '../lib/telegram';
import { processTelegramAiMessage } from '../lib/telegram-ai';

let isPolling = false;
let abortController: AbortController | null = null;

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
