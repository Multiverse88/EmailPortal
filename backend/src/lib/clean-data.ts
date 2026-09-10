import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

export async function purgeDummyData(prisma: PrismaClient, storageDir?: string) {
  // 1. Delete all transactional customer data
  const deletedSessions = await prisma.loginSession.deleteMany();
  const deletedTicketMessages = await prisma.ticketMessage.deleteMany();
  const deletedTickets = await prisma.supportTicket.deleteMany();
  const deletedDocVersions = await prisma.documentVersion.deleteMany();
  const deletedDocs = await prisma.legalDocument.deleteMany();
  const deletedAttachments = await prisma.attachment.deleteMany();
  const deletedMessages = await prisma.messageCache.deleteMany();
  const deletedCustomers = await prisma.customer.deleteMany();
  const deletedAuditLogs = await prisma.auditLog.deleteMany();

  // 2. Ensure official Super Admin & Officer accounts exist, remove obsolete staff
  const domain = (process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id').trim().toLowerCase();
  const adminEmail = `admin@${domain}`;
  const officerEmail = `officer@${domain}`;

  await prisma.adminUser.deleteMany({
    where: {
      email: { notIn: [adminEmail, officerEmail] },
    },
  });

  const defaultAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin123!';
  const adminPasswordHash = await bcrypt.hash(defaultAdminPassword, 10);
  const superAdmin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { isActive: true, role: 'superadmin' },
    create: {
      name: 'Admin Utama EasyLegal',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'superadmin',
      isActive: true,
    },
  });

  const defaultOfficerPassword = process.env.INITIAL_OFFICER_PASSWORD || 'Officer123!';
  const officerPasswordHash = await bcrypt.hash(defaultOfficerPassword, 10);
  const officer = await prisma.adminUser.upsert({
    where: { email: officerEmail },
    update: { isActive: true, role: 'officer' },
    create: {
      name: 'Officer Staf Legal',
      email: officerEmail,
      passwordHash: officerPasswordHash,
      role: 'officer',
      isActive: true,
    },
  });

  // 4. Delete physical dummy files from storage directory
  const resolvedStorageDir = storageDir || path.resolve(process.env.STORAGE_DIR || './storage');
  const dummyFiles = [
    'invoice-2025-088.pdf',
    'perjanjian-kerjasama.pdf',
    'sk-kemenkumham-2026.pdf',
    'panduan-trial.pdf',
    'penawaran-paket-tahunan.pdf',
    'bukti-transfer-bca.png',
    'scan-dokumen.png',
    'laporan-q3.xlsx',
  ];
  let deletedFilesCount = 0;
  for (const file of dummyFiles) {
    const p = path.join(resolvedStorageDir, file);
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        deletedFilesCount++;
      } catch {}
    }
  }

  return {
    deletedCustomersCount: deletedCustomers.count,
    deletedMessagesCount: deletedMessages.count,
    deletedTicketsCount: deletedTickets.count,
    deletedDocsCount: deletedDocs.count,
    deletedFilesCount,
    superAdminEmail: superAdmin.email,
    officerEmail: officer.email,
  };
}
