import { PrismaClient } from '@prisma/client';
import { SyncWorker } from '../src/workers/sync';

const prisma = new PrismaClient();

describe('SyncWorker Auth Error Handling & Backoff', () => {
  let worker: SyncWorker;
  let testCustomer: any;

  beforeAll(async () => {
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Sync Worker Test',
        personalEmail: 'syncworker@example.com',
        mailboxAddress: 'syncworker@clienteasylegal.co.id',
        passwordEnc: 'mock_enc',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    if (testCustomer) {
      await prisma.customer.delete({ where: { id: testCustomer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    worker = new SyncWorker(prisma);
  });

  afterEach(() => {
    worker.stop();
  });

  it('should handle timeout-auth gracefully and back off for subsequent passes', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock syncCustomer to simulate node-imap auth timeout error specifically for testCustomer
    let attempts = 0;
    jest.spyOn(worker as any, 'syncCustomer').mockImplementation(async (customer: any) => {
      if (customer.mailboxAddress === 'syncworker@clienteasylegal.co.id') {
        attempts++;
        const err: any = new Error('Timed out while authenticating with server');
        err.source = 'timeout-auth';
        throw err;
      }
    });

    // First pass should try and fail gracefully
    await worker.syncAll();
    expect(attempts).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('autentikasi dilewati (backoff 15m)')
    );
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('sync failed for syncworker@clienteasylegal.co.id:'),
      expect.anything()
    );

    // Second pass should skip the mailbox due to backoff
    await worker.syncAll();
    expect(attempts).toBe(1); // Not incremented because of backoff!

    // Reset backoff
    worker.resetFailedAuth('syncworker@clienteasylegal.co.id');

    // Third pass should try again
    await worker.syncAll();
    expect(attempts).toBe(2);

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should parse and save raw email attachments to disk and database', async () => {
    const rawEmail = Buffer.from(
      'From: sender@gmail.com\r\n' +
      'To: syncworker@clienteasylegal.co.id\r\n' +
      'Subject: Email with Documents\r\n' +
      'Content-Type: multipart/mixed; boundary="boundary123"\r\n\r\n' +
      '--boundary123\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n\r\n' +
      'Berikut file lampiran yang diminta.\r\n' +
      '--boundary123\r\n' +
      'Content-Type: application/pdf; name="perjanjian.pdf"\r\n' +
      'Content-Disposition: attachment; filename="perjanjian.pdf"\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      'JVBERi0xLjQKJcTl8uXr\r\n' +
      '--boundary123\r\n' +
      'Content-Type: text/markdown; name="catatan.md"\r\n' +
      'Content-Disposition: attachment; filename="catatan.md"\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      Buffer.from('# Catatan Legal\nIsi catatan').toString('base64') + '\r\n' +
      '--boundary123--'
    );

    const testUid = `att-test-${Date.now()}`;
    await (worker as any).store(testCustomer.id, testUid, rawEmail);

    const savedMsg = await prisma.messageCache.findFirst({
      where: { mailboxId: testCustomer.id, uid: testUid },
      include: { attachments: true },
    });

    expect(savedMsg).toBeDefined();
    expect(savedMsg?.subject).toBe('Email with Documents');
    expect(savedMsg?.attachments.length).toBe(2);

    const pdf = savedMsg?.attachments.find((a) => a.filename === 'perjanjian.pdf');
    expect(pdf).toBeDefined();
    expect(pdf?.mimeType).toBe('application/pdf');

    const md = savedMsg?.attachments.find((a) => a.filename === 'catatan.md');
    expect(md).toBeDefined();
    expect(md?.mimeType).toBe('text/markdown');
  });
});
