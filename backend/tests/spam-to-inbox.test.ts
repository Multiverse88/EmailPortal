import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient, Customer } from '@prisma/client';
import { SyncWorker } from '../src/workers/sync';
import { foldersApi, messagesApi, fetchMessages } from '../src/lib/hostinger';

jest.mock('../src/lib/hostinger', () => ({
  ...jest.requireActual('../src/lib/hostinger'),
  foldersApi: jest.fn(),
  messagesApi: jest.fn(),
  fetchMessages: jest.fn(),
}));
jest.mock('../src/lib/telegram', () => ({ notifyEmailThreat: jest.fn().mockResolvedValue(true) }));

type Mail = { uid: number; subject: string };
const raw = (mail: Mail) => Buffer.from(`From: sender@example.com\r\nTo: spam-check@example.com\r\nSubject: ${mail.subject}\r\nMessage-ID: <${mail.subject}@example.com>\r\nContent-Type: text/plain\r\n\r\nReceived message.`);

// An in-memory provider, not a cache: a move gives the message a new destination UID.
class ImapMailbox {
  selected = 'INBOX';
  failMove = false;
  ended = false;
  folders = new Map<string, Mail[]>([
    ['INBOX', [{ uid: 1, subject: 'Existing Inbox message' }]],
    ['INBOX.Junk', []],
    ['INBOX.Custom', []],
    ['INBOX.Trash', [{ uid: 1, subject: 'Deleted message' }]],
  ]);
  getBoxes(callback: Function) {
    callback(null, { INBOX: { attribs: [], delimiter: '.', children: {
      Junk: { attribs: [], delimiter: '.', children: null },
      Custom: { attribs: ['\\Junk'], delimiter: '.', children: null },
      Trash: { attribs: ['\\Trash'], delimiter: '.', children: null },
    } } });
  }
  openBox(folder: string, _readOnly: boolean, callback: Function) {
    this.selected = folder;
    callback(null, { messages: { total: this.folders.get(folder)!.length } });
  }
  search(_criteria: unknown, callback: Function) {
    callback(null, this.folders.get(this.selected)!.map(mail => mail.uid));
  }
  move(uids: number[], destination: string, callback: Function) {
    if (this.failMove) return callback(new Error('Provider move denied'));
    const source = this.folders.get(this.selected)!;
    const inbox = this.folders.get(destination)!;
    for (const mail of source.filter(mail => uids.includes(mail.uid))) {
      inbox.push({ ...mail, uid: Math.max(0, ...inbox.map(item => item.uid)) + 1 });
    }
    this.folders.set(this.selected, source.filter(mail => !uids.includes(mail.uid)));
    callback(null);
  }
  seq = { fetch: (range: string) => {
    const fetch = new EventEmitter();
    const [start, end] = range.split(':').map(Number);
    const mails = this.folders.get(this.selected)!.slice(start - 1, end);
    queueMicrotask(async () => {
      for (const mail of mails) {
        const message = new EventEmitter();
        fetch.emit('message', message, mail.uid);
        message.emit('attributes', { uid: mail.uid });
        const stream = Readable.from([raw(mail)]);
        message.emit('body', stream);
        await new Promise<void>(resolve => stream.once('end', () => { message.emit('end'); resolve(); }));
      }
      fetch.emit('end');
    });
    return fetch;
  } };
  end() { this.ended = true; }
}

describe('Spam is moved into the provider Inbox before caching', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spam-to-inbox-'));
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, 'check.db')}` } } });
  let customer: Customer;
  let worker: SyncWorker;

  beforeAll(async () => {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', path.resolve(__dirname, '../../prisma/schema.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: `file:${path.join(dir, 'check.db')}` }, stdio: 'pipe' });
    customer = await prisma.customer.create({ data: { name: 'Spam check', mailboxAddress: 'spam-check@example.com', personalEmail: 'personal@example.com', passwordEnc: 'unused', mailboxResourceId: 'resource' } });
  });
  beforeEach(async () => {
    await prisma.messageCache.deleteMany();
    worker = new SyncWorker(prisma);
    jest.spyOn(worker as any, 'enrichWithAiSentinel').mockResolvedValue(undefined);
  });
  afterAll(async () => { await prisma.$disconnect(); rmSync(dir, { recursive: true, force: true }); });

  it('recovers all existing spam, preserves colliding Inbox UIDs, ignores Trash, and stays duplicate-free', async () => {
    const imap = new ImapMailbox();
    imap.folders.set('INBOX.Junk', Array.from({ length: 60 }, (_, i) => ({ uid: i + 1, subject: `Recovered-${i}` })));
    imap.folders.set('INBOX.Custom', [{ uid: 1, subject: 'DJKI verification' }]);
    jest.spyOn(worker as any, 'connect').mockResolvedValue(imap);
    await worker.syncCustomer(customer);
    expect(await prisma.messageCache.count()).toBe(62);
    expect(await prisma.messageCache.findUnique({ where: { mailboxId_uid: { mailboxId: customer.id, uid: '1' } } })).toMatchObject({ subject: 'Existing Inbox message', folder: 'INBOX' });
    expect(await prisma.messageCache.findFirst({ where: { subject: 'DJKI verification' } })).toMatchObject({ uid: '62', folder: 'INBOX' });
    expect(imap.folders.get('INBOX.Junk')).toEqual([]);
    expect(imap.folders.get('INBOX.Custom')).toEqual([]);
    expect(imap.folders.get('INBOX.Trash')).toHaveLength(1);
    await worker.syncCustomer(customer);
    expect(await prisma.messageCache.count()).toBe(62);
    expect(imap.ended).toBe(true);
  });

  it('leaves provider messages intact and reports a failed move instead of claiming delivery', async () => {
    const imap = new ImapMailbox();
    imap.folders.set('INBOX.Junk', [{ uid: 1, subject: 'Still in Junk' }]);
    imap.failMove = true;
    jest.spyOn(worker as any, 'connect').mockResolvedValue(imap);
    await expect(worker.syncCustomer(customer)).rejects.toThrow('Provider move denied');
    expect(imap.folders.get('INBOX.Junk')).toHaveLength(1);
    expect(await prisma.messageCache.count()).toBe(0);
    expect(imap.ended).toBe(true);
  });

  it('continues normal Inbox synchronization when spam folders are empty', async () => {
    const imap = new ImapMailbox();
    jest.spyOn(worker as any, 'connect').mockResolvedValue(imap);
    await worker.syncCustomer(customer);
    expect(await prisma.messageCache.findFirst()).toMatchObject({ subject: 'Existing Inbox message', folder: 'INBOX' });
  });

  it('moves API spam in supported batches and caches all new destination UIDs beyond the first page', async () => {
    const inbox = [{ uid: 1, subject: 'API original' }];
    const junk = Array.from({ length: 120 }, (_, i) => ({ uid: i + 1, subject: `API-recovered-${i}` }));
    (foldersApi as jest.Mock).mockReturnValue({ listFolders: async () => ({ data: { data: [{ path: 'INBOX.Junk', name: 'Junk', specialUse: '\\Junk', messageCount: junk.length }] } }) });
    (messagesApi as jest.Mock).mockReturnValue({
      listMessages: async (_id: string, folder: string, page = 1, perPage = 100) => ({ data: { data: (folder === 'INBOX.Junk' ? junk : inbox).slice().sort((a, b) => b.uid - a.uid).slice((page - 1) * perPage, page * perPage).map(mail => ({ ...mail, from: { address: 'sender@example.com' }, flags: ['\\Seen'], date: '2026-11-19T00:00:00Z' })) } }),
      moveMessages: async (_id: string, _folder: string, body: { uids: number[]; targetFolder: string }) => {
        if (body.uids.length > 100 || body.targetFolder !== 'INBOX') throw new Error('Invalid provider move');
        for (const uid of body.uids) {
          const index = junk.findIndex(mail => mail.uid === uid);
          const [mail] = junk.splice(index, 1);
          inbox.push({ ...mail, uid: Math.max(...inbox.map(item => item.uid)) + 1 });
        }
      },
      getMessage: async () => ({ data: { data: { to: [], attachments: [] } } }),
    });
    (fetchMessages as jest.Mock).mockImplementation(async (_id: string, _folder: string, options: { page: number; perPage: number }) =>
      inbox.slice().sort((a, b) => b.uid - a.uid)
        .slice((options.page - 1) * options.perPage, options.page * options.perPage)
        .map(mail => ({ ...mail, sender: 'sender@example.com', flags: ['\\Seen'], date: '2026-11-19T00:00:00Z' })));
    await (worker as any).syncCustomerViaApi(customer);
    expect(junk).toEqual([]);
    expect(await prisma.messageCache.count()).toBe(121);
    expect(await prisma.messageCache.findUnique({ where: { mailboxId_uid: { mailboxId: customer.id, uid: '1' } } })).toMatchObject({ subject: 'API original', folder: 'INBOX' });
    await (worker as any).syncCustomerViaApi(customer);
    expect(await prisma.messageCache.count()).toBe(121);
  });
});
