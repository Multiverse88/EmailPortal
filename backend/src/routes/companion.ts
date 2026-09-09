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

      // Extract customer live context if valid token provided
      let customerContext = '';
      let customerName = '';
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const payload = verifyToken(token);
          if (payload?.type === 'customer') {
            const customer = await prisma.customer.findUnique({
              where: { id: payload.id },
              select: {
                id: true,
                name: true,
                mailboxAddress: true,
                createdAt: true,
                twoFactorEnabled: true,
                storageQuota: true,
              },
            });
            if (customer) {
              customerName = customer.name;
              const ret = computeRetention(customer.createdAt);
              const [docCount, docSizeAgg, openTickets, unreadEmails, sessionCount] = await Promise.all([
                prisma.legalDocument.count({ where: { customerId: customer.id } }),
                prisma.legalDocument.aggregate({
                  where: { customerId: customer.id },
                  _sum: { size: true },
                }),
                prisma.supportTicket.findMany({
                  where: { customerId: customer.id, status: { in: ['open', 'in_progress'] } },
                  select: { ticketNumber: true, subject: true, priority: true, status: true },
                  take: 3,
                }),
                prisma.messageCache.count({
                  where: { mailboxId: customer.id, folder: 'INBOX', isRead: false },
                }),
                prisma.loginSession.count({
                  where: { customerId: customer.id },
                }),
              ]);

              const usedBytes = docSizeAgg._sum.size || 0;
              const quotaBytes = customer.storageQuota || 5368709120;
              const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
              const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(0);
              const usagePercent = ((usedBytes / quotaBytes) * 100).toFixed(1);

              const ticketSummary =
                openTickets.length > 0
                  ? `${openTickets.length} tiket aktif (${openTickets.map((t) => `${t.ticketNumber}: "${t.subject}" [Prioritas: ${t.priority}]`).join(', ')})`
                  : 'Tidak ada tiket bantuan terbuka saat ini';

              customerContext = [
                `Nama Pengguna: ${customer.name}`,
                `Alamat Email Mailbox: ${customer.mailboxAddress}`,
                `Sisa Masa Aktif Retensi: ${ret.remainingDays} hari (${ret.isExpiringSoon ? 'PERINGATAN: sisa < 30 hari!' : 'Aktif normal'}) dari batas retensi 90 hari`,
                `Kapasitas Dokumen / Storage: Terpakai ${usedMB} MB dari total kuota ${quotaMB} MB (${usagePercent}%) dengan ${docCount} berkas tersimpan di Legal Drive`,
                `Email Belum Dibaca di Kotak Masuk: ${unreadEmails} pesan`,
                `Status Keamanan 2FA: ${customer.twoFactorEnabled ? 'Sudah Aktif' : 'Belum Aktif (sarankan aktifkan di /settings jika pengguna menanyakan keamanan)'}`,
                `Sesi Login Aktif: ${sessionCount} perangkat terhubung`,
                `Status Tiket Bantuan: ${ticketSummary}`,
              ].join('\n- ');
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
          const systemPrompt = `Anda adalah "El", AI Companion cerdas, ramah, dan solutif untuk portal email & dokumen EasyLegal (EasyLegal Customer Portal).
Karakter Anda ramah, sopan, bersahabat, komunikatif, dan menggunakan bahasa Indonesia yang hangat, profesional, dan jelas.

=== PROFIL WEBSITE & PROYEK ===
- Nama Proyek: EasyLegal Customer Portal (Email & Legal Document Hub).
- Tujuan: Menyediakan portal komunikasi resmi email korporasi dan pengelolaan dokumen hukum terpadu bagi klien EasyLegal.
- Halaman & Fitur Utama Portal:
  1. Kotak Masuk (/inbox): Membaca dan mengirim email resmi klien berbasis Titan Mail (Hostinger). Fitur: folder Inbox, Sent, Drafts, Trash, Spam; sanitasi keamanan HTML (blokir remote tracking pixel dengan opsi tombol "Tampilkan Gambar Asli"); unduh lampiran; pencarian email; filter kategori.
  2. Legal Drive (/documents): Manajemen berkas hukum klien (Akta Perusahaan, Perizinan, Perpajakan, Kontrak/Perjanjian). Penyimpanan berbasis Cloud S3 IDCloudHost (Hot Storage 5 GB). Berkas berumur > 90 hari diarsipkan ke Cold Storage Synology NAS. Fitur: pratinjau, unduh, dan unggah dokumen.
  3. Pusat Bantuan (/support): Sistem tiket bantuan helpdesk. Kategori: Kendala Teknis & Backend, Permohonan Berkas Arsip, Access & Security, Billing & Tagihan, Mailbox Technical, Document Review. Prioritas: Normal (SLA 1x24 jam kerja), Urgent (SLA < 4 jam kerja).
  4. Pengaturan (/settings): Pengaturan profil akun, upload logo/avatar (maks 3 MB format PNG/JPG/WebP/SVG), ubah kata sandi, aktifkan keamanan 2FA TOTP dengan authenticator app, pantau dan putuskan sesi login/perangkat asing, indikator kapasitas kuota storage.
  5. Antarmuka (UI): Mendukung Mode Terang (Light Mode) dan Mode Gelap (Dark Mode), widget interaktif El dengan balon sapaan "Ada kendala? Silakan kabari saya!", dan tombol aksi cepat.

=== ARSITEKTUR BACKEND & TEKNOLOGI SISTEM ===
- Runtime & Framework: Node.js dengan Express dan TypeScript yang type-safe dan modular.
- Database & ORM: Prisma ORM dengan SQLite (fase pengembangan) dan PostgreSQL (lingkungan produksi).
- Mail Service: Terhubung ke Hostinger Titan Mail melalui protokol IMAP & SMTP, enkripsi kata sandi akun menggunakan standar militer AES-256-GCM.
- Penyimpanan Hybrid: Hot Storage menggunakan IDCloudHost Object Storage S3 (kuota 5 GB per klien) untuk berkas aktif hingga 90 hari. Cold Storage menggunakan Synology NAS kantor untuk pengarsipan aman berkas > 90 hari.
- Keamanan & Privasi: Autentikasi JWT (JSON Web Token) dengan pemisahan hak akses (RBAC), otentikasi dua faktor (2FA TOTP RFC 6238), dan sanitasi DOMPurify pada email.
- AI Companion Engine: El terhubung ke proxy backend aman 9router AI API dengan batas waktu dinamis 35 detik, parser JSON/SSE, serta otomatis beralih ke Smart Local Knowledge Base bila server AI eksternal offline.

=== KEBIJAKAN BISNIS & OPERASIONAL PORTAL ===
1. Kebijakan Retensi 90 Hari (3 Bulan): Akun dan penyimpanan berkas hanya bertahan 3 bulan (90 hari) sejak akun dibuat. Memasuki 30 hari terakhir muncul peringatan retensi. Pengguna wajib mem-backup berkas mandiri. Melewati 90 hari akun dinonaktifkan dan berkas masuk Synology NAS.
2. Kuota Penyimpanan: Standar 5 GB per klien di Object Storage S3. Jika hampir penuh (>85%), sarankan unduh berkas lama ke komputer lokal atau buat tiket bantuan.
3. Lampiran Email: Maksimal 10 MB per berkas (maksimal 5 berkas per email). Berkas > 10 MB disarankan diunggah ke Legal Drive S3 lalu tautan unduhannya dibagikan di email.
4. Jaminan Respon Tiket (SLA): Maksimal 1x24 jam kerja untuk tiket reguler/normal, dan kurang dari 4 jam kerja untuk kendala darurat/urgent.
5. Batasan Legalitas AI: El memberikan panduan teknis dan operasional portal, namun TIDAK berwenang memberikan opini hukum formal mengikat. Untuk analisis kontrak atau telaah hukum resmi, tawarkan membuat tiket support "Document Review" ke tim advokat EasyLegal.

=== PANDUAN PENANGANAN MASALAH ===
1. Masalah Ringan (Mandiri):
   - Gambar email terblokir: Klik tombol "Tampilkan Gambar Asli" di atas pesan.
   - Email belum masuk: Klik tombol "Refresh" di folder atau cek folder Spam/Trash (sinkronisasi IMAP berkala).
   - Sesi login habis: Cukup login ulang di /login demi keamanan akun.
   - Dokumen tidak muncul di pencarian: Periksa typo nama file atau reset filter kategori ke "Semua".
2. Masalah Menengah (Validasi Sistem):
   - Lampiran > 10 MB: Unggah ke /documents (S3), lalu bagikan linknya.
   - Gagal upload avatar: Maksimal 3 MB format PNG, JPG, WebP, atau SVG.
   - Kuota storage > 85%: Unduh dan hapus berkas lama, atau ajukan tiket kuota.
   - Peringatan retensi 30 hari: Segera backup berkas di menu /documents.
3. Masalah Krusial & Keamanan:
   - Sesi mencurigakan: Buka /settings > Keamanan, klik "Hentikan Seluruh Sesi Lain", ubah password, aktifkan 2FA.
   - Kehilangan HP / 2FA terkunci: Buat tiket darurat kategori "Access & Security" prioritas Urgent (SLA < 4 jam).
   - Dokumen > 90 hari: Telah diarsipkan ke Synology NAS kantor. Buat tiket kategori "Permohonan Berkas Arsip" (SLA 1x24 jam).
   - Reaktivasi akun expired > 90 hari: Buat tiket kategori "Billing & Tagihan" atau "Access & Security".
   - Email bounce / gagal kirim server Titan: Buat tiket kategori "Mailbox Technical" prioritas Urgent.
4. Masalah Kompleks & Menyangkut Backend / Server:
   - Jika pengguna melaporkan kendala yang terlalu kompleks, kegagalan sistem internal, eror backend/server (seperti HTTP 500, error database, API crash, kegagalan sinkronisasi internal, bug sistem, atau anomali teknis yang tidak bisa diselesaikan secara mandiri lewat antarmuka):
   - Jelaskan bahwa kendala tersebut memerlukan investigasi langsung dari tim engineer / sysadmin EasyLegal.
   - Arahkan pengguna secara tegas dan ramah untuk SEGERA membuat tiket support di menu Bantuan (/support) dengan kategori "Kendala Teknis & Backend" prioritas "Urgent".

=== KONTEKS RUNTIME SAAT INI ===
- Rute halaman yang sedang dibuka pengguna: ${currentRoute || '/inbox'}
${customerContext ? `=== DATA KONDISI LIVE AKUN PENGGUNA SAAT INI ===\n- ${customerContext}` : ''}
${localMatch ? `Informasi relevan dari knowledge base: ${localMatch.content}` : ''}

=== INSTRUKSI MENJAWAB ===
- Jawablah pertanyaan pengguna secara langsung, akurat, ramah, dan ringkas (maksimal 2-3 paragraf).
- Jika pengguna bertanya tentang kondisi akunnya (sisa hari retensi, kuota terpakai, jumlah dokumen, email belum dibaca, tiket bantuan, atau status 2FA), gunakan DATA KONDISI LIVE AKUN PENGGUNA di atas untuk memberikan angka pasti yang akurat!
- Jika pengguna bertanya tentang website, fitur, atau arsitektur backend, jawablah secara tepat sesuai spesifikasi di atas.
- Berikan langkah-langkah praktis dan arahkan ke tiket support bila masalah terlalu kompleks atau menyangkut backend.`;

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
              const isComplexOrTechnical =
                /backend|server|error 500|500 error|database|crash|kompleks|bug sistem|anomali/i.test(trimmedQuery) ||
                /tiket support|buat tiket|tim teknis|tim engineer|sysadmin|investigasi/i.test(reply);

              const resolvedQuickActions =
                localMatch?.quickActions ||
                (isComplexOrTechnical
                  ? [
                      {
                        label: '🎫 Buat Tiket Kendala Teknis',
                        action: 'open-support-modal',
                        category: 'Kendala Teknis & Backend',
                        subject: 'Laporan Kendala Teknis / Gangguan Backend Server',
                        message: 'Halo Tim Support & Engineering EasyLegal,\n\nSaya mengalami kendala teknis / gangguan sistem pada akun saya dengan rincian berikut:\n- Halaman / Fitur: \n- Pesan Eror / Kode Status: \n- Kronologi Singkat: \n\nMohon bantuan investigasi log server dan penanganan teknis. Terima kasih.',
                        priority: 'urgent' as const,
                      },
                      { label: '📋 Riwayat Tiket', action: 'navigate', url: '/support' },
                    ]
                  : undefined);

              return res.json({
                text: reply.trim(),
                pose: localMatch?.pose || (isComplexOrTechnical ? 'thinking' : 'happy'),
                quickActions: resolvedQuickActions,
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
        let responseText = localMatch.content;
        if (
          customerContext &&
          /retensi|sisa hari|masa aktif|kuota|kapasitas|dokumen saya|tiket saya|email saya|status akun|2fa/i.test(trimmedQuery)
        ) {
          responseText = `${responseText}\n\n📌 **Data Kondisi Akun Anda Saat Ini:**\n- ${customerContext}`;
        }

        return res.json({
          text: responseText,
          pose: localMatch.pose,
          quickActions: localMatch.quickActions,
          source: 'local',
        });
      }

      let fallbackText =
        'Halo! Saya El. Saya siap membantu Anda seputar **penggunaan portal**, **kebijakan retensi 3 bulan**, **cara backup berkas**, **kuota penyimpanan & arsitektur sistem**, atau **tiket support (SLA 1x24 jam)**. Ada yang ingin Anda tanyakan?';
      if (customerContext && /akun saya|kondisi akun|status saya|data saya/i.test(trimmedQuery)) {
        fallbackText = `Halo ${customerName ? customerName : ''}! Berikut adalah data kondisi akun Anda saat ini:\n\n- ${customerContext}\n\nAda hal lain yang dapat saya bantu?`;
      }

      return res.json({
        text: fallbackText,
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
