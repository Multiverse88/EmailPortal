import { PrismaClient, Customer } from '@prisma/client';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { decrypt } from '../lib/crypto';
import { toSnippet } from '../lib/sanitize';
import { inferAttachmentMimeType } from '../lib/attachments';
import { isMailApiConfigured, messagesApi, resolveResourceId, fetchMessages, fetchMessageBody } from '../lib/hostinger';

const IMAP_HOST = process.env.HOSTINGER_IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = parseInt(process.env.HOSTINGER_IMAP_PORT || '993');
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '15000'); // Default 15s

// One connection per mailbox, opened per pass. NFR: a failure on one mailbox
// must not stop the others, so every customer is wrapped in its own try.
export class SyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private failedAuthMailboxes = new Map<string, number>();

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

      // Fetch message detail for recipients and attachments metadata
      let recipientDetails = '';
      let attachmentMeta = '';
      try {
        const detail = await api.getMessage(resourceId, folder, meta.uid);
        const d = (detail.data as any).data;
        if (d) {
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

      await this.prisma.messageCache.upsert({
        where: { mailboxId_uid: { mailboxId: customer.id, uid: String(meta.uid) } },
        create: {
          mailboxId: customer.id,
          uid: String(meta.uid),
          folder,
          subject: meta.subject,
          sender: meta.sender,
          recipients: recipientDetails,
          snippet,
          bodyText,
          bodyHtml,
          isRead: wasSeen,
          isStarred: flags.includes('\\Flagged'),
          receivedAt: meta.date ? new Date(meta.date) : new Date(),
          attachments: attachmentMeta ? {
            create: JSON.parse(attachmentMeta).map((a: any) => ({
              filename: a.filename,
              mimeType: inferAttachmentMimeType(a.filename),
              size: a.size,
              path: `api-attach:${a.id}`,
            })),
          } : undefined,
        },
        update: {
          subject: meta.subject,
          sender: meta.sender,
          isRead: wasSeen,
          isStarred: flags.includes('\\Flagged'),
          receivedAt: meta.date ? new Date(meta.date) : new Date(),
          bodyHtml,
        },
      });
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
            pending.push(this.store(customer.id, msgUid, Buffer.concat(chunks)));
          });
        });

        fetch.once('error', reject);
        fetch.once('end', () => void Promise.all(pending).then(() => resolve(), reject));
      });
    } finally {
      imap.end();
    }
  }

  private async store(mailboxId: string, uid: string, raw: Buffer) {
    const parsed = await simpleParser(raw);
    const text = parsed.text || '';
    const data = {
      folder: 'INBOX',
      subject: parsed.subject || '(tanpa subjek)',
      sender: parsed.from?.text || 'unknown',
      recipients: Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(',') : parsed.to?.text || '',
      snippet: toSnippet(text),
      bodyText: text,
      bodyHtml: typeof parsed.html === 'string' ? parsed.html : null,
      receivedAt: parsed.date || new Date(),
    };

    await this.prisma.messageCache.upsert({
      where: { mailboxId_uid: { mailboxId, uid } },
      create: { mailboxId, uid, ...data },
      update: data,
    });
  }
}
