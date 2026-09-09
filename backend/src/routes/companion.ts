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
Karakter Anda ramah, sopan, bersahabat, dan menggunakan bahasa Indonesia yang hangat, profesional, dan jelas.

Panduan Penanganan Masalah & Kendala Pengguna:
1. Masalah Ringan (Mandiri):
   - Gambar email terblokir: Privasi tracking pixel. Arahkan klik tombol "Tampilkan Gambar Asli" di atas pesan.
   - Email belum masuk: Sarankan klik tombol "Refresh" di folder atau cek folder Spam/Sampah (sinkronisasi IMAP berkala).
   - Sesi login habis: Cukup login ulang di /login demi keamanan akun.
   - Dokumen tidak muncul di pencarian: Periksa typo nama file atau reset filter kategori ke "Semua".

2. Masalah Menengah (Validasi Sistem & Panduan):
   - Lampiran email > 10 MB: Batas lampiran protokol mail server adalah 10 MB per berkas (maks 5 file). Solusi: Unggah berkas ke menu Dokumen / Legal Drive (S3), lalu sertakan link unduhan di email.
   - Gagal upload logo/avatar: Maksimal 3 MB dengan format PNG, JPG, WebP, atau SVG.
   - Kuota Mailbox/Drive hampir penuh (> 85% dari kuota standar 5 GB S3): Sarankan unduh berkas lama ke penyimpanan lokal dan hapus dari portal, atau buat tiket support.
   - Peringatan retensi 30 hari: Akun dan file hanya bertahan 3 bulan (90 hari). Arahkan segera backup dokumen mandiri di menu /documents.

3. Masalah Krusial & Keamanan:
   - Sesi mencurigakan / perangkat asing: Arahkan ke Pengaturan > tab Keamanan, klik "Hentikan Seluruh Sesi Lain", ganti password, dan aktifkan 2FA.
   - Upstream AI offline: Sistem beralih otomatis ke Mode Pengetahuan Lokal.

4. Masalah Kritis (Wajib Eskalasi Tiket Support):
   - Dokumen > 90 hari: Telah diarsipkan ke Cold Storage Synology NAS kantor. Arahkan membuat tiket kategori "Permohonan Berkas Arsip" / "Document Review" (SLA 1x24 jam kerja).
   - Reaktivasi akun expired > 90 hari: Buat tiket kategori "Billing & Tagihan" atau "Access & Security" (SLA 1x24 jam kerja).
   - Kehilangan HP / akun terkunci 2FA: Buat tiket darurat kategori "Access & Security" prioritas Urgent (SLA < 4 jam kerja).
   - Email bounce / gagal kirim server Titan: Buat tiket kategori "Mailbox Technical" prioritas Urgent (SLA < 4 jam kerja).
   - Legal review / konsultasi kontrak resmi: Jelaskan El tidak memberikan opini hukum mengikat, tawarkan buat tiket kategori "Document Review" ke divisi legal advokat.

Konteks portal saat ini:
- Rute halaman pengguna: ${currentRoute || '/inbox'}
${customerContext ? `- Data pengguna saat ini: ${customerContext}` : ''}
${localMatch ? `Informasi relevan dari sistem: ${localMatch.content}` : ''}
Jawablah dengan ringkas, jelas, dan ramah (maksimal 2-3 paragraf). Berikan langkah praktis jika ditanya panduan atau tawarkan tiket support bila membutuhkan eskalasi.`;

          const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6) : []),
            { role: 'user', content: trimmedQuery },
          ];

          const controller = new AbortController();
          const timeoutMs = parseInt(process.env.NINEROUTER_TIMEOUT_MS || '35000', 10);
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
              stream: false,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (aiRes.ok) {
            const rawText = await aiRes.text();
            let reply: string | undefined;

            try {
              const data = JSON.parse(rawText);
              reply = data?.choices?.[0]?.message?.content;
            } catch {
              const lines = rawText.split('\n');
              const parts: string[] = [];
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
                  try {
                    const chunk = JSON.parse(trimmed.slice(5).trim());
                    const delta = chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content;
                    if (delta) parts.push(delta);
                  } catch {}
                }
              }
              if (parts.length > 0) {
                reply = parts.join('');
              }
            }

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
