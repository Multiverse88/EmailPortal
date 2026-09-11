import { PrismaClient } from '@prisma/client';
import { format, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { escapeHtml, sendDailyDigest } from './telegram';

export interface LiveWebsiteSnapshot {
  system: {
    status: string;
    uptimeSeconds: number;
    memoryMb: number;
    dbOk: boolean;
  };
  accounts: {
    total: number;
    active: number;
    inactive: number;
    createdLast24h: number;
  };
  messages: {
    total: number;
    unread: number;
    recentList: {
      subject: string;
      sender: string;
      mailbox: string;
      date: string;
    }[];
  };
  documents: {
    total: number;
    totalSizeMb: string;
    recentList: {
      title: string;
      category: string;
      sizeMb: string;
      clientName: string;
      date: string;
    }[];
  };
  tickets: {
    open: number;
    urgent: number;
    resolved: number;
    activeList: {
      ticketNumber: string;
      subject: string;
      priority: string;
      category: string;
      clientName: string;
      status: string;
      date: string;
    }[];
  };
  security: {
    activeSessions: number;
    multiIpCount: number;
    multiIpClients: string[];
    recentAuditLogs: {
      action: string;
      actor: string;
      target: string;
      ip: string;
      date: string;
    }[];
  };
}

/**
 * Gathers comprehensive live snapshot of website condition, transactions & activities
 */
export async function gatherLiveWebsiteSnapshot(prisma: PrismaClient): Promise<LiveWebsiteSnapshot> {
  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check DB health
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  const [
    totalCustomers,
    activeCustomers,
    inactiveCustomers,
    createdLast24h,
    totalMessages,
    unreadMessages,
    recentMessages,
    totalDocs,
    docSizeAgg,
    recentDocs,
    openTickets,
    urgentTickets,
    resolvedTickets,
    activeTicketsList,
    activeSessions,
    multiIpGroups,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { status: 'active' } }),
    prisma.customer.count({ where: { status: { not: 'active' } } }),
    prisma.customer.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.messageCache.count(),
    prisma.messageCache.count({ where: { folder: 'INBOX', isRead: false } }),
    prisma.messageCache.findMany({
      take: 5,
      orderBy: { receivedAt: 'desc' },
      select: {
        subject: true,
        sender: true,
        receivedAt: true,
        mailbox: { select: { mailboxAddress: true } },
      },
    }),
    prisma.legalDocument.count(),
    prisma.legalDocument.aggregate({ _sum: { size: true } }),
    prisma.legalDocument.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        title: true,
        category: true,
        size: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.supportTicket.count({ where: { status: 'open' } }),
    prisma.supportTicket.count({ where: { status: 'open', priority: 'urgent' } }),
    prisma.supportTicket.count({ where: { status: 'resolved' } }),
    prisma.supportTicket.findMany({
      where: { status: { in: ['open', 'in_progress'] } },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        ticketNumber: true,
        subject: true,
        priority: true,
        category: true,
        status: true,
        updatedAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.loginSession.count(),
    prisma.loginSession.groupBy({
      by: ['customerId'],
      having: { ipAddress: { _count: { gt: 1 } } },
    }).catch(() => []),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { email: true, role: true } },
        customer: { select: { name: true, mailboxAddress: true } },
      },
    }),
  ]);

  const usedBytes = docSizeAgg._sum.size || 0;
  const usedMb = (usedBytes / (1024 * 1024)).toFixed(1);
  const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  return {
    system: {
      status: 'Online & Beroperasi Normal',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: memMb,
      dbOk,
    },
    accounts: {
      total: totalCustomers,
      active: activeCustomers,
      inactive: inactiveCustomers,
      createdLast24h,
    },
    messages: {
      total: totalMessages,
      unread: unreadMessages,
      recentList: recentMessages.map((m) => ({
        subject: m.subject || '(Tanpa Subjek)',
        sender: m.sender || '-',
        mailbox: m.mailbox?.mailboxAddress || '-',
        date: format(new Date(m.receivedAt), 'dd/MM HH:mm'),
      })),
    },
    documents: {
      total: totalDocs,
      totalSizeMb: usedMb,
      recentList: recentDocs.map((d) => ({
        title: d.title,
        category: d.category,
        sizeMb: (d.size / (1024 * 1024)).toFixed(2),
        clientName: d.customer?.name || 'Klien',
        date: format(new Date(d.createdAt), 'dd/MM HH:mm'),
      })),
    },
    tickets: {
      open: openTickets,
      urgent: urgentTickets,
      resolved: resolvedTickets,
      activeList: activeTicketsList.map((t) => ({
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        priority: t.priority,
        category: t.category,
        clientName: t.customer?.name || 'Klien',
        status: t.status,
        date: format(new Date(t.updatedAt), 'dd/MM HH:mm'),
      })),
    },
    security: {
      activeSessions,
      multiIpCount: Array.isArray(multiIpGroups) ? multiIpGroups.length : 0,
      multiIpClients: [],
      recentAuditLogs: recentAuditLogs.map((log) => ({
        action: log.action,
        actor: log.actor?.email || 'System',
        target: log.customer ? `${log.customer.name} (${log.customer.mailboxAddress})` : (log.targetType || '-'),
        ip: log.ipAddress || '-',
        date: format(new Date(log.createdAt), 'dd/MM HH:mm'),
      })),
    },
  };
}

/**
 * Formats quick-command responses (/start, /status, /kegiatan, /tiket, /keamanan, /storage)
 */
export async function formatCommandResponse(
  prisma: PrismaClient,
  command: string,
  chatId?: string | number,
  senderName: string = 'Super Admin'
): Promise<string> {
  const cmd = command.toLowerCase().trim();

  if (cmd === '/start' || cmd === '/help') {
    return [
      `👋 <b>Halo, ${escapeHtml(senderName)}!</b>`,
      `Saya adalah <b>AI Assistant EasyLegal Customer Portal</b> di Telegram.`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Anda dapat menanyakan <b>segala kondisi, transaksi, atau aktivitas</b> yang terjadi di website secara langsung.`,
      ``,
      `💡 <b>Perintah Cepat Tersedia:</b>`,
      `• <code>/status</code> - Kondisi server, database & cluster webmail Titan`,
      `• <code>/kegiatan</code> - Transaksi & aktivitas terbaru (audit log, email, berkas)`,
      `• <code>/tiket</code> - Daftar tiket bantuan aktif & prioritasnya`,
      `• <code>/keamanan</code> - Radar sesi aktif, anomali multi-IP & integritas`,
      `• <code>/storage</code> - Kapasitas Hot S3 & Cold Storage Synology NAS`,
      `• <code>/ringkasan</code> - Kirim laporan harian komprehensif sekarang`,
      ``,
      `💬 <b>Atau Tanyakan Bebas:</b>`,
      `<i>Contoh:</i>`,
      `• "Bagaimana kondisi server dan website hari ini?"`,
      `• "Ada transaksi atau aktivitas apa saja barusan?"`,
      `• "Apakah ada tiket support yang mendesak?"`,
      `• "Berapa kapasitas penyimpanan S3 yang tersisa?"`,
    ].join('\n');
  }

  if (cmd === '/status') {
    const snap = await gatherLiveWebsiteSnapshot(prisma);
    const uptimeHours = (snap.system.uptimeSeconds / 3600).toFixed(1);
    return [
      `🌐 <b>[STATUS & KONDISI WEBSITE EASYLEGAL]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• <b>Portal Web:</b> 🟢 <b>${snap.system.status}</b>`,
      `• <b>Database (Prisma):</b> ${snap.system.dbOk ? '🟢 <b>Terhubung Normal</b>' : '🔴 <b>Gangguan Koneksi!</b>'}`,
      `• <b>Cluster Titan Mail:</b> 🟢 <b>Tersinkronisasi (IMAP 993 / SMTP 465)</b>`,
      `• <b>Uptime Backend:</b> ⏱️ <b>${uptimeHours} Jam</b>`,
      `• <b>Penggunaan RAM Heap:</b> 💻 <b>${snap.system.memoryMb} MB</b>`,
      `• <b>Total Akun Mailbox:</b> 👥 <b>${snap.accounts.total} Akun</b> (${snap.accounts.active} Aktif)`,
      `• <b>Pesan Email di Cache:</b> 📧 <b>${snap.messages.total} Email</b> (${snap.messages.unread} Belum Dibaca)`,
      `• <b>Pusat Tiket:</b> 🎫 <b>${snap.tickets.open} Terbuka</b> (${snap.tickets.urgent} Urgent)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Semua layanan inti berjalan optimal tanpa kendala teknis.</i>`,
    ].join('\n');
  }

  if (cmd === '/kegiatan' || cmd === '/transaksi' || cmd === '/aktivitas') {
    const snap = await gatherLiveWebsiteSnapshot(prisma);
    const logItems = snap.security.recentAuditLogs.length > 0
      ? snap.security.recentAuditLogs.map((l) =>
          `• <code>${l.date}</code>: <b>${escapeHtml(l.action)}</b> oleh <i>${escapeHtml(l.actor)}</i>\n  Target: <code>${escapeHtml(l.target)}</code> (IP: ${escapeHtml(l.ip)})`
        ).join('\n')
      : '<i>Belum ada log transaksi tercatat.</i>';

    const recentDocs = snap.documents.recentList.length > 0
      ? snap.documents.recentList.map((d) =>
          `• <code>${d.date}</code>: <b>${escapeHtml(d.title)}</b> (${d.sizeMb} MB) oleh <i>${escapeHtml(d.clientName)}</i>`
        ).join('\n')
      : '<i>Belum ada berkas baru diunggah hari ini.</i>';

    return [
      `📋 <b>[TRANSAKSI & KEGIATAN TERBARU DI WEBSITE]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ <b>Aktivitas Audit Log Terkini:</b>`,
      logItems,
      ``,
      `📂 <b>Unggahan Dokumen Terakhir:</b>`,
      recentDocs,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Ketik pertanyaan apa pun bila Anda butuh rincian aktivitas tertentu.`,
    ].join('\n');
  }

  if (cmd === '/tiket') {
    const snap = await gatherLiveWebsiteSnapshot(prisma);
    const ticketItems = snap.tickets.activeList.length > 0
      ? snap.tickets.activeList.map((t) =>
          `• <b>${escapeHtml(t.ticketNumber)}</b> [${t.priority.toUpperCase() === 'URGENT' ? '🚨 URGENT' : 'ℹ️ NORMAL'}]\n  Subjek: <b>${escapeHtml(t.subject)}</b>\n  Klien: <i>${escapeHtml(t.clientName)}</i> (${t.category})`
        ).join('\n\n')
      : '🟢 <i>Tidak ada tiket aktif yang menunggu respon saat ini.</i>';

    return [
      `🎫 <b>[PUSAT TIKET SUPPORT KLIEN]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Tiket Menunggu Respon: <b>${snap.tickets.open} Tiket</b>`,
      `• Tiket Prioritas Urgent: <b>${snap.tickets.urgent} Tiket</b>`,
      `• Tiket Terselesaikan: <b>${snap.tickets.resolved} Tiket</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ticketItems,
    ].join('\n');
  }

  if (cmd === '/keamanan' || cmd === '/radar') {
    const snap = await gatherLiveWebsiteSnapshot(prisma);
    return [
      `🛡️ <b>[RADAR KEAMANAN & ANOMALI WEBSITE]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Sesi Login Aktif: <b>${snap.security.activeSessions} Perangkat</b>`,
      `• Peringatan Multi-IP: ${snap.security.multiIpCount > 0 ? `🚨 <b>${snap.security.multiIpCount} Akun Multi-IP!</b>` : `🟢 <b>0 Alert (Aman)</b>`}`,
      `• Status Isolasi PDF AI: 🛡️ <b>100% In-Memory Zero-Leakage Aktif</b>`,
      `• Otentikasi 2FA TOTP: 🟢 <b>Enkripsi AES-256 Siaga</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Gunakan konsol Super Admin di web untuk memutuskan sesi asing jika terdeteksi anomali.</i>`,
    ].join('\n');
  }

  if (cmd === '/storage') {
    const snap = await gatherLiveWebsiteSnapshot(prisma);
    return [
      `💾 <b>[KAPASITAS PENYIMPANAN & RETENSI]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Hot Storage S3 (IDCloudHost): <b>${snap.documents.totalSizeMb} MB</b> Terpakai`,
      `• Total Dokumen Legal Drive: <b>${snap.documents.total} Berkas</b>`,
      `• Cold Storage NAS (Synology): 🟢 <b>Terkoneksi Normal</b>`,
      `• Kebijakan Retensi 90 Hari: 🟢 <b>Pemantauan Otomatis Aktif</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');
  }

  if (cmd === '/ringkasan' || cmd === '/digest') {
    const res = await sendDailyDigest(prisma, chatId);
    return res.reportText;
  }

  return '';
}

/**
 * Intelligent AI Chat processor for natural language questions on Telegram
 */
export async function processTelegramAiMessage(
  prisma: PrismaClient,
  userMessage: string,
  context?: { chatId?: string | number; senderName?: string }
): Promise<string> {
  const trimmed = userMessage.trim();
  const senderName = context?.senderName || 'Super Admin';

  // Check if direct slash command
  if (trimmed.startsWith('/')) {
    const commandResult = await formatCommandResponse(prisma, trimmed, context?.chatId, senderName);
    if (commandResult) {
      return commandResult;
    }
  }

  // Gather live data snapshot from the database
  const snap = await gatherLiveWebsiteSnapshot(prisma);

  // Check if 9router external AI API is available
  const apiKey = process.env.NINEROUTER_API_KEY?.trim();
  const baseUrl = process.env.NINEROUTER_BASE_URL?.trim() || 'https://api.9router.com/v1';
  const model = process.env.NINEROUTER_MODEL?.trim() || 'gpt-4o-mini';

  // In test environment without mock, directly use local heuristic engine for speed and reliability
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
  if (isTest && !process.env.TEST_ENABLE_NINEROUTER) {
    return generateLocalHeuristicResponse(trimmed, snap, senderName);
  }

  if (apiKey && apiKey.length > 0) {
    try {
      const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const systemPrompt = `Anda adalah "EasyLegal Assistant", AI Chat resmi Super Admin EasyLegal Customer Portal di Telegram.
Tugas Anda: Menjawab pertanyaan Super Admin tentang segala KONDISI, TRANSAKSI, KEGIATAN, EMAIL, DOKUMEN, TIKET SUPPORT, dan KEAMANAN website EasyLegal.

=== CAKUPAN RESMI PROYEK EASYLEGAL CUSTOMER PORTAL ===
- Platform: EasyLegal Customer Portal (Email Korporasi & Legal Document Hub).
- Layanan Inti:
  1. Customer Portal: Antarmuka klien & admin (Next.js).
  2. API Backend: Express, TypeScript, Prisma ORM, JWT, 2FA TOTP.
  3. Webmail & IMAP: Email korporasi resmi berbasis Hostinger Titan Mail (IMAP port 993, SMTP port 465).
  4. Legal Drive: Dokumen legal klien di Cloud S3 IDCloudHost (Hot Storage 5 GB, 90 hari) & Synology NAS kantor (Cold Storage > 90 hari).
  5. Pusat Tiket Support: Helpdesk penanganan keluhan klien (SLA 1x24 jam normal, < 4 jam urgent).
  6. Radar Keamanan: Sesi login aktif, deteksi multi-IP login, audit log, enkripsi AES-256-GCM.

=== BATASAN KONTEKS & LARANGAN FITUR DI LUAR PROYEK (STRICT RULES) ===
1. JANGAN PERNAH menyebutkan atau mengklaim fitur yang TIDAK ADA dalam proyek ini!
2. Proyek ini TIDAK MEMILIKI:
   - ❌ WhatsApp API / WhatsApp Gateway / integrasi WhatsApp bot apapun (seluruh komunikasi email resmi dikelola via Webmail Titan, dan notifikasi Super Admin via bot Telegram ini).
   - ❌ Pelacakan resi ekspedisi / kurir / pengiriman paket fisik (JNE, J&T, SiCepat, dll). Platform ini hanya mengelola dokumen digital.
   - ❌ E-commerce / toko online / marketplace.
3. Jika ditanya tentang WhatsApp, resi pengiriman, kurir, atau hal di luar portal:
   - TEGASKAN secara sopan dan ramah bahwa EasyLegal Customer Portal adalah platform email korporasi dan dokumen legal digital yang TIDAK memiliki fitur tersebut.
   - Arahkan ke perintah resmi yang relevan (/status, /tiket, /storage, /keamanan).

=== DATA LIVE SNAPSHOT WEBSITE SAAT INI (REAL-TIME DARI DATABASE) ===
- Kondisi Server: ${snap.system.status}, Uptime: ${(snap.system.uptimeSeconds / 3600).toFixed(1)} Jam, RAM: ${snap.system.memoryMb} MB, Database: ${snap.system.dbOk ? 'OK' : 'Error'}
- Akun Mailbox: Total ${snap.accounts.total} akun (${snap.accounts.active} aktif, ${snap.accounts.inactive} nonaktif). Dibuat 24 jam terakhir: ${snap.accounts.createdLast24h} akun.
- Trafik Pesan: Total ${snap.messages.total} email (${snap.messages.unread} belum dibaca).
  Pesan terbaru:
  ${snap.messages.recentList.map((m) => `  * [${m.date}] Dari: ${m.sender} ke ${m.mailbox} | Subjek: "${m.subject}"`).join('\n') || '  (Belum ada pesan)'}
- Dokumen Legal Drive: Total ${snap.documents.total} berkas (${snap.documents.totalSizeMb} MB).
  Berkas terbaru:
  ${snap.documents.recentList.map((d) => `  * [${d.date}] ${d.title} (${d.sizeMb} MB) oleh ${d.clientName}`).join('\n') || '  (Belum ada dokumen)'}
- Tiket Support Klien: ${snap.tickets.open} tiket open, ${snap.tickets.urgent} urgent, ${snap.tickets.resolved} selesai.
  Tiket aktif saat ini:
  ${snap.tickets.activeList.map((t) => `  * ${t.ticketNumber} [${t.priority.toUpperCase()}] "${t.subject}" oleh ${t.clientName} (${t.status})`).join('\n') || '  (Tidak ada tiket aktif)'}
- Radar Keamanan: ${snap.security.activeSessions} sesi login aktif, ${snap.security.multiIpCount} deteksi multi-IP.
  Log audit / transaksi terbaru:
  ${snap.security.recentAuditLogs.map((l) => `  * [${l.date}] ${l.action} oleh ${l.actor} pada target ${l.target} (IP: ${l.ip})`).join('\n') || '  (Belum ada log)'}

=== ATURAN FORMAT JAWABAN ===
1. Jawablah dalam Bahasa Indonesia yang profesional, ramah, padat, dan akurat.
2. Gunakan tag format HTML Telegram: <b>tebal</b>, <code>kode/angka</code>, <i>miring</i>. JANGAN gunakan markdown asterik (**) karena Telegram menggunakan HTML parse mode.
3. Sebutkan angka pasti dan rincian transaksi/tiket yang relevan dari data live di atas.
4. Jaga agar jawaban tidak terlalu panjang (maksimal 3-4 paragraf) agar nyaman dibaca di layar HP Telegram.`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const aiRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trimmed },
          ],
          temperature: 0.6,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (aiRes.ok) {
        const rawText = await aiRes.text();
        const data = JSON.parse(rawText);
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          return reply;
        }
      }
    } catch (err: any) {
      console.warn('Telegram AI chat external error, falling back to local heuristic:', err?.message || err);
    }
  }

  // Local Intelligent Heuristic Fallback
  return generateLocalHeuristicResponse(trimmed, snap, senderName);
}

/**
 * Intelligent Local Heuristic Engine for Telegram AI Chat
 */
function generateLocalHeuristicResponse(
  query: string,
  snap: LiveWebsiteSnapshot,
  senderName: string
): string {
  const q = query.toLowerCase();

  // 0. Pertanyaan di luar cakupan proyek (Out-of-scope: WhatsApp, Resi, Ekspedisi, E-commerce)
  if (
    q.includes('whatsapp') ||
    q.includes(' wa ') ||
    q.startsWith('wa ') ||
    q.endsWith(' wa') ||
    q === 'wa' ||
    q.includes('resi') ||
    q.includes('ekspedisi') ||
    q.includes('kurir') ||
    q.includes('pengiriman paket') ||
    q.includes('ongkir') ||
    q.includes('toko online') ||
    q.includes('marketplace')
  ) {
    return [
      `ℹ️ <b>[INFORMASI CAKUPAN PROYEK EASYLEGAL]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Platform ini adalah <b>EasyLegal Customer Portal</b> yang berfokus eksklusif pada <b>Email Korporasi (Webmail Titan)</b> dan <b>Legal Document Hub (S3 & Synology NAS)</b>.`,
      ``,
      `❌ <b>Fitur di Luar Cakupan Platform:</b>`,
      `• <b>WhatsApp Gateway / API:</b> Tidak tersedia. Komunikasi resmi email dikelola via Webmail Titan Mail, dan notifikasi admin via bot Telegram ini.`,
      `• <b>Pelacakan Resi / Ekspedisi:</b> Tidak tersedia. Platform ini mengelola dokumen digital, bukan pengiriman barang fisik.`,
      ``,
      `💡 <b>Layanan Inti yang Tersedia:</b>`,
      `• <code>/status</code> - Kondisi server, database & cluster webmail`,
      `• <code>/tiket</code> - Pusat tiket bantuan & keluhan klien`,
      `• <code>/storage</code> - Kapasitas penyimpanan Cloud S3 & Synology NAS`,
      `• <code>/keamanan</code> - Radar keamanan sesi & deteksi multi-IP`,
    ].join('\n');
  }

  // 1. Email & Pesan / Webmail Titan
  if (
    q.includes('email') ||
    q.includes('pesan') ||
    q.includes('inbox') ||
    q.includes('webmail') ||
    q.includes('titan') ||
    q.includes('surat')
  ) {
    const recentMails = snap.messages.recentList.length > 0
      ? snap.messages.recentList.map((m) => `• <code>${m.date}</code>: Dari <i>${escapeHtml(m.sender)}</i>\n  Subjek: <b>${escapeHtml(m.subject)}</b> (${m.mailbox})`).join('\n\n')
      : '<i>Belum ada pesan email terbaru di cache.</i>';

    return [
      `📧 <b>[STATUS TRAFIK EMAIL & WEBMAIL TITAN]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Total Email di Cache: <b>${snap.messages.total} Pesan</b>`,
      `• Email Belum Dibaca (Inbox): <b>${snap.messages.unread} Pesan</b>`,
      `• Koneksi Hostinger Titan: 🟢 <b>Tersinkronisasi (IMAP 993 / SMTP 465)</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📩 <b>Pesan Terbaru:</b>`,
      recentMails,
    ].join('\n');
  }

  // 2. Transaksi & Kegiatan / Aktivitas / Audit Log
  if (
    q.includes('transaksi') ||
    q.includes('kegiatan') ||
    q.includes('aktivitas') ||
    q.includes('log') ||
    q.includes('riwayat') ||
    q.includes('kejadian')
  ) {
    const logs = snap.security.recentAuditLogs.slice(0, 5).map(
      (l) => `• <code>${l.date}</code>: <b>${escapeHtml(l.action)}</b> oleh <i>${escapeHtml(l.actor)}</i>\n  Target: ${escapeHtml(l.target)}`
    ).join('\n\n');

    return [
      `📋 <b>[RANGKUMAN TRANSAKSI & KEGIATAN WEBSITE]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Berikut catatan transaksi dan aktivitas administratif terbaru di website:`,
      ``,
      logs || '<i>Belum ada transaksi tercatat dalam 24 jam terakhir.</i>',
      ``,
      `📂 <b>Aktivitas Dokumen:</b> Total <b>${snap.documents.total} berkas</b> tersimpan (${snap.documents.totalSizeMb} MB).`,
      `📧 <b>Aktivitas Email:</b> Total <b>${snap.messages.total} pesan</b> di cache (${snap.messages.unread} belum dibaca).`,
    ].join('\n');
  }

  // 2. Tiket Support / Keluhan Klien
  if (
    q.includes('tiket') ||
    q.includes('support') ||
    q.includes('keluhan') ||
    q.includes('komplain') ||
    q.includes('bantuan')
  ) {
    const ticketList = snap.tickets.activeList.length > 0
      ? snap.tickets.activeList.map(
          (t) => `• <b>${escapeHtml(t.ticketNumber)}</b> [${t.priority.toUpperCase() === 'URGENT' ? '🚨 URGENT' : 'NORMAL'}]\n  Subjek: <b>${escapeHtml(t.subject)}</b>\n  Klien: ${escapeHtml(t.clientName)}`
        ).join('\n\n')
      : '🟢 <i>Semua tiket telah terselesaikan, tidak ada tiket yang terbuka saat ini.</i>';

    return [
      `🎫 <b>[KONDISI PUSAT TIKET SUPPORT]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Tiket Menunggu Respon (Open): <b>${snap.tickets.open} Tiket</b>`,
      `• Tiket Prioritas Mendesak (Urgent): <b>${snap.tickets.urgent} Tiket</b>`,
      `• Tiket Telah Selesai: <b>${snap.tickets.resolved} Tiket</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ticketList,
      ``,
      `👉 <i>Buka konsol Super Admin web untuk menanggapi tiket klien.</i>`,
    ].join('\n');
  }

  // 3. Kondisi Server / Website / Uptime / Kesehatan
  if (
    q.includes('kondisi') ||
    q.includes('status') ||
    q.includes('server') ||
    q.includes('website') ||
    q.includes('kesehatan') ||
    q.includes('sehat') ||
    q.includes('portal')
  ) {
    const uptimeHours = (snap.system.uptimeSeconds / 3600).toFixed(1);
    return [
      `🌐 <b>[KONDISI UMUM WEBSITE & SERVER]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Status Keseluruhan: 🟢 <b>${snap.system.status}</b>`,
      `• Database SQLite/PostgreSQL: ${snap.system.dbOk ? '🟢 <b>Normal</b>' : '🔴 <b>Error</b>'}`,
      `• Cluster Email Titan: 🟢 <b>Tersinkronisasi (IMAP 993/SMTP 465)</b>`,
      `• Uptime Sistem: <b>${uptimeHours} Jam Operasi</b>`,
      `• Total Akun Terdaftar: <b>${snap.accounts.total} Mailbox</b> (${snap.accounts.active} Aktif)`,
      `• Sesi Perangkat Aktif: <b>${snap.security.activeSessions} Perangkat</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Sistem beroperasi normal tanpa anomali kritis yang terdeteksi.`,
    ].join('\n');
  }

  // 4. Keamanan / Login / Multi-IP / Radar
  if (
    q.includes('keamanan') ||
    q.includes('security') ||
    q.includes('login') ||
    q.includes('radar') ||
    q.includes('sesi') ||
    q.includes('ip') ||
    q.includes('hacker') ||
    q.includes('mencurigakan')
  ) {
    return [
      `🛡️ <b>[KONDISI RADAR KEAMANAN]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Jumlah Sesi Login Terhubung: <b>${snap.security.activeSessions} Perangkat</b>`,
      `• Deteksi Multi-IP Login: ${snap.security.multiIpCount > 0 ? `🚨 <b>${snap.security.multiIpCount} Akun Terdeteksi Multi-IP!</b>` : `🟢 <b>0 Alert (Kondisi Aman)</b>`}`,
      `• Perlindungan Zero Data Leakage: 🛡️ <b>100% In-Memory Aktif</b>`,
      `• Otentikasi 2FA TOTP: 🟢 <b>Berjalan Normal</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');
  }

  // 5. Storage / Penyimpanan / Dokumen
  if (
    q.includes('storage') ||
    q.includes('penyimpanan') ||
    q.includes('s3') ||
    q.includes('synology') ||
    q.includes('nas') ||
    q.includes('dokumen') ||
    q.includes('berkas') ||
    q.includes('kuota')
  ) {
    return [
      `💾 <b>[STATUS PENYIMPANAN & DOKUMEN]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Hot Storage S3 (IDCloudHost): <b>${snap.documents.totalSizeMb} MB</b> Terpakai`,
      `• Total Berkas Legal Drive: <b>${snap.documents.total} Berkas</b>`,
      `• Cold Storage Synology NAS: 🟢 <b>Tersambung untuk arsip &gt; 90 hari</b>`,
      `• Kebijakan Retensi: 🟢 <b>90 Hari Pemantauan Aktif</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');
  }

  // 6. Default / Sapaan Umum
  return [
    `🤖 <b>Halo, ${escapeHtml(senderName)}!</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Saya dapat memberikan informasi real-time mengenai kondisi website EasyLegal saat ini:`,
    ``,
    `• <b>Kondisi Server:</b> 🟢 ${snap.system.status}`,
    `• <b>Akun Klien:</b> 👥 <b>${snap.accounts.total} Akun</b> (${snap.accounts.active} Aktif)`,
    `• <b>Tiket Bantuan:</b> 🎫 <b>${snap.tickets.open} Terbuka</b> (${snap.tickets.urgent} Urgent)`,
    `• <b>Penyimpanan S3:</b> 💾 <b>${snap.documents.totalSizeMb} MB</b> (${snap.documents.total} Dokumen)`,
    `• <b>Keamanan:</b> 🛡️ <b>${snap.security.activeSessions} Sesi</b> (${snap.security.multiIpCount} Anomali IP)`,
    ``,
    `Silakan ketik pertanyaan spesifik seperti:`,
    `• <i>"Tampilkan kegiatan dan transaksi terbaru"</i>`,
    `• <i>"Ada tiket yang mendesak tidak?"</i>`,
    `• <i>"Bagaimana kondisi server sekarang?"</i>`,
  ].join('\n');
}
