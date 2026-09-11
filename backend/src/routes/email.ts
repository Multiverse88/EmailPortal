import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { SyncWorker } from '../workers/sync';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { sanitizeHtml, toSnippet } from '../lib/sanitize';
import { decrypt } from '../lib/crypto';
import { sendMail, smtpConfigured } from '../lib/mail';
import { checkStorageQuota } from '../lib/quota';
import {
  fetchMessageAttachment,
  isMailApiConfigured,
  resolveResourceId,
  sendViaApi,
} from '../lib/hostinger';
import {
  inferAttachmentMimeType,
  isInlinePreviewMimeType,
  previewResponseMimeType,
} from '../lib/attachments';

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || './storage');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const upload = multer({
  dest: STORAGE_DIR,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

export const FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Trash'] as const;

export function extractEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/<([^>]+)>/) || raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].trim().toLowerCase() : raw.trim().toLowerCase();
}

export interface ResolvedAvatar {
  avatarUrl: string;
  fallbackAvatarUrl: string | null;
}

export function isPublicEmailDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (
    d.startsWith('yahoo.') ||
    d.startsWith('hotmail.') ||
    d.startsWith('outlook.') ||
    d.startsWith('live.') ||
    d.startsWith('msn.')
  ) {
    return true;
  }
  const publicList = new Set([
    'gmail.com',
    'googlemail.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'aol.com',
    'zoho.com',
    'zoho.in',
    'proton.me',
    'protonmail.com',
    'tutanota.com',
    'tuta.com',
    'mail.com',
    'email.com',
    'gmx.com',
    'gmx.net',
    'gmx.de',
    'yandex.com',
    'yandex.ru',
    'fastmail.com',
    'hey.com',
  ]);
  return publicList.has(d);
}

export function extractRootDomain(domain: string): string {
  const clean = domain.toLowerCase().trim();
  const parts = clean.split('.');
  if (parts.length <= 2) return clean;
  const secondLast = parts[parts.length - 2];
  const tld2 = new Set(['co', 'or', 'ac', 'go', 'biz', 'com', 'net', 'mil', 'edu', 'sch', 'my', 'org']);
  if (parts.length >= 3 && tld2.has(secondLast)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export async function resolveAvatarMap(
  prisma: PrismaClient,
  emailAddresses: (string | null | undefined)[],
  currentCustomerId?: string
): Promise<Map<string, ResolvedAvatar>> {
  const map = new Map<string, ResolvedAvatar>();
  const cleanEmails = Array.from(
    new Set(emailAddresses.map(extractEmailAddress).filter(Boolean))
  ) as string[];

  // 1. System/Admin emails -> Official EasyLegal Logo
  for (const email of cleanEmails) {
    if (
      email === 'admin@clienteasylegal.co.id' ||
      email.includes('admin@clienteasylegal') ||
      email === 'support@clienteasylegal.co.id'
    ) {
      map.set(email, {
        avatarUrl: '/companion/el/el-avatar-kepala.png',
        fallbackAvatarUrl: null,
      });
    }
  }

  // 2. Query matching Customers with avatars
  if (cleanEmails.length > 0) {
    const customers = await prisma.customer.findMany({
      where: {
        mailboxAddress: { in: cleanEmails },
        avatarUrl: { not: null },
      },
      select: { id: true, mailboxAddress: true, updatedAt: true },
    });

    for (const c of customers) {
      map.set(c.mailboxAddress.toLowerCase(), {
        avatarUrl: `/api/settings/avatar/${c.id}?v=${new Date(c.updatedAt).getTime()}`,
        fallbackAvatarUrl: null,
      });
    }
  }

  // 3. Current customer avatar if requested
  if (currentCustomerId) {
    const current = await prisma.customer.findUnique({
      where: { id: currentCustomerId },
      select: { id: true, mailboxAddress: true, avatarUrl: true, updatedAt: true },
    });
    if (current?.avatarUrl) {
      const url = `/api/settings/avatar/${current.id}?v=${new Date(current.updatedAt).getTime()}`;
      map.set(current.mailboxAddress.toLowerCase(), {
        avatarUrl: url,
        fallbackAvatarUrl: null,
      });
      map.set('__CURRENT_USER__', {
        avatarUrl: url,
        fallbackAvatarUrl: null,
      });
    }
  }

  // 4. External / Public & Corporate Domain Avatars (Gravatar + Company Domain Favicon)
  for (const email of cleanEmails) {
    if (map.has(email)) continue;

    const parts = email.split('@');
    const domain = parts[1]?.toLowerCase();
    if (!domain) continue;

    const hash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
    // Using d=mp (Mystery Person default image) ensures Gravatar returns HTTP 200 rather than HTTP 404, preventing browser ORB & network errors
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=128&d=mp`;

    if (isPublicEmailDomain(domain)) {
      // Public email (@gmail.com, @yahoo.com, etc.): Gravatar, fallback to initials
      map.set(email, {
        avatarUrl: gravatarUrl,
        fallbackAvatarUrl: null,
      });
    } else if (domain !== 'clienteasylegal.co.id') {
      // Corporate / Company domain (@tokopedia.com, @bca.co.id, @hostinger.com, etc.):
      // Resolve to root domain for favicon so subdomains (like email.hostinger.com) resolve to root domain favicon (hostinger.com)
      const rootDomain = extractRootDomain(domain);
      const domainFaviconUrl = `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`;
      map.set(email, {
        avatarUrl: gravatarUrl,
        fallbackAvatarUrl: domainFaviconUrl,
      });
    }
  }

  return map;
}

export function buildBrandedEmailHtml(opts: {
  customer: { id: string; name: string; mailboxAddress: string; avatarUrl: string | null };
  bodyText: string;
  portalUrl: string;
}): string {
  const rawText = opts.bodyText || '';
  const escapedText = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const paragraphs = escapedText
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const avatarSrc = opts.customer.avatarUrl
    ? `${opts.portalUrl}/api/settings/avatar/${opts.customer.id}`
    : `${opts.portalUrl}/companion/el/el-avatar-kepala.png`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px;">
      <div style="margin-bottom: 24px;">
        ${paragraphs || `<p style="margin: 0;">${escapedText.replace(/\n/g, '<br/>')}</p>`}
      </div>

      <!-- EasyLegal Corporate Signature Block -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%;">
        <tr>
          <td style="width: 54px; vertical-align: middle; padding-right: 14px;">
            <img src="${avatarSrc}" alt="${opts.customer.name}" width="50" height="50" style="width: 50px; height: 50px; border-radius: 10px; object-fit: contain; border: 1px solid #e2e8f0; display: block; background-color: #ffffff;" />
          </td>
          <td style="vertical-align: middle;">
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.3;">
              ${opts.customer.name}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px; line-height: 1.4;">
              <a href="mailto:${opts.customer.mailboxAddress}" style="color: #0284c7; text-decoration: none;">${opts.customer.mailboxAddress}</a>
            </div>
            <div style="margin-top: 6px; display: inline-block; font-size: 11px; font-weight: 600; color: #0369a1; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; padding: 2px 8px;">
              EasyLegal Verified Corporate Client
            </div>
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}

export default (prisma: PrismaClient, syncWorker?: SyncWorker) => {
  const router = Router();

  // POST /api/email/sync - Trigger on-demand sync from Hostinger IMAP
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const mailboxId = req.user!.id;
      if (syncWorker) {
        const result = await syncWorker.syncCustomerMailbox(mailboxId);
        return res.json({ success: true, ...result });
      }
      res.json({ success: true, synced: 0 });
    } catch (error: any) {
      console.warn('Manual sync warning for customer', req.user?.id, error.message);
      res.status(200).json({ success: false, warning: error.message || 'Gagal sinkronisasi IMAP' });
    }
  });

  // FR-11: folder list with unread counts.
  router.get('/folders', async (req: Request, res: Response) => {
    try {
      const mailboxId = req.user!.id;
      const folders: Array<{ folder: string; total: number; unread: number }> = await Promise.all(
        FOLDERS.map(async (folder) => {
          const where = { mailboxId, folder, isDeleted: folder === 'Trash' };
          const [total, unread] = await Promise.all([
            prisma.messageCache.count({ where }),
            prisma.messageCache.count({ where: { ...where, isRead: false } }),
          ]);
          return { folder, total, unread };
        })
      );
      const starredCount = await prisma.messageCache.count({
        where: { mailboxId, isStarred: true, isDeleted: false },
      });
      folders.push({ folder: 'Starred', total: starredCount, unread: 0 });
      res.json({ data: folders });
    } catch (error) {
      console.error('Folders error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // FR-16: list + search within a folder.
  router.get('/', async (req: Request, res: Response) => {
    try {
      const mailboxId = req.user!.id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const folder = (req.query.folder as string) || 'INBOX';
      const q = (req.query.q as string)?.trim();

      const where: any = folder === 'Starred'
        ? { mailboxId, isStarred: true, isDeleted: false }
        : { mailboxId, folder, isDeleted: folder === 'Trash' };
      if (q) {
        where.OR = [
          { subject: { contains: q } },
          { sender: { contains: q } },
          { snippet: { contains: q } },
          { bodyText: { contains: q } },
        ];
      }

      const [messages, total] = await Promise.all([
        prisma.messageCache.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { receivedAt: 'desc' },
          select: {
            id: true, uid: true, folder: true, subject: true, sender: true,
            recipients: true, snippet: true, isRead: true, isStarred: true, receivedAt: true,
            attachments: { select: { id: true, filename: true, mimeType: true, size: true } },
          },
        }),
        prisma.messageCache.count({ where }),
      ]);

      const addressesToResolve = messages.map((m) =>
        folder === 'Sent' ? (m.recipients?.split(',')[0] || m.sender) : m.sender
      );
      const avatarMap = await resolveAvatarMap(prisma, addressesToResolve, mailboxId);

      const enrichedMessages = messages.map((m) => {
        const targetAddress = folder === 'Sent' ? (m.recipients?.split(',')[0] || m.sender) : m.sender;
        const clean = extractEmailAddress(targetAddress);
        const avatarInfo = clean ? avatarMap.get(clean) : null;
        let senderAvatarUrl = avatarInfo ? avatarInfo.avatarUrl : null;
        let fallbackAvatarUrl = avatarInfo ? avatarInfo.fallbackAvatarUrl : null;
        if (!senderAvatarUrl && folder === 'Sent') {
          const currentInfo = avatarMap.get('__CURRENT_USER__');
          senderAvatarUrl = currentInfo ? currentInfo.avatarUrl : null;
          fallbackAvatarUrl = currentInfo ? currentInfo.fallbackAvatarUrl : null;
        }
        return {
          ...m,
          senderAvatarUrl,
          fallbackAvatarUrl,
        };
      });

      res.json({
        data: enrichedMessages,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
    } catch (error) {
      console.error('List emails error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // FR-14: compose / reply / forward, with attachments.
  router.post('/send', upload.array('attachments', 5), async (req: Request, res: Response) => {
    try {
      const mailboxId = req.user!.id;
      const { to, cc, subject, body } = req.body ?? {};
      if (!to?.trim()) return res.status(400).json({ error: 'Penerima wajib diisi' });

      const customer = await prisma.customer.findUnique({ where: { id: mailboxId } });
      if (!customer) return res.status(404).json({ error: 'Mailbox tidak ditemukan' });

      const files = (req.files as Express.Multer.File[]) ?? [];
      const text = body ?? '';
      const attachmentBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

      // Enforce 5 GB storage limit: block sending if storage is full or if attachments exceed quota
      const quotaCheck = await checkStorageQuota(prisma, mailboxId, attachmentBytes);
      if (!quotaCheck.allowed) {
        for (const f of files) {
          if (fs.existsSync(f.path)) {
            try {
              fs.unlinkSync(f.path);
            } catch {}
          }
        }
        return res.status(403).json({
          error: 'Kapasitas penyimpanan 5 GB telah penuh. Anda tidak dapat mengirim email baru. Silakan hubungi tim support untuk penambahan kuota.',
          code: 'STORAGE_QUOTA_EXCEEDED',
          storageUsed: quotaCheck.stats.storageUsed,
          storageLimit: quotaCheck.stats.storageLimit,
        });
      }

      const portalUrl = (process.env.CORS_ORIGIN || 'https://clienteasylegal.co.id').split(',')[0].trim();
      const html = buildBrandedEmailHtml({ customer, bodyText: text, portalUrl });

      let delivered = false;
      let deliveryError: string | null = null;
      let deliveryMethod = 'none';

      // 1. Prefer Hostinger Mail API send when configured and no attachments
      if (isMailApiConfigured() && files.length === 0) {
        try {
          let resourceId = customer.mailboxResourceId ?? undefined;
          if (!resourceId) {
            resourceId = await resolveResourceId(customer.mailboxAddress);
            if (resourceId) {
              await prisma.customer.update({ where: { id: customer.id }, data: { mailboxResourceId: resourceId } });
            }
          }
          if (resourceId) {
            const apiRes = await sendViaApi(resourceId, {
              to,
              cc,
              subject: subject || '(tanpa subjek)',
              text,
              html,
              displayName: customer.name,
            });
            if (apiRes?.delivered) {
              delivered = true;
              deliveryMethod = 'hostinger-api';
            }
          } else {
            console.warn(`[email/send] Mailbox ${customer.mailboxAddress} has no resourceId in Mail API, falling back to SMTP`);
          }
        } catch (apiErr: any) {
          const apiMsg = apiErr?.response?.data?.message || apiErr?.message;
          console.warn(`[email/send] Hostinger Mail API send failed for ${customer.mailboxAddress}, falling back to SMTP:`, apiMsg);
          deliveryError = apiMsg;
        }
      }

      // 2. If not delivered yet, try SMTP with customer credentials
      if (!delivered) {
        let customerPass = '';
        if (customer.passwordEnc) {
          try {
            customerPass = decrypt(customer.passwordEnc);
          } catch (decErr: any) {
            console.warn(`[email/send] Could not decrypt password for ${customer.mailboxAddress}:`, decErr?.message);
          }
        }

        if (customerPass) {
          try {
            const smtpRes = await sendMail({
              user: customer.mailboxAddress,
              pass: customerPass,
              name: customer.name,
              to,
              cc,
              subject: subject || '(tanpa subjek)',
              text,
              html,
              attachments: files.map((f) => ({ filename: f.originalname, path: f.path })),
            });
            if (smtpRes?.delivered) {
              delivered = true;
              deliveryMethod = 'smtp-mailbox';
            }
          } catch (smtpErr: any) {
            console.warn(`[email/send] Direct customer SMTP send failed for ${customer.mailboxAddress}:`, smtpErr?.message);
            deliveryError = smtpErr?.message;
          }
        }
      }

      // 3. Fallback: if direct customer delivery failed or password unavailable, try system SMTP relay
      if (!delivered && smtpConfigured()) {
        try {
          console.log(`[email/send] Retrying delivery via system SMTP relay (${process.env.HOSTINGER_SMTP_USER})...`);
          const relayRes = await sendMail({
            user: process.env.HOSTINGER_SMTP_USER!,
            pass: process.env.HOSTINGER_SMTP_PASS!,
            name: customer.name ? `${customer.name} (EasyLegal)` : 'EasyLegal Portal',
            to,
            cc,
            replyTo: customer.mailboxAddress,
            subject: subject || '(tanpa subjek)',
            text,
            html,
            attachments: files.map((f) => ({ filename: f.originalname, path: f.path })),
          });
          if (relayRes?.delivered) {
            delivered = true;
            deliveryMethod = 'smtp-relay';
          }
        } catch (relayErr: any) {
          console.error(`[email/send] System SMTP relay send also failed:`, relayErr?.message);
          deliveryError = relayErr?.message || deliveryError;
        }
      }

      if (!delivered) {
        for (const f of files) {
          if (f.path && fs.existsSync(f.path)) {
            try { fs.unlinkSync(f.path); } catch {}
          }
        }
        return res.status(502).json({
          error: deliveryError
            ? `Gagal mengirim email: ${deliveryError}`
            : 'Gagal mengirim email. Kredensial mailbox tidak valid atau server SMTP tidak merespons.',
        });
      }

      let messageId = `sent-${Date.now()}`;
      try {
        const message = await prisma.messageCache.create({
          data: {
            mailboxId,
            uid: messageId,
            folder: 'Sent',
            subject: subject || '(tanpa subjek)',
            sender: customer.mailboxAddress,
            recipients: [to, cc].filter(Boolean).join(','),
            snippet: toSnippet(text),
            bodyText: text,
            bodyHtml: html,
            isRead: true,
            receivedAt: new Date(),
            attachments: {
              create: files.map((f) => ({
                filename: f.originalname,
                mimeType: f.mimetype,
                size: f.size,
                path: path.basename(f.path),
              })),
            },
          },
        });
        messageId = message.id;
      } catch (cacheErr: any) {
        console.error('[email/send] Failed to cache sent message in DB:', cacheErr?.message);
      }

      res.status(201).json({ message: 'Email terkirim', id: messageId, delivered: true, method: deliveryMethod });
    } catch (error: any) {
      console.error('Send email error:', error);
      for (const f of ((req.files as Express.Multer.File[]) || [])) {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch {}
        }
      }
      res.status(500).json({ error: error?.message || 'Gagal mengirim email' });
    }
  });

  // FR-12: open one message; HTML is sanitized server-side.
  router.get('/:uid', async (req: Request, res: Response) => {
    try {
      const mailboxId = req.user!.id;
      const message = await prisma.messageCache.findFirst({
        where: { mailboxId, uid: req.params.uid },
        include: { attachments: { select: { id: true, filename: true, mimeType: true, size: true } } },
      });
      if (!message) return res.status(404).json({ error: 'Email tidak ditemukan' });

      if (!message.isRead) {
        await prisma.messageCache.update({ where: { id: message.id }, data: { isRead: true } });
      }

      const senderAddress = message.sender;
      const avatarMap = await resolveAvatarMap(prisma, [senderAddress], mailboxId);
      const clean = extractEmailAddress(senderAddress);
      const avatarInfo = clean ? avatarMap.get(clean) : null;
      let senderAvatarUrl = avatarInfo ? avatarInfo.avatarUrl : null;
      let fallbackAvatarUrl = avatarInfo ? avatarInfo.fallbackAvatarUrl : null;
      if (!senderAvatarUrl && message.folder === 'Sent') {
        const currentInfo = avatarMap.get('__CURRENT_USER__');
        senderAvatarUrl = currentInfo ? currentInfo.avatarUrl : null;
        fallbackAvatarUrl = currentInfo ? currentInfo.fallbackAvatarUrl : null;
      }

      res.json({
        ...message,
        isRead: true,
        senderAvatarUrl,
        fallbackAvatarUrl,
        bodyHtml: message.bodyHtml ? sanitizeHtml(message.bodyHtml) : null,
      });
    } catch (error) {
      console.error('Get email error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // FR-15: read / star / move flags.
  const patchFlag = (field: 'isRead' | 'isStarred') => async (req: Request, res: Response) => {
    try {
      const message = await prisma.messageCache.findFirst({
        where: { mailboxId: req.user!.id, uid: req.params.uid },
      });
      if (!message) return res.status(404).json({ error: 'Email tidak ditemukan' });

      const value = req.body?.[field] ?? !message[field];
      const updated = await prisma.messageCache.update({
        where: { id: message.id },
        data: { [field]: !!value },
      });
      res.json(updated);
    } catch (error) {
      console.error('Flag update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  router.post('/:uid/read', patchFlag('isRead'));
  router.post('/:uid/star', patchFlag('isStarred'));

  router.post('/:uid/move', async (req: Request, res: Response) => {
    try {
      const { folder } = req.body ?? {};
      if (!FOLDERS.includes(folder)) return res.status(400).json({ error: 'Folder tidak valid' });

      const message = await prisma.messageCache.findFirst({
        where: { mailboxId: req.user!.id, uid: req.params.uid },
      });
      if (!message) return res.status(404).json({ error: 'Email tidak ditemukan' });

      const updated = await prisma.messageCache.update({
        where: { id: message.id },
        data: { folder, isDeleted: folder === 'Trash' },
      });
      res.json(updated);
    } catch (error) {
      console.error('Move email error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete = move to Trash; already in Trash = purge.
  router.delete('/:uid', async (req: Request, res: Response) => {
    try {
      const message = await prisma.messageCache.findFirst({
        where: { mailboxId: req.user!.id, uid: req.params.uid },
      });
      if (!message) return res.status(404).json({ error: 'Email tidak ditemukan' });

      if (message.folder === 'Trash') {
        await prisma.messageCache.delete({ where: { id: message.id } });
        return res.json({ message: 'Email dihapus permanen' });
      }

      await prisma.messageCache.update({
        where: { id: message.id },
        data: { folder: 'Trash', isDeleted: true },
      });
      res.json({ message: 'Email dipindah ke Trash' });
    } catch (error) {
      console.error('Delete email error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // FR-13: attachment download, scoped to the owner's mailbox.
  router.get('/attachment/:id/download', async (req: Request, res: Response) => {
    try {
      const attachment = await prisma.attachment.findFirst({
        where: { id: req.params.id, message: { mailboxId: req.user!.id } },
        include: {
          message: {
            include: { mailbox: true },
          },
        },
      });
      if (!attachment) return res.status(404).json({ error: 'Lampiran tidak ditemukan' });

      if (attachment.path.startsWith('api-attach:')) {
        const remoteId = attachment.path.slice('api-attach:'.length);
        let resourceId = attachment.message.mailbox.mailboxResourceId ?? undefined;
        if (!resourceId && isMailApiConfigured()) {
          resourceId = await resolveResourceId(attachment.message.mailbox.mailboxAddress);
        }
        if (!resourceId || !remoteId) {
          return res.status(404).json({ error: 'File lampiran remote tidak tersedia' });
        }

        const data = await fetchMessageAttachment(
          resourceId,
          attachment.message.folder,
          Number(attachment.message.uid),
          remoteId,
        );
        res.setHeader('Content-Type', inferAttachmentMimeType(attachment.filename, attachment.mimeType));
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`);
        return res.send(data);
      }

      // path is stored as a relative path or basename; re-resolve and confirm it stays in STORAGE_DIR.
      let file = path.resolve(STORAGE_DIR, attachment.path);
      if (!fs.existsSync(file)) {
        file = path.resolve(STORAGE_DIR, path.basename(attachment.path));
      }
      if (!file.startsWith(STORAGE_DIR + path.sep) || !fs.existsSync(file)) {
        return res.status(404).json({ error: 'File tidak ada di storage' });
      }
      res.download(file, attachment.filename);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Inline attachment preview. Only browser-safe formats are served inline;
  // active formats such as HTML and SVG intentionally remain download-only.
  router.get('/attachment/:id/preview', async (req: Request, res: Response) => {
    try {
      const attachment = await prisma.attachment.findFirst({
        where: { id: req.params.id, message: { mailboxId: req.user!.id } },
        include: {
          message: {
            include: { mailbox: true },
          },
        },
      });
      if (!attachment) return res.status(404).json({ error: 'Lampiran tidak ditemukan' });

      const mimeType = inferAttachmentMimeType(attachment.filename, attachment.mimeType);
      if (!isInlinePreviewMimeType(mimeType)) {
        return res.status(415).json({ error: 'Format berkas ini belum mendukung pratinjau langsung' });
      }

      res.setHeader('Content-Type', previewResponseMimeType(mimeType));
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=300');

      if (attachment.path.startsWith('api-attach:')) {
        const remoteId = attachment.path.slice('api-attach:'.length);
        let resourceId = attachment.message.mailbox.mailboxResourceId ?? undefined;
        if (!resourceId && isMailApiConfigured()) {
          resourceId = await resolveResourceId(attachment.message.mailbox.mailboxAddress);
        }
        if (!resourceId || !remoteId) {
          return res.status(404).json({ error: 'File lampiran remote tidak tersedia' });
        }

        const data = await fetchMessageAttachment(
          resourceId,
          attachment.message.folder,
          Number(attachment.message.uid),
          remoteId,
        );
        return res.send(data);
      }

      let file = path.resolve(STORAGE_DIR, attachment.path);
      if (!fs.existsSync(file)) {
        file = path.resolve(STORAGE_DIR, path.basename(attachment.path));
      }
      if (!file.startsWith(STORAGE_DIR + path.sep) || !fs.existsSync(file)) {
        return res.status(404).json({ error: 'File tidak ada di storage' });
      }
      return res.sendFile(file);
    } catch (error) {
      console.error('Preview attachment error:', error);
      res.status(500).json({ error: 'Gagal memuat pratinjau lampiran' });
    }
  });

  return router;
};
