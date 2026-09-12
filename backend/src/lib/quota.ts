import { PrismaClient } from '@prisma/client';

export const DEFAULT_STORAGE_QUOTA = 5 * 1024 * 1024 * 1024; // 5 GB in bytes

export interface StorageStats {
  storageUsed: number;
  storageLimit: number;
  docSize: number;
  attachSize: number;
  isFull: boolean;
  usagePercent: number;
}

export async function getCustomerStorageStats(
  prisma: PrismaClient,
  customerId: string
): Promise<StorageStats> {
  const [customer, nonEmailDocs, emailDocs, attachAgg] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { storageQuota: true },
    }),
    prisma.legalDocument.aggregate({
      where: { customerId, category: { not: 'Lampiran Email' } },
      _sum: { size: true },
    }),
    prisma.legalDocument.findMany({
      where: { customerId, category: 'Lampiran Email' },
      select: { path: true, size: true },
    }),
    prisma.attachment.findMany({
      where: { message: { mailboxId: customerId } },
      select: { path: true, size: true },
    }),
  ]);

  const attachPaths = new Set(attachAgg.map((a) => a.path));
  const attachSize = attachAgg.reduce((sum, a) => sum + (a.size || 0), 0);
  const nonEmailDocSize = nonEmailDocs._sum.size || 0;
  const extraEmailDocSize = emailDocs
    .filter((d) => !attachPaths.has(d.path))
    .reduce((sum, d) => sum + (d.size || 0), 0);

  const docSize = nonEmailDocSize + extraEmailDocSize;
  const storageUsed = docSize + attachSize;
  const storageLimit = customer?.storageQuota || DEFAULT_STORAGE_QUOTA;
  const isFull = storageUsed >= storageLimit;

  const rawPercent = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;
  let usagePercent = 0;
  if (storageUsed > 0) {
    if (rawPercent < 0.1) {
      usagePercent = Number(rawPercent.toFixed(2));
    } else if (rawPercent < 10) {
      usagePercent = Number(rawPercent.toFixed(1));
    } else {
      usagePercent = Math.min(100, Number(rawPercent.toFixed(1)));
    }
  }

  return {
    storageUsed,
    storageLimit,
    docSize,
    attachSize,
    isFull,
    usagePercent,
  };
}

export async function checkStorageQuota(
  prisma: PrismaClient,
  customerId: string,
  additionalBytes = 0
): Promise<{ allowed: boolean; reason?: string; stats: StorageStats }> {
  const stats = await getCustomerStorageStats(prisma, customerId);
  if (stats.storageUsed + additionalBytes > stats.storageLimit) {
    return {
      allowed: false,
      reason: 'Kapasitas penyimpanan 5 GB telah penuh. Anda tidak dapat melakukan unggah berkas atau mengirim email baru. Silakan hubungi tim support untuk penambahan kuota.',
      stats,
    };
  }
  return { allowed: true, stats };
}
