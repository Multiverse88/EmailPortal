import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth';
import { findMatchingKnowledge } from '../lib/companion-knowledge';
import { computeRetention } from '../lib/retention';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    const apiKey = process.env.NINEROUTER_API_KEY?.trim();
    const model = process.env.NINEROUTER_MODEL?.trim() || 'gpt-4o-mini';
    const isConfigured = Boolean(apiKey && apiKey.length > 0);

    res.json({
      configured: isConfigured,
      model,
      provider: isConfigured ? '9router' : 'local',
      status: isConfigured ? 'online' : 'local',
      active: true,
    });
  });

  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { query, history, currentRoute } = req.body;
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const trimmedQuery = query.trim();
      const localMatch = findMatchingKnowledge(trimmedQuery);

      // Extract customer context if valid token provided
      let customerContext = '';
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const payload = verifyToken(token);
          if (payload?.type === 'customer') {
            const customer = await prisma.customer.findUnique({
              where: { id: payload.id },
              select: { name: true, mailboxAddress: true, createdAt: true },
            });
            if (customer) {
              const ret = computeRetention(customer.createdAt);
              customerContext = `Nama Customer: ${customer.name}, Email: ${customer.mailboxAddress}, Sisa Waktu Retensi: ${ret.remainingDays} hari (${ret.isExpiringSoon ? 'PERINGATAN: sisa < 30 hari' : 'aktif normal'}).`;
            }
          }
        } catch {
          // Token invalid or expired: proceed without personal context
        }
      }

      const apiKey = process.env.NINEROUTER_API_KEY?.trim();
      const baseUrl = process.env.NINEROUTER_BASE_URL?.trim() || 'https://api.9router.com/v1';
      const model = process.env.NINEROUTER_MODEL?.trim() || 'gpt-4o-mini';

      if (apiKey && apiKey.length > 0) {
        try {
          const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
          const systemPrompt = `Anda adalah "El", AI Companion cerdas, ramah, dan solutif untuk portal email & dokumen EasyLegal.
Karakter Anda ramah, sopan, bersahabat, dan menggunakan bahasa Indonesia yang hangat dan jelas.
Konteks portal EasyLegal saat ini:
- Rute halaman pengguna: ${currentRoute || '/inbox'}
${customerContext ? `- Data pengguna saat ini: ${customerContext}` : ''}
- Kebijakan retensi akun: Akun & file penyimpanan hanya bertahan 3 bulan (90 hari) sejak akun dibuat.
- Pengingat 1 bulan terakhir: Pengguna wajib mem-backup berkas dokumen mandiri sebelum akun non-aktif.
- Layanan Tiket Support: Jaminan tanggapan SLA 1x24 jam kerja untuk kendala akun non-aktif atau perpanjangan.
${localMatch ? `Informasi relevan dari sistem: ${localMatch.content}` : ''}
Jawablah dengan ringkas, jelas, dan ramah (maksimal 2-3 paragraf). Berikan langkah praktis jika ditanya panduan.`;

          const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6) : []),
            { role: 'user', content: trimmedQuery },
          ];

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const aiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: messagesPayload,
              temperature: 0.7,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (aiRes.ok) {
            const data: any = await aiRes.json();
            const reply = data?.choices?.[0]?.message?.content;
            if (reply && typeof reply === 'string' && reply.trim()) {
              return res.json({
                text: reply.trim(),
                pose: localMatch?.pose || 'happy',
                quickActions: localMatch?.quickActions,
                source: '9router',
              });
            }
          }
        } catch (apiErr) {
          console.warn('Backend 9router call failed, falling back to local engine:', apiErr);
        }
      }

      // Local Fallback
      if (localMatch) {
        return res.json({
          text: localMatch.content,
          pose: localMatch.pose,
          quickActions: localMatch.quickActions,
          source: 'local',
        });
      }

      return res.json({
        text: 'Halo! Saya El. Saya siap membantu Anda seputar **kebijakan retensi 3 bulan**, **cara backup berkas**, **kuota penyimpanan**, atau **tiket support (SLA 1x24 jam)**. Ada yang ingin Anda tanyakan?',
        pose: 'greeting',
        quickActions: [
          { label: 'ℹ️ Kebijakan 3 Bulan', action: 'ask-retention' },
          { label: '📁 Cara Backup Berkas', action: 'ask-backup' },
          { label: '🎫 Info Tiket Support', action: 'ask-support' },
        ],
        source: 'local',
      });
    } catch (err: any) {
      console.error('Companion chat route error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
