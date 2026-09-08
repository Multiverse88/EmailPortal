import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

describe('Prisma Schema Extended Models & Seeder Verification', () => {
  const prisma = new PrismaClient();
  const storageDir = path.resolve(__dirname, '../storage');

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should have access to new hub models on prisma client', () => {
    expect(prisma.loginSession).toBeDefined();
    expect(prisma.legalDocument).toBeDefined();
    expect(prisma.documentVersion).toBeDefined();
    expect(prisma.supportTicket).toBeDefined();
    expect(prisma.ticketMessage).toBeDefined();
  });

  it('should verify customer model has twoFactorEnabled and preferences fields', async () => {
    const budi = await prisma.customer.findFirst({
      where: { mailboxAddress: { startsWith: 'budi@' } },
    });
    expect(budi).toBeDefined();
    expect(budi?.twoFactorEnabled).toBe(false);
    expect(budi?.preferences).toBeDefined();
    const prefs = JSON.parse(budi?.preferences || '{}');
    expect(prefs.language).toBe('id');
    expect(prefs.timezone).toBe('Asia/Jakarta');
  });

  it('should verify seeded login sessions for budi and trial', async () => {
    const budi = await prisma.customer.findFirst({
      where: { mailboxAddress: { startsWith: 'budi@' } },
      include: { sessions: true },
    });
    expect(budi).toBeDefined();
    expect(budi?.sessions.length).toBeGreaterThanOrEqual(3);

    const deviceNames = budi?.sessions.map((s) => s.deviceName);
    expect(deviceNames).toContain('MacBook Pro 16"');
    expect(deviceNames).toContain('iPhone 14 Pro');
    expect(deviceNames).toContain('Windows Desktop');

    const currentSession = budi?.sessions.find((s) => s.deviceName === 'MacBook Pro 16"');
    expect(currentSession?.isCurrent).toBe(true);

    const trial = await prisma.customer.findFirst({
      where: { mailboxAddress: { startsWith: 'trial@' } },
      include: { sessions: true },
    });
    expect(trial).toBeDefined();
    expect(trial?.sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('should verify seeded legal documents and version history', async () => {
    const budi = await prisma.customer.findFirst({
      where: { mailboxAddress: { startsWith: 'budi@' } },
      include: {
        documents: {
          include: { versions: true },
        },
      },
    });
    expect(budi).toBeDefined();
    expect(budi?.documents.length).toBeGreaterThanOrEqual(3);

    const docTitles = budi?.documents.map((d) => d.title);
    expect(docTitles).toContain('SK Kemenkumham PT Maju Bersama Digital');
    expect(docTitles).toContain('Perjanjian Kerjasama Investasi & Kemitraan');
    expect(docTitles).toContain('Invoice Retainer & Perizinan 2026-088');

    // Verify physical files exist in backend/storage
    for (const doc of budi?.documents || []) {
      const physicalPath = path.join(storageDir, doc.path);
      expect(fs.existsSync(physicalPath)).toBe(true);
    }

    // Verify version history for SK Kemenkumham
    const skDoc = budi?.documents.find((d) =>
      d.title.includes('SK Kemenkumham')
    );
    expect(skDoc).toBeDefined();
    const versionNumbers = skDoc?.versions.map((v) => v.versionNumber);
    expect(versionNumbers).toContain('v1.0');
    expect(versionNumbers).toContain('v2.0');
    expect(versionNumbers).toContain('v2.1');

    const v21 = skDoc?.versions.find((v) => v.versionNumber === 'v2.1');
    expect(v21?.notes).toContain('Approved by Sarah J.');

    // Check trial document panduan-trial.pdf
    const trial = await prisma.customer.findFirst({
      where: { mailboxAddress: { startsWith: 'trial@' } },
      include: {
        documents: {
          include: { versions: true },
        },
      },
    });
    expect(trial).toBeDefined();
    const trialDoc = trial?.documents.find((d) => d.path === 'panduan-trial.pdf');
    expect(trialDoc).toBeDefined();
    expect(fs.existsSync(path.join(storageDir, trialDoc!.path))).toBe(true);
  });

  it('should verify seeded support tickets and thread messages', async () => {
    const budi = await prisma.customer.findFirst({
      where: { mailboxAddress: { startsWith: 'budi@' } },
      include: {
        tickets: {
          include: { messages: true },
        },
      },
    });
    expect(budi).toBeDefined();
    expect(budi?.tickets.length).toBeGreaterThanOrEqual(3);

    const ticketNumbers = budi?.tickets.map((t) => t.ticketNumber);
    expect(ticketNumbers).toContain('#TK-4920');
    expect(ticketNumbers).toContain('#TK-4811');
    expect(ticketNumbers).toContain('#TK-4925');

    const tk4920 = budi?.tickets.find((t) => t.ticketNumber === '#TK-4920');
    expect(tk4920?.subject).toBe('Document Review Delay');
    expect(tk4920?.status).toBe('open');
    expect(tk4920?.priority).toBe('urgent');
    expect(tk4920?.messages.length).toBeGreaterThanOrEqual(3);

    // Verify internal note exists in TK-4920 messages
    const internalNote = tk4920?.messages.find((m) => m.isInternal === true);
    expect(internalNote).toBeDefined();
    expect(internalNote?.message).toContain('Internal Note:');

    const tk4811 = budi?.tickets.find((t) => t.ticketNumber === '#TK-4811');
    expect(tk4811?.subject).toBe('Billing Discrepancy');
    expect(tk4811?.status).toBe('resolved');

    const tk4925 = budi?.tickets.find((t) => t.ticketNumber === '#TK-4925');
    expect(tk4925?.subject).toBe('Access Revocation Error');
  });
});
