import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { computeRetention } from '../lib/retention';
import { getCustomerStorageStats } from '../lib/quota';

export default (prisma: PrismaClient) => {
  const router = Router();

  // GET /api/admin/support/tickets - list all tickets with customer details
  router.get('/tickets', async (req: Request, res: Response) => {
    try {
      const { status, priority, search } = req.query;
      const where: any = {};

      if (typeof status === 'string' && status !== 'all' && status.trim()) {
        where.status = status.trim();
      }
      if (typeof priority === 'string' && priority !== 'all' && priority.trim()) {
        where.priority = priority.trim();
      }
      if (typeof search === 'string' && search.trim()) {
        const query = search.trim();
        where.OR = [
          { ticketNumber: { contains: query } },
          { subject: { contains: query } },
          { customer: { name: { contains: query } } },
          { customer: { mailboxAddress: { contains: query } } },
        ];
      }

      const tickets = await prisma.supportTicket.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mailboxAddress: true,
              personalEmail: true,
              createdAt: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // last message
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      });

      const openCount = await prisma.supportTicket.count({ where: { status: 'open' } });
      const resolvedCount = await prisma.supportTicket.count({ where: { status: 'resolved' } });

      res.json({
        tickets,
        total: tickets.length,
        stats: {
          open: openCount,
          resolved: resolvedCount,
          urgent: tickets.filter((t) => t.priority === 'urgent' && t.status === 'open').length,
        },
      });
    } catch (error) {
      console.error('Superadmin list support tickets error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/support/tickets/:id - ticket detail with messages & customer diagnostic context
  router.get('/tickets/:id', async (req: Request, res: Response) => {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Tiket tidak ditemukan' });
      }

      const [retention, storageStats, docCount] = await Promise.all([
        computeRetention(ticket.customer.createdAt),
        getCustomerStorageStats(prisma, ticket.customerId),
        prisma.legalDocument.count({ where: { customerId: ticket.customerId } }),
      ]);

      res.json({
        ticket,
        messages: ticket.messages,
        customerContext: {
          name: ticket.customer.name,
          mailboxAddress: ticket.customer.mailboxAddress,
          personalEmail: ticket.customer.personalEmail,
          retention,
          storageStats,
          docCount,
          status: ticket.customer.status,
        },
      });
    } catch (error) {
      console.error('Superadmin get ticket detail error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/admin/support/tickets/:id/reply - Super Admin replies to ticket
  router.post('/tickets/:id/reply', async (req: Request, res: Response) => {
    try {
      const { message, status } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Pesan balasan wajib diisi' });
      }

      const ticket = await prisma.supportTicket.findUnique({
        where: { id: req.params.id },
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Tiket tidak ditemukan' });
      }

      const adminName = req.user?.email ? `Super Admin (${req.user.email.split('@')[0]})` : 'Super Admin EasyLegal';

      const newMessage = await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderName: adminName,
          senderRole: 'agent',
          message: message.trim(),
        },
      });

      const nextStatus = status && ['open', 'resolved', 'closed'].includes(status) ? status : ticket.status;

      const updatedTicket = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
          updatedAt: new Date(),
        },
      });

      res.status(201).json({
        message: newMessage,
        ticket: updatedTicket,
      });
    } catch (error) {
      console.error('Superadmin reply ticket error:', error);
      res.status(500).json({ error: 'Gagal mengirim balasan tiket' });
    }
  });

  // PATCH /api/admin/support/tickets/:id/status - update status (open, resolved, closed)
  router.patch('/tickets/:id/status', async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status || !['open', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid' });
      }

      const ticket = await prisma.supportTicket.update({
        where: { id: req.params.id },
        data: { status, updatedAt: new Date() },
      });

      res.json({ ticket });
    } catch (error) {
      console.error('Superadmin update ticket status error:', error);
      res.status(500).json({ error: 'Gagal memperbarui status tiket' });
    }
  });

  // POST /api/admin/support/tickets/:id/suggest-reply - AI Suggested Resolution Assistant
  router.post('/tickets/:id/suggest-reply', async (req: Request, res: Response) => {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Tiket tidak ditemukan' });
      }

      const retention = computeRetention(ticket.customer.createdAt);
      const storageStats = await getCustomerStorageStats(prisma, ticket.customerId);
      const lastClientMessage = [...ticket.messages].reverse().find((m) => m.senderRole === 'client')?.message || ticket.subject;

      // Smart Resolution Engine based on EasyLegal SLA and Policies
      let suggestedReply = '';
      let recommendedActions: string[] = [];
      let categoryInsight = '';

      const queryLower = `${ticket.subject} ${lastClientMessage} ${ticket.category}`.toLowerCase();

      if (/arsip|cold storage|90 hari|3 bulan|pulihkan|hilang|lama/i.test(queryLower)) {
        categoryInsight = 'Permohonan Akses / Pemulihan Berkas Cold Storage Synology NAS';
        suggestedReply = `Halo ${ticket.customer.name},\n\nTerima kasih telah menghubungi Super Admin EasyLegal.\n\nSesuai kebijakan pengarsipan berkas (> 90 hari), dokumen lama Anda telah tersimpan secara aman dan terenkripsi di unit Cold Storage Synology NAS kami. Tim Super Admin telah memverifikasi permohonan Anda dan saat ini sedang mempersiapkan pemindahan berkas tersebut kembali ke Legal Drive aktif Anda dalam 1x24 jam kerja.\n\nAnda akan menerima notifikasi otomatis begitu berkas selesai disinkronkan. Mohon pastikan ruang penyimpanan Anda mencukupi.\n\nSalam hormat,\nSuper Admin EasyLegal Support`;
        recommendedActions = [
          'Jalankan script: npm run storage:sync-synology untuk memeriksa ketersediaan berkas di Synology NAS',
          'Pastikan customer memiliki kuota storage aktif (< 5 GB)',
          'Tandai tiket resolved setelah file disinkronkan kembali',
        ];
      } else if (/kuota|penuh|storage|kapasitas|5 gb|upload gagal/i.test(queryLower)) {
        const usedMB = (storageStats.storageUsed / (1024 * 1024)).toFixed(1);
        categoryInsight = 'Kendala Kapasitas Kuota Penyimpanan (Storage Quota)';
        suggestedReply = `Halo ${ticket.customer.name},\n\nTerima kasih telah menghubungi kami. Kami telah memeriksa status storage akun Anda (${ticket.customer.mailboxAddress}). Saat ini kapasitas penyimpanan Anda tercatat terpakai ${usedMB} MB dari batas maksimal 5.000 MB.\n\nUntuk mengatasi kendala unggah berkas, Anda dapat:\n1. Mengunduh berkas-berkas lampiran lama dan menghapusnya dari Legal Drive.\n2. Mengajukan penambahan kuota penyimpanan perusahaan kepada tim Super Admin kami.\n\nApabila Anda memerlukan penyesuaian kuota khusus untuk kontrak korporasi, silakan informasikan kembali kepada kami.\n\nSalam hangat,\nSuper Admin EasyLegal Support`;
        recommendedActions = [
          `Cek usage saat ini: ${usedMB} MB / 5 GB`,
          'Jika disetujui, tingkatkan storageQuota di tabel Customer',
          'Rekomendasikan klien membersihkan Lampiran Email yang tidak terpakai',
        ];
      } else if (/email|login|password|sandi|sync|imap|smtp|gagal masuk/i.test(queryLower)) {
        categoryInsight = 'Bantuan Kredensial & Autentikasi Mailbox';
        suggestedReply = `Halo ${ticket.customer.name},\n\nTerima kasih telah menghubungi Super Admin EasyLegal.\n\nKami telah memverifikasi status mailbox ${ticket.customer.mailboxAddress} pada cluster email korporasi kami. Akun Anda dalam keadaan aktif. Jika Anda mengalami kendala kata sandi atau sinkronisasi, kami telah mengirimkan tautan reset kata sandi resmi ke email pribadi Anda (${ticket.customer.personalEmail}).\n\nSilakan periksa kotak masuk email pribadi Anda dan ikuti panduan login yang tertera.\n\nSalam hormat,\nSuper Admin EasyLegal Support`;
        recommendedActions = [
          'Verifikasi apakah status akun customer "active"',
          'Gunakan tombol "Kirim Info" di panel Mailbox untuk kirim ulang kredensial',
          'Periksa apakah ada aktivitas brute-force di Security Radar',
        ];
      } else if (/kontrak|akta|review|legal|perjanjian|sk/i.test(queryLower)) {
        categoryInsight = 'Pemeriksaan & Telaah Dokumen Hukum (Document Review)';
        suggestedReply = `Halo ${ticket.customer.name},\n\nTerima kasih atas berkas legal yang telah Anda sampaikan. Tiket Anda telah diprioritaskan untuk penelaahan oleh tim konsultan hukum EasyLegal.\n\nDokumen Anda telah masuk dalam antrean telaah resmi kami dengan SLA 1x24 jam kerja. Catatan atau lembar persetujuan (approval sheet) akan kami sematkan langsung pada riwayat versi dokumen di Legal Drive Anda.\n\nSalam hormat,\nSuper Admin EasyLegal Support`;
        recommendedActions = [
          'Buka tab Ekstraksi Dokumen Legal untuk memvalidasi nomor akta/SK',
          'Pastikan metadata dokumen tersimpan di persistent memory',
          'Koordinasikan dengan Officer jika diperlukan pembuatan draf revisi',
        ];
      } else {
        categoryInsight = 'Bantuan Umum Pelanggan EasyLegal';
        suggestedReply = `Halo ${ticket.customer.name},\n\nTerima kasih telah menghubungi Super Admin EasyLegal.\n\nLaporan Anda mengenai "${ticket.subject}" telah kami terima dan telah ditindaklanjuti oleh tim Super Admin. Apabila Anda membutuhkan bantuan tambahan atau dokumen konfirmasi lainnya, jangan ragu untuk membalas pesan ini.\n\nSalam hangat,\nSuper Admin EasyLegal Support`;
        recommendedActions = [
          'Tinjau riwayat pesan pelanggan di atas',
          'Ketik balasan atau gunakan template di atas lalu klik Kirim Balasan',
        ];
      }

      res.json({
        suggestedReply,
        categoryInsight,
        recommendedActions,
        customerDiagnostic: {
          remainingDays: retention.remainingDays,
          storageUsedMB: (storageStats.storageUsed / (1024 * 1024)).toFixed(1),
          mailboxAddress: ticket.customer.mailboxAddress,
          personalEmail: ticket.customer.personalEmail,
        },
      });
    } catch (error) {
      console.error('Superadmin suggest reply error:', error);
      res.status(500).json({ error: 'Gagal membuat rekomendasi AI' });
    }
  });

  return router;
};
