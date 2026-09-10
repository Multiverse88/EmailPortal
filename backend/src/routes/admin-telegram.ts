import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTelegramConfig, sendTelegramMessage, sendDailyDigest } from '../lib/telegram';

export default (prisma: PrismaClient) => {
  const router = Router();

  // GET /api/admin/telegram/status - check bot token, chat ID configuration & schedule
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const config = getTelegramConfig();
      const cronSchedule = process.env.TELEGRAM_DAILY_SUMMARY_CRON || '0 8 * * *';
      const timezone = process.env.TZ || 'Asia/Jakarta';

      // Mask chat ID for display privacy (e.g. -100****1234 or 123****78)
      let maskedChatId = 'Belum Dikonfigurasi';
      if (config.chatId) {
        const cid = config.chatId;
        if (cid.length > 5) {
          maskedChatId = `${cid.slice(0, 3)}****${cid.slice(-3)}`;
        } else {
          maskedChatId = `${cid.slice(0, 1)}***`;
        }
      }

      res.json({
        configured: Boolean(config.botToken && config.chatId),
        enabled: config.enabled,
        maskedChatId,
        cronSchedule,
        timezone,
        hasBotToken: Boolean(config.botToken),
      });
    } catch (error) {
      console.error('Get Telegram status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/admin/telegram/test - send test verification message
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const config = getTelegramConfig();
      if (!config.botToken || !config.chatId) {
        return res.status(400).json({
          success: false,
          error: 'TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur di backend .env',
        });
      }

      const adminEmail = req.user?.email || 'Super Admin';
      const testMessage = [
        `🤖 <b>[TEST NOTIFIKASI TELEGRAM] EasyLegal Portal</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ <b>Status:</b> Bot Telegram Terhubung Sukses!`,
        `👤 <b>Pemicu Tes:</b> ${adminEmail}`,
        `⏰ <b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Notifikasi tiket support baru dan rangkuman harian keamanan website akan otomatis dikirimkan ke obrolan ini.`,
      ].join('\n');

      const result = await sendTelegramMessage(testMessage);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Gagal mengirim pesan ke Telegram API',
        });
      }

      res.json({
        success: true,
        messageId: result.messageId,
        message: 'Pesan tes berhasil terkirim ke Telegram!',
      });
    } catch (error: any) {
      console.error('Send test Telegram message error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // POST /api/admin/telegram/send-digest - trigger instant daily digest report
  router.post('/send-digest', async (_req: Request, res: Response) => {
    try {
      const result = await sendDailyDigest(prisma);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          reportText: result.reportText,
          error: 'Laporan berhasil dibuat, tetapi gagal dikirim ke Telegram (periksa TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID di .env).',
        });
      }

      res.json({
        success: true,
        reportText: result.reportText,
        message: 'Laporan harian kesehatan & keamanan website berhasil dikirim ke Telegram!',
      });
    } catch (error: any) {
      console.error('Trigger daily digest error:', error);
      res.status(500).json({ error: error.message || 'Gagal membuat laporan harian' });
    }
  });

  return router;
};
