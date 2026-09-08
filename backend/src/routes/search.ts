import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';

// ponytail: SQL LIKE over the message cache. Swap in Meilisearch when the
// corpus outgrows it (>100k messages or search creeps past ~1s).
export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { query, limit = 20, offset = 0, folder } = req.body ?? {};
      if (!query?.trim()) return res.status(400).json({ error: 'Query wajib diisi' });

      const q = query.trim();
      const where: any = {
        mailboxId: req.user!.id,
        OR: [
          { subject: { contains: q } },
          { sender: { contains: q } },
          { snippet: { contains: q } },
          { bodyText: { contains: q } },
        ],
      };
      if (folder) where.folder = folder;

      const [hits, total] = await Promise.all([
        prisma.messageCache.findMany({
          where,
          take: Math.min(100, limit),
          skip: offset,
          orderBy: { receivedAt: 'desc' },
          select: {
            id: true, uid: true, folder: true, subject: true, sender: true,
            snippet: true, isRead: true, isStarred: true, receivedAt: true,
          },
        }),
        prisma.messageCache.count({ where }),
      ]);

      res.json({ hits, total });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Pencarian gagal' });
    }
  });

  return router;
};
