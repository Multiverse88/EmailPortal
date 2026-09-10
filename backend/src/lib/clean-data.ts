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

  // 2. Remove demo officer/staff, preserve superadmin
  const deletedAdmins = await prisma.adminUser.deleteMany({
    where: { role: { not: 'superadmin' } },
  });

  // 3. Ensure primary Super Admin exists
  const domain = (process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id').trim().toLowerCase();
  const adminEmail = `admin@${domain}`;
  let superAdmin = await prisma.adminUser.findFirst({
    where: {
      OR: [
        { role: 'superadmin' },
        { email: adminEmail },
      ],
    },
  });

  if (!superAdmin) {
    const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    superAdmin = await prisma.adminUser.create({
      data: {
        name: 'Admin Utama EasyLegal',
        email: adminEmail,
        passwordHash,
        role: 'superadmin',
        isActive: true,
      },
    });
  }

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
  };
}
