import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { sanitizeHtml, toSnippet } from '../lib/sanitize';
import { decrypt } from '../lib/crypto';
import { sendMail } from '../lib/mail';
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

export default (prisma: PrismaClient) => {
  const router = Router();

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
          },
        }),
        prisma.messageCache.count({ where }),
      ]);

      res.json({
        data: messages,
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

      // Prefer Hostinger Mail API send when configured; SMTP is the fallback.
      let result: { delivered: boolean };
      if (isMailApiConfigured()) {
        let resourceId = customer.mailboxResourceId ?? undefined;
        if (!resourceId) {
          resourceId = await resolveResourceId(customer.mailboxAddress);
          if (resourceId) {
            await prisma.customer.update({ where: { id: customer.id }, data: { mailboxResourceId: resourceId } });
          }
        }
        if (!resourceId) {
          return res.status(503).json({ error: 'Mailbox belum terhubung ke Hostinger Mail API' });
        }
        result = await sendViaApi(resourceId, { to, cc, subject: subject || '(tanpa subjek)', text });
      } else {
        result = await sendMail({
          user: customer.mailboxAddress,
          pass: decrypt(customer.passwordEnc),
          name: customer.name,
          to,
          cc,
          subject: subject || '(tanpa subjek)',
          text,
          attachments: files.map((f) => ({ filename: f.originalname, path: f.path })),
        });
      }

      if (!result.delivered) {
        return res.status(502).json({ error: (result as any).reason || 'Gagal mengirim email ke server SMTP' });
      }

      const message = await prisma.messageCache.create({
        data: {
          mailboxId,
          uid: `sent-${Date.now()}`,
          folder: 'Sent',
          subject: subject || '(tanpa subjek)',
          sender: customer.mailboxAddress,
          recipients: [to, cc].filter(Boolean).join(','),
          snippet: toSnippet(text),
          bodyText: text,
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

      res.status(201).json({ message: 'Email terkirim', id: message.id, delivered: result.delivered });
    } catch (error: any) {
      console.error('Send email error:', error);
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

      res.json({
        ...message,
        isRead: true,
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

      // path is stored as a basename; re-resolve and confirm it stays in STORAGE_DIR.
      const file = path.resolve(STORAGE_DIR, path.basename(attachment.path));
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

      const file = path.resolve(STORAGE_DIR, path.basename(attachment.path));
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
