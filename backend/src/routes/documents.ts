import { NextFunction, Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { storage } from '../lib/storage';
import { getCustomerStorageStats, checkStorageQuota, DEFAULT_STORAGE_QUOTA } from '../lib/quota';
import { getAccountFolderName, sanitizeFileName } from '../lib/synology-sync';

const storageBase = process.env.STORAGE_DIR || './storage';
export const STORAGE_DIR = path.isAbsolute(storageBase)
  ? storageBase
  : fs.existsSync(path.resolve(process.cwd(), storageBase))
    ? path.resolve(process.cwd(), storageBase)
    : fs.existsSync(path.resolve(process.cwd(), 'backend', storageBase))
      ? path.resolve(process.cwd(), 'backend', storageBase)
      : path.resolve(__dirname, '../../storage');

fs.mkdirSync(STORAGE_DIR, { recursive: true });

const upload = multer({
  dest: STORAGE_DIR,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

const DEFAULT_FOLDERS = ['Client Agreements', 'Tax Filings', 'NDA Templates'];
const STORAGE_LIMIT = DEFAULT_STORAGE_QUOTA; // 5 GB in bytes

const COLD_STORAGE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;
export const isDocumentColdStorage = (createdAt: Date | string) => {
  return (Date.now() - new Date(createdAt).getTime()) > COLD_STORAGE_THRESHOLD_MS;
};

export default (prisma: PrismaClient) => {
  const router = Router();

  const handleUpload = (req: Request, res: Response, next: NextFunction) => {
    upload.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Gagal mengunggah berkas' });
      }
      if (!req.file && Array.isArray((req as any).files) && (req as any).files.length > 0) {
        req.file = (req as any).files[0];
      }
      next();
    });
  };

  // GET /api/documents - list documents, folders, storage stats
  router.get('/', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const categoryFilter = (req.query.category || req.query.folder) as string | undefined;
      const isStarredFilter = req.query.isStarred === 'true' || req.query.isStarred === '1';
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

      const where: any = { customerId };

      if (categoryFilter) {
        where.category = categoryFilter;
      }

      if (isStarredFilter) {
        where.isStarred = true;
      }

      if (search) {
        where.OR = [
          { title: { contains: search } },
          { filename: { contains: search } },
        ];
      }

      const [documents, distinctCategories, storageStats] = await Promise.all([
        prisma.legalDocument.findMany({
          where,
          include: {
            versions: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.legalDocument.findMany({
          where: { customerId },
          select: { category: true },
          distinct: ['category'],
        }),
        getCustomerStorageStats(prisma, customerId),
      ]);

      const folders = Array.from(
        new Set([
          ...DEFAULT_FOLDERS,
          ...distinctCategories.map((c) => c.category).filter(Boolean),
        ])
      );

      const mappedDocuments = documents.map((doc) => ({
        ...doc,
        isColdStorage: isDocumentColdStorage(doc.createdAt),
      }));

      res.json({
        documents: mappedDocuments,
        folders,
        storageUsed: storageStats.storageUsed,
        storageLimit: storageStats.storageLimit,
        isStorageFull: storageStats.isFull,
      });
    } catch (error) {
      console.error('List documents error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/documents/upload - upload document and create initial version
  router.post('/upload', handleUpload, async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Tidak ada berkas yang diunggah' });
      }

      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });

      // Check storage quota (5 GB max)
      const quotaCheck = await checkStorageQuota(prisma, customerId, file.size);
      if (!quotaCheck.allowed) {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch {}
        }
        return res.status(403).json({
          error: quotaCheck.reason,
          code: 'STORAGE_QUOTA_EXCEEDED',
          storageUsed: quotaCheck.stats.storageUsed,
          storageLimit: quotaCheck.stats.storageLimit,
        });
      }

      const title = req.body.title?.trim() || file.originalname;
      const category = req.body.category?.trim() || 'Client Agreements';
      const status = req.body.status?.trim() || 'Reviewed';
      const ownerName = req.body.ownerName?.trim() || customer?.name || 'Legal Team';

      // Persist to storage adapter with isolated account namespace & mirror to Synology
      if (fs.existsSync(file.path)) {
        try {
          const fileBuffer = await fs.promises.readFile(file.path);
          const storageKey = `accounts/${customerId}/documents/${path.basename(file.path)}`;
          await storage.putObject(storageKey, fileBuffer, file.mimetype || 'application/pdf');

          // Mirror to Synology with human-readable account folder & filename
          const accountFolder = getAccountFolderName(customer || { mailboxAddress: req.user!.email });
          const synologyKey = `accounts/${accountFolder}/documents/${sanitizeFileName(file.originalname)}`;
          await storage.mirrorToSynology(synologyKey, fileBuffer);
        } catch (storageErr) {
          console.warn('Warning: could not mirror to storage adapter:', storageErr);
        }
      }

      const document = await prisma.legalDocument.create({
        data: {
          customerId,
          title,
          category,
          filename: file.originalname,
          mimeType: file.mimetype || 'application/pdf',
          size: file.size,
          path: path.basename(file.path),
          status,
          isStarred: false,
          ownerName,
          versions: {
            create: [
              {
                versionNumber: 'v1.0',
                authorName: customer?.name || 'Client',
                approved: true,
                notes: req.body.notes?.trim() || 'Initial upload',
              },
            ],
          },
        },
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      res.status(201).json({
        document: {
          ...document,
          isColdStorage: false,
        },
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({ error: 'Gagal mengunggah dokumen' });
    }
  });

  // GET /api/documents/:id - get document detail with versions
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const document = await prisma.legalDocument.findFirst({
        where: { id: req.params.id, customerId },
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!document) {
        return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      }

      res.json({
        document: {
          ...document,
          isColdStorage: isDocumentColdStorage(document.createdAt),
        },
        versions: document.versions,
      });
    } catch (error) {
      console.error('Get document detail error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/documents/:id/download - stream file from storage
  router.get('/:id/download', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const document = await prisma.legalDocument.findFirst({
        where: { id: req.params.id, customerId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      }

      const isColdStorage = isDocumentColdStorage(document.createdAt);
      const filePath = path.resolve(STORAGE_DIR, path.basename(document.path));
      const accountBucketKey = `accounts/${customerId}/documents/${path.basename(document.path)}`;
      const legacyBucketKey = `documents/${customerId}/${path.basename(document.path)}`;

      // 1. Check legacy storage path on disk
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', document.mimeType || 'application/pdf');
        if (req.query.inline === 'true') {
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.filename)}"`);
          return res.sendFile(filePath);
        } else {
          return res.download(filePath, document.filename);
        }
      }

      // 2. Check storage adapter (isolated account path first, then legacy fallback)
      let streamKey: string | null = null;
      if (await storage.objectExists(accountBucketKey)) {
        streamKey = accountBucketKey;
      } else if (await storage.objectExists(legacyBucketKey)) {
        streamKey = legacyBucketKey;
      }

      if (streamKey) {
        res.setHeader('Content-Type', document.mimeType || 'application/pdf');
        const dispositionType = req.query.inline === 'true' ? 'inline' : 'attachment';
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(document.filename)}"`);
        const stream = await storage.getObjectStream(streamKey);
        return stream.pipe(res);
      }

      // 3. If file missing in hot storage, check if cold storage retention applies
      if (isColdStorage) {
        return res.status(404).json({
          error: 'Berkas telah diarsipkan ke Cold Storage (> 3 Bulan)',
          isColdStorage: true,
        });
      }

      return res.status(404).json({ error: 'File tidak ada di storage', isColdStorage: false });
    } catch (error) {
      console.error('Download document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /api/documents/:id/star - toggle or set isStarred
  router.patch('/:id/star', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const document = await prisma.legalDocument.findFirst({
        where: { id: req.params.id, customerId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      }

      const nextStarred =
        typeof req.body?.isStarred === 'boolean' ? req.body.isStarred : !document.isStarred;

      const updated = await prisma.legalDocument.update({
        where: { id: document.id },
        data: { isStarred: nextStarred },
      });

      res.json({
        isStarred: updated.isStarred,
        document: {
          ...updated,
          isColdStorage: isDocumentColdStorage(updated.createdAt),
        },
      });
    } catch (error) {
      console.error('Star document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/documents/:id - delete document and file
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const document = await prisma.legalDocument.findFirst({
        where: { id: req.params.id, customerId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      }

      await prisma.legalDocument.delete({
        where: { id: document.id },
      });

      const accountBucketKey = `accounts/${customerId}/documents/${path.basename(document.path)}`;
      const legacyBucketKey = `documents/${customerId}/${path.basename(document.path)}`;
      try {
        await storage.deleteObject(accountBucketKey);
      } catch {}
      try {
        await storage.deleteObject(legacyBucketKey);
      } catch (adapterErr) {
        console.warn('Could not remove file from storage adapter:', adapterErr);
      }

      try {
        const filePath = path.resolve(STORAGE_DIR, path.basename(document.path));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.warn('Could not remove file from disk:', fileErr);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
