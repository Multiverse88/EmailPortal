import request from 'supertest';
import jwt from 'jsonwebtoken';
import app, { prisma } from '../src/app';
import {
  escapeHtml,
  getTelegramConfig,
  sendTelegramMessage,
  notifyNewSupportTicket,
  sendDailyDigest,
  notifySecurityAnomaly,
} from '../src/lib/telegram';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const signAdminToken = (id: string, email: string, role: 'superadmin' | 'officer') =>
  jwt.sign({ id, email, type: 'admin', role }, JWT_SECRET, { expiresIn: '1h' });

const signCustomerToken = (id: string, email: string) =>
  jwt.sign({ id, email, type: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

describe('Telegram Daily Summary & Support Ticket Alert Service', () => {
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
      let sentBody = '';
      global.fetch = jest.fn().mockImplementation((_url, opts) => {
        sentBody = JSON.parse(opts.body).text;
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 999 } }),
        });
      }) as any;

      const success = await notifyNewSupportTicket(
        {
          ticketNumber: '#TK-1234',
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
      expect(sentBody).toContain('TIKET SUPPORT BARU');
      expect(sentBody).toContain('#TK-1234');
      expect(sentBody).toContain('URGENT (&lt; 4 Jam SLA)');
      expect(sentBody).toContain('Budi PT Mega &amp; Perkasa');
      expect(sentBody).toContain('Kapasitas penyimpanan S3 kami sudah 95%');
    });

    it('should send security anomaly alert when multi-IP detected', async () => {
      let sentBody = '';
      global.fetch = jest.fn().mockImplementation((_url, opts) => {
        sentBody = JSON.parse(opts.body).text;
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 1001 } }),
        });
      }) as any;

      const success = await notifySecurityAnomaly({
        accountName: 'PT Legalita',
        mailboxAddress: 'direksi@legalita.co.id',
        uniqueIps: ['103.14.22.1', '182.1.23.4'],
        sessionCount: 2,
      });

      expect(success).toBe(true);
      expect(sentBody).toContain('SECURITY RADAR ALERT');
      expect(sentBody).toContain('103.14.22.1, 182.1.23.4');
      expect(sentBody).toContain('direksi@legalita.co.id');
    });

    it('should generate and dispatch comprehensive daily health & security digest', async () => {
      let sentBody = '';
      global.fetch = jest.fn().mockImplementation((_url, opts) => {
        sentBody = JSON.parse(opts.body).text;
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 1002 } }),
        });
      }) as any;

      const res = await sendDailyDigest(prisma);
      expect(res.success).toBe(true);
      expect(res.reportText).toContain('LAPORAN HARIAN');
      expect(res.reportText).toContain('1. KESEHATAN SISTEM & WEBMAIL');
      expect(res.reportText).toContain('2. RADAR KEAMANAN & ANOMALI LOGIN');
      expect(res.reportText).toContain('3. KAPASITAS PENYIMPANAN & RETENSI');
      expect(res.reportText).toContain('4. STATUS PUSAT TIKET SUPPORT KLIEN');
      expect(res.reportText).toContain('Hot Storage S3');
      expect(res.reportText).toContain('Zero-Leakage');
    });
  });

  describe('3. Super Admin Telegram Management Endpoints', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';
      process.env.TELEGRAM_CHAT_ID = '-1001234567890';
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('GET /api/admin/telegram/status should enforce Super Admin authorization', async () => {
      // 401 unauthenticated
      await request(app).get('/api/admin/telegram/status').expect(401);

      // 403 officer
      await request(app)
        .get('/api/admin/telegram/status')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(403);

      // 403 customer
      await request(app)
        .get('/api/admin/telegram/status')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      // 200 superadmin
      const res = await request(app)
        .get('/api/admin/telegram/status')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.configured).toBe(true);
      expect(res.body.enabled).toBe(true);
      expect(res.body.maskedChatId).toContain('****');
      expect(res.body.cronSchedule).toBe('0 8 * * *');
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
      expect(res.body.message).toContain('berhasil terkirim');
    });

    it('POST /api/admin/telegram/send-digest should trigger daily digest on demand', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 888 } }),
      }) as any;

      const res = await request(app)
        .post('/api/admin/telegram/send-digest')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.reportText).toContain('LAPORAN HARIAN');
    });
  });

  describe('4. Real-time Trigger on New Support Ticket Submission', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';
      process.env.TELEGRAM_CHAT_ID = '-1001234567890';
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('POST /api/support/tickets should dispatch Telegram alert in background', async () => {
      let alertDispatched = false;
      global.fetch = jest.fn().mockImplementation((_url, opts) => {
        const body = JSON.parse(opts.body).text;
        if (body.includes('TIKET SUPPORT BARU') && body.includes('Tolong cek konfigurasi email')) {
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
      expect(res.body.ticket.ticketNumber).toMatch(/^#TK-\d{4}$/);
      createdTicketId = res.body.ticket.id;

      // Allow background microtask to trigger fetch
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(alertDispatched).toBe(true);
    });
  });
});
