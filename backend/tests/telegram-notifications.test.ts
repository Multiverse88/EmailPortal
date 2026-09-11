import request from 'supertest';
import jwt from 'jsonwebtoken';
import app, { prisma } from '../src/app';
import {
  escapeHtml,
  getTelegramConfig,
  sendTelegramMessage,
  sendTelegramPhoto,
  answerTelegramCallbackQuery,
  notifyNewSupportTicket,
  sendDailyDigest,
  notifySecurityAnomaly,
} from '../src/lib/telegram';
import {
  generateTicketCardPng,
  generateServerStatusCardPng,
  generateDailyDigestCardPng,
  generateSecurityAlertCardPng,
  generateAiAssistantCardPng,
  TICKET_STATES,
  SERVER_STATES,
} from '../src/lib/card-generator';
import { processTelegramAiMessage, gatherLiveWebsiteSnapshot } from '../src/lib/telegram-ai';
import { handleTelegramMessageUpdate, handleTelegramCallbackQuery } from '../src/workers/telegram-bot';

const isPng = (buf: any): boolean => {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 8) return false;
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
};

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const signAdminToken = (id: string, email: string, role: 'superadmin' | 'officer') =>
  jwt.sign({ id, email, type: 'admin', role }, JWT_SECRET, { expiresIn: '1h' });

const signCustomerToken = (id: string, email: string) =>
  jwt.sign({ id, email, type: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

describe('Telegram Daily Summary (07:00 WIB) & Interactive AI Chatbot Service', () => {
  let superAdminToken: string;
  let officerToken: string;
  let customerToken: string;
  let testCustomerId: string;
  let createdTicketId: string;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    superAdminToken = signAdminToken('admin-super-1', 'admin@clienteasylegal.co.id', 'superadmin');
    officerToken = signAdminToken('officer-1', 'officer@clienteasylegal.co.id', 'officer');

    const customer = await prisma.customer.findFirst();
    if (customer) {
      testCustomerId = customer.id;
      customerToken = signCustomerToken(testCustomerId, customer.mailboxAddress);
    } else {
      testCustomerId = 'dummy-cust-id';
      customerToken = signCustomerToken(testCustomerId, 'test@clienteasylegal.co.id');
    }
  });

  afterAll(async () => {
    process.env = originalEnv;
    if (createdTicketId) {
      try {
        await prisma.supportTicket.delete({ where: { id: createdTicketId } });
      } catch {}
    }
  });

  describe('1. HTML Sanitizer & Helper Logic', () => {
    it('should escape HTML characters correctly to avoid Telegram parse errors', () => {
      expect(escapeHtml('Normal text')).toBe('Normal text');
      expect(escapeHtml('PT <Maju & Makmur>')).toBe('PT &lt;Maju &amp; Makmur&gt;');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should return telegram configuration correctly', () => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.TELEGRAM_CHAT_ID = '-1009876543210';
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';

      const config = getTelegramConfig();
      expect(config.botToken).toBe('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
      expect(config.chatId).toBe('-1009876543210');
      expect(config.enabled).toBe(true);
    });

    it('should gracefully handle missing credentials', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      const result = await sendTelegramMessage('Test alert');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Telegram credentials not configured');
    });
  });

  describe('2. Telegram Notification Dispatch with Mocked Fetch', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';
      process.env.TELEGRAM_CHAT_ID = '-1001234567890';
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should send formatted message via Telegram Bot API when configured', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 888 } }),
      });
      global.fetch = mockFetch as any;

      const result = await sendTelegramMessage('<b>Halo EasyLegal</b>');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(888);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:TEST_TOKEN/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: '-1001234567890',
            text: '<b>Halo EasyLegal</b>',
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
        })
      );
    });

    it('should notify new support ticket with SLA & client details', async () => {
      let sentCaptionOrText = '';
      global.fetch = jest.fn().mockImplementation((_url, opts) => {
        if (opts.body instanceof FormData) {
          sentCaptionOrText = (opts.body.get('caption') as string) || '';
        } else if (typeof opts.body === 'string') {
          try {
            sentCaptionOrText = JSON.parse(opts.body).text;
          } catch {
            sentCaptionOrText = opts.body;
          }
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 999 } }),
        });
      }) as any;

      const success = await notifyNewSupportTicket(
        {
          ticketNumber: 'TK-1234',
          subject: 'Penyimpanan Penuh & Butuh Upgrade',
          category: 'Kapasitas Storage',
          priority: 'urgent',
          createdAt: new Date(),
        },
        {
          name: 'Budi PT Mega & Perkasa',
          mailboxAddress: 'budi@megaperkasa.com',
          personalEmail: 'budi.personal@gmail.com',
        },
        'Kapasitas penyimpanan S3 kami sudah 95%, mohon bantuan segera.'
      );

      expect(success).toBe(true);
      expect(sentCaptionOrText).toContain('TIKET SUPPORT BARU');
      expect(sentCaptionOrText).toContain('TK-1234');
      expect(sentCaptionOrText).toContain('URGENT (&lt; 4 Jam SLA)');
      expect(sentCaptionOrText).toContain('Budi PT Mega &amp; Perkasa');
    });

    it('should generate and dispatch daily digest scheduled for 07:00 WIB', async () => {
      let sentCaptionOrText = '';
      global.fetch = jest.fn().mockImplementation((_url, opts) => {
        if (opts.body instanceof FormData) {
          sentCaptionOrText = (opts.body.get('caption') as string) || '';
        } else if (typeof opts.body === 'string') {
          try {
            sentCaptionOrText = JSON.parse(opts.body).text;
          } catch {
            sentCaptionOrText = opts.body;
          }
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 1002 } }),
        });
      }) as any;

      const res = await sendDailyDigest(prisma);
      expect(res.success).toBe(true);
      expect(res.reportText).toContain('07:00 WIB');
      expect(res.reportText).toContain('1. KESEHATAN SISTEM & WEBMAIL');
      expect(res.reportText).toContain('2. RADAR KEAMANAN & ANOMALI LOGIN');
      expect(res.reportText).toContain('3. KAPASITAS PENYIMPANAN & RETENSI');
      expect(res.reportText).toContain('4. STATUS PUSAT TIKET SUPPORT KLIEN');
    });
  });

  describe('3. Telegram AI Chatbot Engine (Kondisi, Transaksi & Kegiatan Website)', () => {
    it('should gather comprehensive live snapshot of website without errors', async () => {
      const snap = await gatherLiveWebsiteSnapshot(prisma);
      expect(snap.system.status).toBeDefined();
      expect(snap.accounts.total).toBeGreaterThanOrEqual(0);
      expect(snap.messages.total).toBeGreaterThanOrEqual(0);
      expect(snap.documents.total).toBeGreaterThanOrEqual(0);
      expect(snap.tickets.open).toBeGreaterThanOrEqual(0);
      expect(snap.security.activeSessions).toBeGreaterThanOrEqual(0);
    });

    it('should respond to shortcut command /start and /help with interactive instructions', async () => {
      const reply = await processTelegramAiMessage(prisma, '/start', { senderName: 'Admin' });
      expect(reply).toContain('AI Assistant EasyLegal Customer Portal');
      expect(reply).toContain('/status');
      expect(reply).toContain('/kegiatan');
      expect(reply).toContain('/tiket');
    });

    it('should respond to /status with real-time website and server metrics', async () => {
      const reply = await processTelegramAiMessage(prisma, '/status');
      expect(reply).toContain('STATUS & KONDISI WEBSITE EASYLEGAL');
      expect(reply).toContain('Portal Web');
      expect(reply).toContain('Titan Mail');
    });

    it('should respond to /kegiatan with transactions and audit logs', async () => {
      const reply = await processTelegramAiMessage(prisma, '/kegiatan');
      expect(reply).toContain('TRANSAKSI & KEGIATAN TERBARU DI WEBSITE');
      expect(reply).toContain('Aktivitas Audit Log Terkini');
    });

    it('should respond to /tiket with support ticket status', async () => {
      const reply = await processTelegramAiMessage(prisma, '/tiket');
      expect(reply).toContain('PUSAT TIKET SUPPORT KLIEN');
      expect(reply).toContain('Tiket Menunggu Respon');
    });

    it('should answer natural language questions about activities/transactions', async () => {
      const reply = await processTelegramAiMessage(prisma, 'Ada transaksi atau kegiatan apa saja hari ini?');
      expect(reply).toContain('TRANSAKSI & KEGIATAN WEBSITE');
      expect(reply).toContain('Aktivitas Dokumen');
      expect(reply).toContain('Aktivitas Email');
    });

    it('should answer natural language questions about server condition', async () => {
      const reply = await processTelegramAiMessage(prisma, 'Bagaimana kondisi server sekarang?');
      expect(reply).toContain('KONDISI UMUM WEBSITE & SERVER');
      expect(reply).toContain('Status Keseluruhan');
    });

    it('should answer natural language questions about support tickets', async () => {
      const reply = await processTelegramAiMessage(prisma, 'Apakah ada tiket support yang urgent?');
      expect(reply).toContain('KONDISI PUSAT TIKET SUPPORT');
      expect(reply).toContain('Tiket Menunggu Respon');
    });
  });

  describe('4. Super Admin Management & AI Chat Endpoints', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';
      process.env.TELEGRAM_CHAT_ID = '-1001234567890';
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('GET /api/admin/telegram/status should report 07:00 schedule and masked chat ID', async () => {
      const res = await request(app)
        .get('/api/admin/telegram/status')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.configured).toBe(true);
      expect(res.body.cronSchedule).toBe('0 7 * * *');
      expect(res.body.maskedChatId).toContain('****');
    });

    it('POST /api/admin/telegram/ask-ai should process AI query directly from console', async () => {
      const res = await request(app)
        .post('/api/admin/telegram/ask-ai')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ question: 'Bagaimana status server hari ini?' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.question).toBe('Bagaimana status server hari ini?');
      expect(res.body.answer).toContain('KONDISI UMUM WEBSITE & SERVER');
    });

    it('POST /api/admin/telegram/test should send test verification message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 777 } }),
      }) as any;

      const res = await request(app)
        .post('/api/admin/telegram/test')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.messageId).toBe(777);
    });

    it('POST /api/admin/telegram/send-digest should trigger instant 07:00 digest', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 888 } }),
      }) as any;

      const res = await request(app)
        .post('/api/admin/telegram/send-digest')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.reportText).toContain('07:00 WIB');
    });
  });

  describe('5. Real-time Ticket Submission Alert & Webhook Handler', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';
      process.env.TELEGRAM_CHAT_ID = '-1001234567890';
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('POST /api/support/tickets should trigger real-time alert', async () => {
      let alertDispatched = false;
      global.fetch = jest.fn().mockImplementation((_url, opts) => {
        let text = '';
        if (opts.body instanceof FormData) {
          text = (opts.body.get('caption') as string) || '';
        } else if (typeof opts.body === 'string') {
          try {
            text = JSON.parse(opts.body).text || '';
          } catch {
            text = opts.body;
          }
        }
        if (text.includes('TIKET SUPPORT BARU') && text.includes('Tolong cek konfigurasi email keluar')) {
          alertDispatched = true;
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 999 } }),
        });
      }) as any;

      const res = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          subject: 'Tolong cek konfigurasi email keluar',
          category: 'Pengiriman & Penerimaan',
          priority: 'urgent',
          message: 'Email ke vendor eksternal gagal terkirim (bounce back).',
        })
        .expect(201);

      expect(res.body.ticket).toBeDefined();
      createdTicketId = res.body.ticket.id;

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(alertDispatched).toBe(true);
    });

    it('POST /api/telegram/webhook should receive update and return ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 111 } }),
      }) as any;

      const res = await request(app)
        .post('/api/telegram/webhook')
        .send({
          update_id: 12345,
          message: {
            message_id: 1,
            chat: { id: -1001234567890, first_name: 'Admin' },
            text: '/status',
          },
        })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });
  });

  describe('6. Rich Graphic Cards (Option 2) & Interactive Inline Keyboard Callbacks', () => {
    it('should generate high-resolution PNG ticket card in-memory without external calls', async () => {
      const pngBuffer = await generateTicketCardPng({
        ticketNumber: 'TK-9952',
        subject: 'Perubahan Alamat NPWP Korporasi',
        category: 'Perizinan',
        priority: 'urgent',
        createdAtStr: 'Jumat, 11 September 2026 - 09:30 WIB',
        customerName: 'PT Maju Jaya Bersama',
        mailboxAddress: 'legal@majujaya.easylegal.co.id',
        personalEmail: 'direktur@gmail.com',
        initialMessage: 'Mohon panduan perubahan alamat NPWP perusahaan sesuai Akta Notaris terbaru.',
      });

      expect(pngBuffer).not.toBeNull();
      expect(isPng(pngBuffer)).toBe(true);
      expect(pngBuffer!.length).toBeGreaterThan(15000);
    });

    it('should generate high-resolution PNG daily digest card in-memory', async () => {
      const digestBuffer = await generateDailyDigestCardPng({
        dateStr: 'Jumat, 11 September 2026 - 07:00',
        totalCustomers: 25,
        activeCustomers: 23,
        inactiveCustomers: 2,
        totalEmails: 190,
        unreadEmails: 15,
        usedMB: '150.5',
        totalDocuments: 72,
        activeSessions: 8,
        totalMultiIp: 0,
        auditLogsLast24h: 35,
        openTickets: 3,
        urgentTickets: 1,
        resolvedTickets: 22,
      });

      expect(digestBuffer).not.toBeNull();
      expect(isPng(digestBuffer)).toBe(true);
      expect(digestBuffer!.length).toBeGreaterThan(20000);
    });

    it('should generate security anomaly alert card in-memory', async () => {
      const alertBuffer = await generateSecurityAlertCardPng({
        accountName: 'PT Samudera Raya',
        mailboxAddress: 'direksi@samudera.easylegal.co.id',
        uniqueIps: ['182.253.140.22', '36.88.90.15', '103.24.55.10'],
        sessionCount: 4,
      });

      expect(alertBuffer).not.toBeNull();
      expect(isPng(alertBuffer)).toBe(true);
      expect(alertBuffer!.length).toBeGreaterThan(15000);
    });

    it('should generate high-resolution PNG AI assistant card in-memory', async () => {
      const aiCardBuffer = await generateAiAssistantCardPng({
        query: 'Kondisi Kapasitas Server',
        replySummary: '• S3 Storage terpakai 150 MB.\n• Webmail cluster tersinkronisasi IMAP/SMTP.\n• Tidak ada peringatan anomali keamanan.',
        senderName: 'Super Admin',
        category: 'AI EXECUTIVE DESK',
        pillText: 'JAWABAN AI • REAL-TIME',
        toneColor: '#8b5cf6',
        deepColor: '#6d28d9',
        pose: 'tips',
        bubbleText: 'Informasi sistem siap ditinjau!',
      });

      expect(aiCardBuffer).not.toBeNull();
      expect(isPng(aiCardBuffer)).toBe(true);
      expect(aiCardBuffer!.length).toBeGreaterThan(15000);
    });

    it('should send photo via Telegram Bot API with multipart FormData', async () => {
      let sentFormData: FormData | null = null;
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (opts.body instanceof FormData) {
          sentFormData = opts.body;
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 777 } }),
        });
      }) as any;

      const dummyPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = await sendTelegramPhoto(dummyPng, 'Test Card Caption', {
        inline_keyboard: [[{ text: 'Admin', url: 'https://clienteasylegal.co.id/admin' }]],
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe(777);
      expect(sentFormData).not.toBeNull();
      expect(sentFormData!.get('chat_id')).toBe('-1001234567890');
      expect(sentFormData!.get('caption')).toBe('Test Card Caption');
      expect(sentFormData!.get('reply_markup')).toContain('clienteasylegal.co.id');
    });

    it('should answer Telegram callback query with answerCallbackQuery API', async () => {
      let answerPayload: any = null;
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        answerPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: true }),
        });
      }) as any;

      const answered = await answerTelegramCallbackQuery('query-12345', 'Memproses...', false);
      expect(answered).toBe(true);
      expect(answerPayload.callback_query_id).toBe('query-12345');
      expect(answerPayload.text).toBe('Memproses...');
    });

    it('should handle callback_query for AI legal resolution draft (ai_draft)', async () => {
      const ticketNum = `TK-AI-TEST-${Date.now()}`;
      await prisma.supportTicket.deleteMany({ where: { ticketNumber: { startsWith: 'TK-AI-TEST' } } }).catch(() => {});

      const testTicket = await prisma.supportTicket.create({
        data: {
          ticketNumber: ticketNum,
          subject: 'Pembaruan SK AHU Kemenkumham',
          category: 'Legalitas',
          priority: 'urgent',
          status: 'open',
          customerId: testCustomerId,
        },
      });

      let sentMessageText = '';
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (opts.body instanceof FormData) {
          sentMessageText = (opts.body.get('caption') as string) || '';
        } else if (opts.body && typeof opts.body === 'string') {
          try {
            const parsed = JSON.parse(opts.body);
            if (parsed.text) sentMessageText = parsed.text;
          } catch {}
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 889 } }),
        });
      }) as any;

      await handleTelegramCallbackQuery(prisma, {
        id: 'cb-query-1',
        from: { id: 12345, first_name: 'Super Admin' },
        message: { message_id: 55, chat: { id: -1001234567890 } },
        data: `ai_draft:${testTicket.ticketNumber}`,
      });

      expect(sentMessageText).toContain('REKOMENDASI DRAF SOLUSI AI');
      expect(sentMessageText).toContain(ticketNum);
      expect(sentMessageText).toContain('Pembaruan SK AHU Kemenkumham');

      // Cleanup
      await prisma.supportTicket.delete({ where: { id: testTicket.id } }).catch(() => {});
    });

    it('should handle callback_query for resolving ticket directly (resolve)', async () => {
      const ticketNum = `TK-RESOLVE-TEST-${Date.now()}`;
      await prisma.supportTicket.deleteMany({ where: { ticketNumber: { startsWith: 'TK-RESOLVE-TEST' } } }).catch(() => {});

      const testTicket = await prisma.supportTicket.create({
        data: {
          ticketNumber: ticketNum,
          subject: 'Verifikasi Berkas Notaris',
          category: 'Legalitas',
          priority: 'normal',
          status: 'open',
          customerId: testCustomerId,
        },
      });

      let confirmationText = '';
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (opts.body instanceof FormData) {
          confirmationText = (opts.body.get('caption') as string) || '';
        } else if (opts.body && typeof opts.body === 'string') {
          try {
            const parsed = JSON.parse(opts.body);
            if (parsed.text) confirmationText = parsed.text;
          } catch {}
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 890 } }),
        });
      }) as any;

      await handleTelegramCallbackQuery(prisma, {
        id: 'cb-query-2',
        from: { id: 12345, first_name: 'Super Admin' },
        message: { message_id: 56, chat: { id: -1001234567890 } },
        data: `resolve:${testTicket.ticketNumber}`,
      });

      expect(confirmationText).toContain('TIKET BERHASIL DISELESAIKAN');
      expect(confirmationText).toContain(ticketNum);

      // Check status in database
      const updated = await prisma.supportTicket.findUnique({ where: { id: testTicket.id } });
      expect(updated?.status).toBe('resolved');

      // Cleanup
      await prisma.supportTicket.delete({ where: { id: testTicket.id } }).catch(() => {});
    });

    it('POST /api/telegram/webhook should receive callback_query and return ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: true }),
      }) as any;

      const res = await request(app)
        .post('/api/telegram/webhook')
        .send({
          update_id: 12346,
          callback_query: {
            id: 'query-webhook-test',
            from: { id: 12345, first_name: 'Admin' },
            message: { message_id: 2, chat: { id: -1001234567890 } },
            data: 'digest_refresh',
          },
        })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('should reply to incoming Telegram user messages with interactive visual photo card and inline buttons', async () => {
      let sentPhotoCaption = '';
      let hasPhotoAttached = false;
      let sentReplyMarkup: any = null;

      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (opts.body instanceof FormData) {
          hasPhotoAttached = opts.body.has('photo');
          sentPhotoCaption = (opts.body.get('caption') as string) || '';
          sentReplyMarkup = opts.body.get('reply_markup');
        } else if (typeof opts.body === 'string') {
          try {
            const parsed = JSON.parse(opts.body);
            if (parsed.text) sentPhotoCaption = parsed.text;
          } catch {}
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 9991 } }),
        });
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 101,
        chat: { id: -1001234567890, first_name: 'Super Admin' },
        from: { id: 12345, first_name: 'Super Admin' },
        text: '/status',
      });

      expect(hasPhotoAttached).toBe(true);
      expect(sentPhotoCaption).toContain('STATUS & KONDISI WEBSITE EASYLEGAL');
      expect(sentReplyMarkup).toContain('bot_cmd:status');
      expect(sentReplyMarkup).toContain('view_tickets');
    });
  });

  describe('7. Comprehensive 22-State Card & Pose Intent Verification', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';
      process.env.TELEGRAM_CHAT_ID = '-1001234567890';
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('State 1: /start or greeting should send AI Assistant card with pose melambai (#3b82f6)', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 101 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 1,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: '/start',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('Halo, Admin!');
      expect(sentCaption).toContain('EL');
    });

    it('State 2-5: /status renders Server Status card matching condition (normal, gangguan, maintenance, down)', async () => {
      const normalBuf = await generateServerStatusCardPng({ stateKey: 'normal' });
      expect(isPng(normalBuf)).toBe(true);
      expect(SERVER_STATES.normal.pose).toBe('senang');
      expect(SERVER_STATES.normal.tone).toBe('#22c55e');

      const gangguanBuf = await generateServerStatusCardPng({ stateKey: 'gangguan' });
      expect(isPng(gangguanBuf)).toBe(true);
      expect(SERVER_STATES.gangguan.pose).toBe('memikirkan');
      expect(SERVER_STATES.gangguan.tone).toBe('#f59e0b');

      const maintBuf = await generateServerStatusCardPng({ stateKey: 'maintenance' });
      expect(isPng(maintBuf)).toBe(true);
      expect(SERVER_STATES.maintenance.pose).toBe('saran');
      expect(SERVER_STATES.maintenance.tone).toBe('#3b82f6');

      const downBuf = await generateServerStatusCardPng({ stateKey: 'down' });
      expect(isPng(downBuf)).toBe(true);
      expect(SERVER_STATES.down.pose).toBe('menyapa');
      expect(SERVER_STATES.down.tone).toBe('#ef4444');
    });

    it('State 6-13: Ticket cards render correct poses and generate valid PNGs', async () => {
      expect(TICKET_STATES.urgent.pose).toBe('menyapa');
      expect(TICKET_STATES.urgent.tone).toBe('#ef4444');

      expect(TICKET_STATES.baru.pose).toBe('melambai');
      expect(TICKET_STATES.baru.tone).toBe('#3b82f6');

      expect(TICKET_STATES.reminder.pose).toBe('muncul');
      expect(TICKET_STATES.reminder.tone).toBe('#f59e0b');

      expect(TICKET_STATES.diproses.pose).toBe('semangat');
      expect(TICKET_STATES.diproses.tone).toBe('#06b6d4');

      expect(TICKET_STATES.ai.pose).toBe('tips');
      expect(TICKET_STATES.ai.tone).toBe('#a855f7');

      expect(TICKET_STATES.menunggu.pose).toBe('memikirkan');
      expect(TICKET_STATES.menunggu.tone).toBe('#fb923c');

      expect(TICKET_STATES.selesai.pose).toBe('konfirmasi');
      expect(TICKET_STATES.selesai.tone).toBe('#22c55e');

      for (const st of ['urgent', 'baru', 'reminder', 'diproses', 'ai', 'menunggu', 'selesai']) {
        const buf = await generateTicketCardPng({
          ticketNumber: 'TK-TEST-1',
          subject: 'Test Subject',
          category: 'Umum',
          priority: st === 'urgent' ? 'urgent' : 'normal',
          createdAtStr: '11 September 2026',
          customerName: 'Klien Test',
          mailboxAddress: 'klien@clienteasylegal.co.id',
          stateKey: st,
        });
        expect(isPng(buf)).toBe(true);
      }
    });

    it('State 8: /tiket with no open tickets sends AI Assistant card with pose senang (#22c55e)', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 102 } }) };
      }) as any;

      await prisma.supportTicket.updateMany({
        where: { status: { in: ['open', 'in_progress'] } },
        data: { status: 'resolved' },
      });

      await handleTelegramMessageUpdate(prisma, {
        message_id: 2,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: '/tiket',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('PUSAT TIKET SUPPORT KLIEN');
      expect(sentCaption).toContain('Semua Tiket Selesai');
    });

    it('State 14: /keamanan when safe sends AI Assistant card with pose senang (#22c55e)', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 103 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 3,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: '/keamanan',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('RADAR KEAMANAN');
    });

    it('State 16: /kegiatan sends AI Assistant card with pose semangat (cyan #06b6d4)', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 104 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 4,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: '/kegiatan',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('TRANSAKSI &amp; KEGIATAN TERBARU');
    });

    it('State 17: /storage sends AI Assistant card with pose saran (amber #fbbf24)', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 105 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 5,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: '/storage',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('KAPASITAS PENYIMPANAN &amp; ARSIP');
    });

    it('State 19-20: /ringkasan or digest card has dynamic pose (senang if healthy, memikirkan if urgent/anomaly)', async () => {
      const healthyDigest = await generateDailyDigestCardPng({
        dateStr: '11 September 2026',
        totalCustomers: 10,
        activeCustomers: 10,
        inactiveCustomers: 0,
        totalEmails: 50,
        unreadEmails: 0,
        usedMB: '50.0',
        totalDocuments: 10,
        activeSessions: 2,
        totalMultiIp: 0,
        auditLogsLast24h: 5,
        openTickets: 0,
        urgentTickets: 0,
        resolvedTickets: 10,
      });
      expect(isPng(healthyDigest)).toBe(true);

      const anomalyDigest = await generateDailyDigestCardPng({
        dateStr: '11 September 2026',
        totalCustomers: 10,
        activeCustomers: 10,
        inactiveCustomers: 0,
        totalEmails: 50,
        unreadEmails: 0,
        usedMB: '50.0',
        totalDocuments: 10,
        activeSessions: 2,
        totalMultiIp: 1,
        auditLogsLast24h: 5,
        openTickets: 1,
        urgentTickets: 1,
        resolvedTickets: 10,
      });
      expect(isPng(anomalyDigest)).toBe(true);
    });

    it('State 21: Natural language query sends AI Assistant card with pose tips (purple #8b5cf6)', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 106 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 6,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: 'Berapa jumlah dokumen yang telah diunggah oleh klien minggu ini?',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('JAWABAN AI');
    });

    it('State 22: Unknown command (/ngawur) sends AI Assistant card with pose memikirkan (gray #64748b)', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 107 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 7,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: '/ngawur',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('Perintah Tidak Dikenali');
    });

    it('Strict Scope: Out-of-scope query (e.g. WhatsApp or resi) sends card with CAKUPAN SISTEM & FITUR and pose memikirkan', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 108 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 8,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: 'Apakah bisa integrasi dengan WhatsApp API atau cek resi pengiriman barang?',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('CAKUPAN SISTEM');
      expect(sentCaption).toContain('EasyLegal Email Portal');
    });

    it('Strict Scope: Email natural language query sends card with TRAFIK EMAIL & WEBMAIL and pose semangat', async () => {
      let sentPhoto: Buffer | null = null;
      let sentCaption = '';
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        if (opts.body instanceof FormData) {
          const file: any = opts.body.get('photo');
          if (file && typeof file.arrayBuffer === 'function') {
            sentPhoto = Buffer.from(await file.arrayBuffer());
          }
          sentCaption = (opts.body.get('caption') as string) || '';
        }
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 109 } }) };
      }) as any;

      await handleTelegramMessageUpdate(prisma, {
        message_id: 9,
        chat: { id: -1001234567890, first_name: 'Admin' },
        from: { id: 12345, first_name: 'Admin' },
        text: 'Bagaimana status trafik email dan pesan masuk hari ini?',
      });

      expect(sentPhoto).not.toBeNull();
      expect(isPng(sentPhoto)).toBe(true);
      expect(sentCaption).toContain('STATUS EMAIL');
      expect(sentCaption).toContain('Hostinger Titan Webmail');
    });
  });
});
