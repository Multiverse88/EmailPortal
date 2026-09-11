import request from 'supertest';
import app, { prisma } from '../src/app';
import jwt from 'jsonwebtoken';
import { encrypt } from '../src/lib/crypto';
import {
  extractEmailAddress,
  extractRootDomain,
  resolveAvatarMap,
  buildBrandedEmailHtml,
} from '../src/routes/email';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('Email Avatar and Branded Signature Integration', () => {
  let customer: any;
  let token: string;

  beforeAll(async () => {
    const ts = Date.now();
    customer = await prisma.customer.create({
      data: {
        name: 'PT Legal Sejahtera',
        personalEmail: `legal-${ts}@example.com`,
        mailboxAddress: `legal-${ts}@clienteasylegal.co.id`,
        passwordEnc: encrypt('dummy-pass'),
        status: 'active',
        avatarUrl: 'avatars/dummy-test-logo.png',
      },
    });

    token = jwt.sign(
      { id: customer.id, email: customer.mailboxAddress, type: 'customer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    try {
      await prisma.messageCache.deleteMany({
        where: { mailboxId: customer.id },
      });
      await prisma.customer.deleteMany({
        where: { id: customer.id },
      });
      await prisma.$disconnect();
    } catch {}
  });

  describe('Helper Functions', () => {
    it('extractEmailAddress correctly parses varied sender formats', () => {
      expect(extractEmailAddress('EasyLegal Portal <admin@clienteasylegal.co.id>')).toBe(
        'admin@clienteasylegal.co.id'
      );
      expect(extractEmailAddress('klien@perusahaan.com')).toBe('klien@perusahaan.com');
      expect(extractEmailAddress('"Budi Santoso" <budi@office.co.id>')).toBe('budi@office.co.id');
      expect(extractEmailAddress(null)).toBeNull();
    });

    it('extractRootDomain correctly strips mail and service subdomains to find root domain', () => {
      expect(extractRootDomain('email.hostinger.com')).toBe('hostinger.com');
      expect(extractRootDomain('hostinger.com')).toBe('hostinger.com');
      expect(extractRootDomain('mail.tokopedia.com')).toBe('tokopedia.com');
      expect(extractRootDomain('sub.mail.bca.co.id')).toBe('bca.co.id');
      expect(extractRootDomain('clienteasylegal.co.id')).toBe('clienteasylegal.co.id');
    });

    it('buildBrandedEmailHtml formats body and includes customer avatar URL and signature', () => {
      const html = buildBrandedEmailHtml({
        customer: {
          id: customer.id,
          name: customer.name,
          mailboxAddress: customer.mailboxAddress,
          avatarUrl: customer.avatarUrl,
        },
        bodyText: 'Halo,\n\nIni adalah pesan resmi legal.',
        portalUrl: 'https://clienteasylegal.co.id',
      });

      expect(html).toContain('https://clienteasylegal.co.id/api/settings/avatar/' + customer.id);
      expect(html).toContain(customer.name);
      expect(html).toContain(customer.mailboxAddress);
      expect(html).toContain('EasyLegal Verified Corporate Client');
      expect(html).toContain('Ini adalah pesan resmi legal.');
    });

    it('resolveAvatarMap resolves customer avatars, system admin logo, and external senders', async () => {
      const map = await resolveAvatarMap(
        prisma,
        [
          customer.mailboxAddress,
          'EasyLegal Portal <admin@clienteasylegal.co.id>',
          'user@gmail.com',
          'support@tokopedia.com',
          'billing@email.hostinger.com',
        ],
        customer.id
      );

      // Customer avatar
      expect(map.get(customer.mailboxAddress.toLowerCase())?.avatarUrl).toContain(
        `/api/settings/avatar/${customer.id}`
      );
      // System admin logo
      expect(map.get('admin@clienteasylegal.co.id')?.avatarUrl).toBe('/companion/el/el-avatar-kepala.png');
      expect(map.get('admin@clienteasylegal.co.id')?.fallbackAvatarUrl).toBeNull();

      // Public email (gmail): Gravatar with null fallback
      const gmailAvatar = map.get('user@gmail.com');
      expect(gmailAvatar?.avatarUrl).toContain('gravatar.com/avatar/');
      expect(gmailAvatar?.fallbackAvatarUrl).toBeNull();

      // Corporate domain (tokopedia): Gravatar with google favicon fallback
      const corpAvatar = map.get('support@tokopedia.com');
      expect(corpAvatar?.avatarUrl).toContain('gravatar.com/avatar/');
      expect(corpAvatar?.fallbackAvatarUrl).toContain('google.com/s2/favicons?domain=tokopedia.com');

      // Subdomain email (email.hostinger.com): maps to root domain favicon hostinger.com
      const hostingerAvatar = map.get('billing@email.hostinger.com');
      expect(hostingerAvatar?.avatarUrl).toContain('gravatar.com/avatar/');
      expect(hostingerAvatar?.fallbackAvatarUrl).toBe('https://www.google.com/s2/favicons?domain=hostinger.com&sz=128');
    });
  });

  describe('API Routes Integration', () => {
    let messageInbox: any;
    let messageSent: any;

    beforeAll(async () => {
      messageInbox = await prisma.messageCache.create({
        data: {
          mailboxId: customer.id,
          uid: `test-inbox-${Date.now()}`,
          folder: 'INBOX',
          subject: 'Pemberitahuan Sistem Resmi',
          sender: 'EasyLegal Portal <admin@clienteasylegal.co.id>',
          recipients: customer.mailboxAddress,
          snippet: 'Selamat datang di portal...',
          bodyText: 'Selamat datang di portal customer.',
          receivedAt: new Date(),
        },
      });

      messageSent = await prisma.messageCache.create({
        data: {
          mailboxId: customer.id,
          uid: `test-sent-${Date.now()}`,
          folder: 'Sent',
          subject: 'Dokumen Perjanjian',
          sender: customer.mailboxAddress,
          recipients: 'mitra@klien.com',
          snippet: 'Berikut lampiran berkas...',
          bodyText: 'Berikut lampiran berkas perjanjian.',
          bodyHtml: '<p>Berikut lampiran berkas perjanjian.</p>',
          receivedAt: new Date(),
        },
      });
    });

    it('GET /api/email enriches message list with senderAvatarUrl for admin sender', async () => {
      const res = await request(app)
        .get('/api/email?folder=INBOX')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const found = res.body.data.find((m: any) => m.id === messageInbox.id);
      expect(found).toBeDefined();
      expect(found.senderAvatarUrl).toBe('/companion/el/el-avatar-kepala.png');
    });

    it('GET /api/email/:uid enriches single message detail with senderAvatarUrl', async () => {
      const res = await request(app)
        .get(`/api/email/${messageInbox.uid}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.senderAvatarUrl).toBe('/companion/el/el-avatar-kepala.png');
    });

    it('POST /api/email/send generates branded HTML body with customer logo and signature', async () => {
      const res = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${token}`)
        .field('to', 'penerima@perusahaan-lain.com')
        .field('subject', 'Surat Kuasa Legal')
        .field('body', 'Berikut terlampir draf dokumen resmi kami.');

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();

      const createdMsg = await prisma.messageCache.findUnique({
        where: { id: res.body.id },
      });

      expect(createdMsg).toBeDefined();
      expect(createdMsg?.bodyHtml).toBeDefined();
      expect(createdMsg?.bodyHtml).toContain(`/api/settings/avatar/${customer.id}`);
      expect(createdMsg?.bodyHtml).toContain(customer.name);
      expect(createdMsg?.bodyHtml).toContain('EasyLegal Verified Corporate Client');
    });
  });
});
