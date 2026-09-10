import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { notifyNewSupportTicket } from '../lib/telegram';

export default (prisma: PrismaClient) => {
  const router = Router();

  // GET /api/support/tickets - list customer tickets
  router.get('/tickets', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const tickets = await prisma.supportTicket.findMany({
        where: { customerId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({ tickets });
    } catch (error) {
      console.error('List support tickets error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/support/tickets/:id - get ticket detail and messages
  router.get('/tickets/:id', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: req.params.id, customerId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Tiket tidak ditemukan' });
      }

      res.json({
        ticket,
        messages: ticket.messages,
      });
    } catch (error) {
      console.error('Get ticket detail error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/support/tickets - create support ticket with initial message
  router.post('/tickets', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const { subject, category, priority, message, initialMessage } = req.body || {};

      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        return res.status(400).json({ error: 'Subjek tiket wajib diisi' });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      // Generate unique ticket number #TK-XXXX
      let ticketNumber = `#TK-${Math.floor(1000 + Math.random() * 9000)}`;
      let exists = await prisma.supportTicket.findUnique({ where: { ticketNumber } });
      while (exists) {
        ticketNumber = `#TK-${Math.floor(1000 + Math.random() * 9000)}`;
        exists = await prisma.supportTicket.findUnique({ where: { ticketNumber } });
      }

      const messageContent = (typeof message === 'string' && message.trim()) ||
        (typeof initialMessage === 'string' && initialMessage.trim()) ||
        '';

      const ticket = await prisma.supportTicket.create({
        data: {
          customerId,
          ticketNumber,
          subject: subject.trim(),
          category: category?.trim() || 'Umum',
          priority: priority?.trim() || 'normal',
          status: 'open',
          messages: messageContent
            ? {
                create: [
                  {
                    senderName: customer?.name || 'Client',
                    senderRole: 'client',
                    message: messageContent,
                  },
                ],
              }
            : undefined,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      // Dispatch real-time Telegram alert to Super Admin (non-blocking)
      notifyNewSupportTicket(ticket, customer, messageContent).catch((tgErr) => {
        console.warn('Failed to send Telegram ticket notification:', tgErr);
      });

      res.status(201).json({ ticket });
    } catch (error) {
      console.error('Create support ticket error:', error);
      res.status(500).json({ error: 'Gagal membuat tiket' });
    }
  });

  // POST /api/support/tickets/:id/reply - send client message to ticket
  router.post('/tickets/:id/reply', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const { message } = req.body || {};

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Pesan balasan wajib diisi' });
      }

      const ticket = await prisma.supportTicket.findFirst({
        where: { id: req.params.id, customerId },
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Tiket tidak ditemukan' });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      const newMessage = await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderName: customer?.name || 'Client',
          senderRole: 'client',
          message: message.trim(),
        },
      });

      // Update ticket's updatedAt timestamp
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
      });

      res.status(201).json({ message: newMessage });
    } catch (error) {
      console.error('Reply ticket error:', error);
      res.status(500).json({ error: 'Gagal mengirim pesan balasan' });
    }
  });

  // POST /api/support/tickets/:id/close - resolve / close ticket
  router.post('/tickets/:id/close', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: req.params.id, customerId },
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Tiket tidak ditemukan' });
      }

      const updatedTicket = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'resolved',
          updatedAt: new Date(),
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      res.json({ ticket: updatedTicket });
    } catch (error) {
      console.error('Close ticket error:', error);
      res.status(500).json({ error: 'Gagal menutup tiket' });
    }
  });

  return router;
};
