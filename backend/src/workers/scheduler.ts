import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendDailyDigest, getTelegramConfig } from '../lib/telegram';

let dailyDigestTask: cron.ScheduledTask | null = null;

/**
 * Initializes background cron jobs for daily website health & security digest reports
 */
export function startScheduler(prisma: PrismaClient) {
  const cronExpression = process.env.TELEGRAM_DAILY_SUMMARY_CRON || '0 8 * * *'; // Default: 08:00 AM WIB
  const timezone = process.env.TZ || 'Asia/Jakarta';

  console.log(`⏱️ [Scheduler] Registering Daily Telegram Digest Cron: "${cronExpression}" (${timezone})`);

  try {
    dailyDigestTask = cron.schedule(
      cronExpression,
      async () => {
        console.log(`[Scheduler] 🚀 Executing scheduled daily website & security digest via Telegram at ${new Date().toISOString()}...`);
        try {
          const result = await sendDailyDigest(prisma);
          if (result.success) {
            console.log('[Scheduler] ✓ Daily Telegram digest report sent successfully!');
          } else {
            console.log('[Scheduler] ℹ️ Daily digest generated but not dispatched to Telegram (bot token not configured or network error).');
          }
        } catch (err) {
          console.error('[Scheduler] ✗ Error running daily digest:', err);
        }
      },
      {
        timezone,
      }
    );
  } catch (err) {
    console.error('[Scheduler] Failed to schedule cron task:', err);
  }
}

/**
 * Stops background cron scheduler
 */
export function stopScheduler() {
  if (dailyDigestTask) {
    dailyDigestTask.stop();
    dailyDigestTask = null;
    console.log('⏱️ [Scheduler] Daily Telegram Digest Cron stopped.');
  }
}
