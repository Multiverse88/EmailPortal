import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

// NFR Auditability: every admin action gets a row.
export async function audit(
  prisma: PrismaClient,
  req: Request,
  action: string,
  targetType: string,
  targetId?: string,
  details?: unknown
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action,
        targetType,
        targetId,
        details: details ? JSON.stringify(details) : null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
  } catch (e) {
    console.error('audit log failed:', e);
  }
}
