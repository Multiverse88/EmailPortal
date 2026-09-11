import { PrismaClient, Customer } from '@prisma/client';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { decrypt } from '../lib/crypto';
import { toSnippet } from '../lib/sanitize';
import { inferAttachmentMimeType } from '../lib/attachments';
import { getAccountFolderName } from '../lib/synology-sync';
import { storage } from '../lib/storage';
import { isMailApiConfigured, messagesApi, resolveResourceId, fetchMessages, fetchMessageBody } from '../lib/hostinger';
import { scanAttachmentBuffer, scanEmailContent } from '../lib/security-scanner';
import { notifyEmailThreat } from '../lib/telegram';

const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || './storage');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const IMAP_HOST = process.env.HOSTINGER_IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = parseInt(process.env.HOSTINGER_IMAP_PORT || '993');
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '15000'); // Default 15s

// One connection per mailbox, opened per pass. NFR: a failure on one mailbox
// must not stop the others, so every customer is wrapped in its own try.
export class SyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private failedAuthMailboxes = new Map<string, number>();
  private lastSyncPerMailbox = new Map<string, number>();

  constructor(private prisma: PrismaClient) {}

  resetFailedAuth(mailboxAddress?: string) {
    if (mailboxAddress) {
      this.failedAuthMailboxes.delete(mailboxAddress);
    } else {
      this.failedAuthMailboxes.clear();
    }
  }

  async start() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (isMailApiConfigured()) {
      console.log(`✓ Sync worker started via Hostinger Mail API SDK (every ${SYNC_INTERVAL_MS / 1000}s)`);
    } else {
      console.log(`✓ Sync worker started via IMAP (${IMAP_HOST}:${IMAP_PORT}) (every ${SYNC_INTERVAL_MS / 1000}s)`);
    }
    this.timer = setInterval(() => void this.syncAll(), SYNC_INTERVAL_MS);
    await this.syncAll();
  }

  async syncCustomerMailbox(mailboxId: string): Promise<{ synced: number }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: mailboxId },
    });
    if (!customer || customer.status !== 'active') {
      return { synced: 0 };
    }

    // Cooldown check: max 1 IMAP connection per 10s per mailbox
    const lastSync = this.lastSyncPerMailbox.get(mailboxId);
    if (lastSync && Date.now() - lastSync < 10000) {
      const count = await this.prisma.messageCache.count({
        where: { mailboxId: customer.id },
      });
      return { synced: count };
    }
    this.lastSyncPerMailbox.set(mailboxId, Date.now());

    this.failedAuthMailboxes.delete(customer.mailboxAddress);

    try {
      if (isMailApiConfigured()) {
        await this.syncCustomerViaApi(customer);
      } else {
        await this.syncCustomer(customer);
      }
    } catch (err: any) {
      console.warn(`[Sync] On-demand sync warning for ${customer.mailboxAddress}:`, err.message);
      throw err;
    }

    const count = await this.prisma.messageCache.count({
      where: { mailboxId: customer.id },
    });
    return { synced: count };
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async syncAll() {
    if (this.running) return; // skip overlapping passes
    this.running = true;
    try {
      const customers = await this.prisma.customer.findMany({ where: { status: 'active' } });
      for (const customer of customers) {
        const lastFailed = this.failedAuthMailboxes.get(customer.mailboxAddress);
        if (lastFailed && Date.now() - lastFailed < 15 * 60 * 1000) {
          continue;
        }

        try {
          if (isMailApiConfigured()) {
            await this.syncCustomerViaApi(customer);
          } else {
            await this.syncCustomer(customer);
          }
          this.failedAuthMailboxes.delete(customer.mailboxAddress);
        } catch (error: any) {
          const isAuthFailure =
            error?.textCode === 'AUTHENTICATIONFAILED' ||
            error?.source === 'timeout-auth' ||
            (typeof error?.message === 'string' && /authenticat/i.test(error.message));

          if (isAuthFailure) {
            this.failedAuthMailboxes.set(customer.mailboxAddress, Date.now());
            console.warn(`[IMAP Sync] Akun demo / belum ada di server Hostinger (${customer.mailboxAddress}): autentikasi dilewati (backoff 15m).`);
          } else {
            console.error(`sync failed for ${customer.mailboxAddress}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('sync pass failed:', error);
    } finally {
      this.running = false;
    }
  }

  // ─── Hostinger Mail API SDK path ────────────────────────────────────────

  private async syncCustomerViaApi(customer: Customer) {
    // Resolve resourceId if not cached yet
    let resourceId = customer.mailboxResourceId ?? undefined;
    if (!resourceId) {
      resourceId = await resolveResourceId(customer.mailboxAddress);
      if (!resourceId) {
        console.warn(`sync: ${customer.mailboxAddress} not visible via Mail API yet`);
        return;
      }
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { mailboxResourceId: resourceId },
      });
    }

    const api = messagesApi();
    const folder = 'INBOX';

    // Fetch latest messages (page 1, sort newest first)
    const messages = await fetchMessages(resourceId, folder, { page: 1, perPage: 100, sort: '-uid' });

    for (const meta of messages) {
      const flags = meta.flags ?? [];
      const wasSeen = flags.includes('\\Seen');

      // Only fetch body for unseen messages; skip seen ones (save API calls).
      // The client already has the summary from the list call; we only need
      // body HTML/text for rendering the reading pane on first open.
      let bodyText = '';
      let bodyHtml: string | null = null;
      if (!wasSeen) {
        const text = await fetchMessageBody(resourceId, folder, meta.uid);
        if (text) {
          bodyText = text.text ?? '';
          bodyHtml = text.html ?? null;
        }
      }

      const snippet = toSnippet(bodyText || meta.subject);
      const recipientStr = ''; // recipients come from the message detail; we merge below

      let recipientDetails = '';
      let attachmentMeta = '';
      let rfcMessageId: string | null = null;
      let inReplyTo: string | null = null;
      let references: string | null = null;
      try {
        const detail = await api.getMessage(resourceId, folder, meta.uid);
        const d = (detail.data as any).data;
        if (d) {
          rfcMessageId = d.messageId || d.headers?.['message-id'] || null;
          inReplyTo = d.inReplyTo || d.headers?.['in-reply-to'] || null;
          references = Array.isArray(d.references) ? d.references.join(' ') : (d.references || d.headers?.references || null);
          const toAddr = Array.isArray(d.to) ? d.to.map((a: any) => a.address).join(',') : '';
          const ccAddr = Array.isArray(d.cc) ? d.cc.map((a: any) => a.address).join(',') : '';
          recipientDetails = [toAddr, ccAddr].filter(Boolean).join(',');
          if (Array.isArray(d.attachments) && d.attachments.length > 0) {
            attachmentMeta = JSON.stringify(
              d.attachments.map((a: any) => ({ id: a.id, filename: a.filename, size: a.sizeBytes })),
            );
          }
        }
      } catch {
        // non-fatal; sync continues with available info
      }

      const contentScan = scanEmailContent({
        sender: meta.sender,
        subject: meta.subject,
        bodyText,
        bodyHtml,
      });

      if (contentScan.status === 'threat') {
        void notifyEmailThreat({
          accountName: customer.name,
          mailboxAddress: customer.mailboxAddress,
          sender: meta.sender || 'unknown',
          subject: meta.subject || '(tanpa subjek)',
          threatType: contentScan.threats[0] || 'Indikasi Phishing / Rekayasa Sosial',
          threatDetails: contentScan.details,
          actionTaken: 'Email Ditandai untuk Tinjauan Keamanan Super Admin',
        });
      }

      const message = await this.prisma.messageCache.upsert({
        where: { mailboxId_uid: { mailboxId: customer.id, uid: String(meta.uid) } },
        create: {
          mailboxId: customer.id,
          uid: String(meta.uid),
          messageId: rfcMessageId,
          inReplyTo,
          references,
          folder,
          subject: meta.subject,
          sender: meta.sender,
          recipients: recipientDetails,
          snippet,
          bodyText,
          bodyHtml,
          isRead: wasSeen,
          isStarred: flags.includes('\\Flagged'),
          securityStatus: contentScan.status,
          securityNotes: contentScan.details,
          receivedAt: meta.date ? new Date(meta.date) : new Date(),
        },
        update: {
          messageId: rfcMessageId,
          inReplyTo,
          references,
          subject: meta.subject,
          sender: meta.sender,
          isRead: wasSeen,
          isStarred: flags.includes('\\Flagged'),
          securityStatus: contentScan.status,
          securityNotes: contentScan.details,
          receivedAt: meta.date ? new Date(meta.date) : new Date(),
          bodyHtml,
        },
      });

      if (attachmentMeta) {
        try {
          const parsedAtts = JSON.parse(attachmentMeta);
          const existing = await this.prisma.attachment.findMany({
            where: { messageId: message.id },
            select: { path: true },
          });
          const existingPaths = new Set(existing.map((e) => e.path));

          for (const a of parsedAtts) {
            const remotePath = `api-attach:${a.id}`;
            if (existingPaths.has(remotePath)) continue;

            const attScan = scanAttachmentBuffer(a.filename, Buffer.alloc(0));
            if (attScan.status === 'quarantined') {
              void notifyEmailThreat({
                accountName: customer.name,
                mailboxAddress: customer.mailboxAddress,
                sender: meta.sender || 'unknown',
                subject: meta.subject || '(tanpa subjek)',
                threatType: attScan.threatType || 'Berkas Lampiran Berbahaya',
                threatDetails: attScan.details,
                filename: a.filename,
                fileSizeStr: a.size ? `${(a.size / 1024).toFixed(1)} KB` : undefined,
                actionTaken: 'Berkas Dikarantina Otomatis (Akses Unduh Ditangguhkan)',
              });
            }

            await this.prisma.attachment.create({
              data: {
                messageId: message.id,
                filename: a.filename,
                mimeType: inferAttachmentMimeType(a.filename),
                size: a.size,
                path: remotePath,
                scanStatus: attScan.status,
                scanNotes: attScan.details,
              },
            });
            existingPaths.add(remotePath);
          }
        } catch {}
      }
    }
  }

  // ─── Raw IMAP fallback (when HOSTINGER_MAIL_API_KEY is not set) ─────────

  private connect(customer: Customer): Promise<Imap> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: customer.mailboxAddress,
        password: decrypt(customer.passwordEnc),
        host: IMAP_HOST,
        port: IMAP_PORT,
        tls: true,
        authTimeout: 10000,
      });
      imap.once('ready', () => resolve(imap));
      imap.once('error', reject);
      imap.connect();
    });
  }

  public async syncCustomer(customer: Customer) {
    const imap = await this.connect(customer);
    try {
      const box = await new Promise<Imap.Box>((resolve, reject) => {
        imap.openBox('INBOX', true, (err, b) => (err ? reject(err) : resolve(b)));
      });

      if (!box || !box.messages || box.messages.total === 0) {
        // Mailbox is empty; nothing to fetch
        return;
      }

      const total = box.messages.total;
      const start = Math.max(1, total - 49); // fetch up to last 50 messages
      const range = `${start}:${total}`;

      await new Promise<void>((resolve, reject) => {
        const fetch = imap.seq.fetch(range, { bodies: '', struct: true });
        const pending: Promise<unknown>[] = [];

        fetch.on('message', (msg, seqno) => {
          const chunks: Buffer[] = [];
          let msgUid = String(seqno);

          msg.on('attributes', (attrs) => {
            if (attrs && attrs.uid) {
              msgUid = String(attrs.uid);
            }
          });

          msg.on('body', (stream) => {
            stream.on('data', (c: Buffer) => chunks.push(c));
          });

          msg.once('end', () => {
            pending.push(this.store(customer, msgUid, Buffer.concat(chunks)));
          });
        });

        fetch.once('error', reject);
        fetch.once('end', () => void Promise.all(pending).then(() => resolve(), reject));
      });
    } finally {
      imap.end();
    }
  }

  private async store(customerOrId: Customer | string, uid: string, raw: Buffer) {
    const customer = typeof customerOrId === 'string'
      ? await this.prisma.customer.findUnique({ where: { id: customerOrId } })
      : customerOrId;

    const mailboxId = customer ? customer.id : (typeof customerOrId === 'string' ? customerOrId : '');
    if (!mailboxId) return;

    const parsed = await simpleParser(raw);
    const text = parsed.text || '';
    const rawRefs = parsed.references;
    const referencesStr = Array.isArray(rawRefs)
      ? rawRefs.join(' ')
      : (typeof rawRefs === 'string' ? rawRefs : null);

    const contentScan = scanEmailContent({
      sender: parsed.from?.text,
      subject: parsed.subject,
      bodyText: text,
      bodyHtml: typeof parsed.html === 'string' ? parsed.html : null,
    });

    if (contentScan.status === 'threat' && customer) {
      void notifyEmailThreat({
        accountName: customer.name,
        mailboxAddress: customer.mailboxAddress,
        sender: parsed.from?.text || 'unknown',
        subject: parsed.subject || '(tanpa subjek)',
        threatType: contentScan.threats[0] || 'Indikasi Phishing / Rekayasa Sosial',
        threatDetails: contentScan.details,
        actionTaken: 'Email Ditandai untuk Tinjauan Keamanan Super Admin',
      });
    }

    const data = {
      folder: 'INBOX',
      subject: parsed.subject || '(tanpa subjek)',
      sender: parsed.from?.text || 'unknown',
      recipients: Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(',') : parsed.to?.text || '',
      snippet: toSnippet(text),
      bodyText: text,
      bodyHtml: typeof parsed.html === 'string' ? parsed.html : null,
      receivedAt: parsed.date || new Date(),
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
      references: referencesStr,
      securityStatus: contentScan.status,
      securityNotes: contentScan.details,
    };

    const message = await this.prisma.messageCache.upsert({
      where: { mailboxId_uid: { mailboxId, uid } },
      create: { mailboxId, uid, ...data },
      update: data,
    });

    if (parsed.attachments && Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
      const accountFolder = getAccountFolderName(customer);
      const accountAttachmentsDir = path.resolve(STORAGE_DIR, 'accounts', accountFolder, 'attachments');
      fs.mkdirSync(accountAttachmentsDir, { recursive: true });

      const existing = await this.prisma.attachment.findMany({
        where: { messageId: message.id },
        select: { filename: true, size: true },
      });
      const existingKeys = new Set(existing.map((a) => `${a.filename}_${a.size}`));

      for (const att of parsed.attachments) {
        if (!att.content || (!Buffer.isBuffer(att.content) && typeof att.content !== 'string')) {
          continue;
        }

        const filename = att.filename || 'attachment';
        const size = att.size || (Buffer.isBuffer(att.content) ? att.content.length : Buffer.byteLength(att.content));
        const key = `${filename}_${size}`;
        if (existingKeys.has(key)) continue;

        const ext = path.extname(filename) || '';
        const safeExt = ext.slice(0, 10).replace(/[^a-zA-Z0-9._-]/g, '');
        const diskFilename = `att_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safeExt}`;
        const filePath = path.resolve(accountAttachmentsDir, diskFilename);
        const relPath = `accounts/${accountFolder}/attachments/${diskFilename}`;

        const buffer = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
        const scanResult = scanAttachmentBuffer(filename, buffer);

        await fs.promises.writeFile(filePath, buffer);

        // Put to storage adapter (S3 / Local Bucket)
        const mimeType = att.contentType || inferAttachmentMimeType(filename);
        try {
          await storage.putObject(relPath, buffer, mimeType);
        } catch {}

        // Mirror to Synology Drive for cold storage
        void storage.mirrorToSynology(relPath, buffer);

        // 1. Create Attachment record linked to message
        await this.prisma.attachment.create({
          data: {
            messageId: message.id,
            filename,
            mimeType,
            size,
            path: relPath,
            scanStatus: scanResult.status,
            scanNotes: scanResult.details,
          },
        });

        if (scanResult.status === 'quarantined') {
          if (customer) {
            void notifyEmailThreat({
              accountName: customer.name,
              mailboxAddress: customer.mailboxAddress,
              sender: parsed.from?.text || 'unknown',
              subject: parsed.subject || '(tanpa subjek)',
              threatType: scanResult.threatType || 'Berkas Lampiran Berbahaya',
              threatDetails: scanResult.details,
              filename,
              fileSizeStr: `${(size / 1024).toFixed(1)} KB`,
              actionTaken: 'Berkas Dikarantina Otomatis (Akses Unduh Ditangguhkan)',
            });
          }
          // Isolate quarantined dangerous file: do NOT save to LegalDocument
          continue;
        }

        // 2. Auto-save to LegalDocument under the customer's account in 'Lampiran Email' folder (clean files only)
        if (customer) {
          try {
            const existingDoc = await this.prisma.legalDocument.findFirst({
              where: {
                customerId: customer.id,
                path: relPath,
              },
            });

            if (!existingDoc) {
              await this.prisma.legalDocument.create({
                data: {
                  customerId: customer.id,
                  title: filename,
                  category: 'Lampiran Email',
                  filename,
                  mimeType,
                  size,
                  path: relPath,
                  status: 'Reviewed',
                  ownerName: parsed.from?.text ? `Email: ${parsed.from.text}` : 'Email Masuk',
                  versions: {
                    create: [
                      {
                        versionNumber: 'v1.0',
                        authorName: parsed.from?.text || 'Email Masuk',
                        approved: true,
                        notes: `Otomatis tersimpan dari email: ${parsed.subject || '(tanpa subjek)'}`,
                      },
                    ],
                  },
                },
              });
            }
          } catch (docErr) {
            console.warn('[Sync] Auto-save to LegalDocument error:', docErr);
          }
        }

        existingKeys.add(key);
      }
    }
  }
}
