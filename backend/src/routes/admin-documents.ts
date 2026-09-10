import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { extractTextFromPdfBuffer, parseIndonesianLegalText, saveDocumentMetadataToPersistentMemory } from '../lib/document-extractor';
import { STORAGE_DIR } from './documents';
import { storage } from '../lib/storage';

const upload = multer({
  dest: STORAGE_DIR,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

export default (prisma: PrismaClient) => {
  const router = Router();

  // GET /api/admin/documents/metadata - list all extracted metadata in persistent memory
  router.get('/metadata', async (req: Request, res: Response) => {
    try {
      const { customerId, docType, search } = req.query;
      const where: any = {};

      if (typeof customerId === 'string' && customerId.trim()) {
        where.customerId = customerId.trim();
      }
      if (typeof docType === 'string' && docType.trim()) {
        where.docType = docType.trim();
      }
      if (typeof search === 'string' && search.trim()) {
        const query = search.trim();
        where.OR = [
          { companyName: { contains: query } },
          { documentNumber: { contains: query } },
          { notaryName: { contains: query } },
          { summary: { contains: query } },
        ];
      }

      const records = await prisma.documentMetadata.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, mailboxAddress: true, personalEmail: true },
          },
          document: {
            select: { id: true, title: true, filename: true, category: true, size: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ metadata: records, total: records.length });
    } catch (error) {
      console.error('List document metadata error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/admin/documents/extract - extract metadata with zero data leakage & save to persistent memory
  router.post('/extract', upload.single('file'), async (req: Request, res: Response) => {
    let tempPath: string | null = null;
    try {
      const file = req.file;
      const documentId = req.body.documentId as string | undefined;
      const customerId = req.body.customerId as string | undefined;
      const verifiedBy = req.user?.email || 'Officer';

      let buffer: Buffer | null = null;
      let filename = 'dokumen.pdf';

      if (file) {
        tempPath = file.path;
        buffer = await fs.promises.readFile(file.path);
        filename = file.originalname;
      } else if (documentId) {
        const legalDoc = await prisma.legalDocument.findUnique({
          where: { id: documentId },
        });
        if (!legalDoc) {
          return res.status(404).json({ error: 'Dokumen legal tidak ditemukan di sistem' });
        }
        filename = legalDoc.filename;

        // Try local disk path first
        let diskPath = path.resolve(STORAGE_DIR, legalDoc.path);
        if (!fs.existsSync(diskPath)) {
          diskPath = path.resolve(STORAGE_DIR, path.basename(legalDoc.path));
        }

        if (fs.existsSync(diskPath)) {
          buffer = await fs.promises.readFile(diskPath);
        } else {
          // Fallback to storage adapter
          const accountKey = `accounts/${legalDoc.customerId}/documents/${path.basename(legalDoc.path)}`;
          const stream = await storage.getObjectStream(accountKey);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          buffer = Buffer.concat(chunks);
        }
      } else {
        return res.status(400).json({ error: 'Lampirkan berkas PDF atau masukkan documentId yang valid' });
      }

      if (!buffer) {
        return res.status(400).json({ error: 'Gagal membaca konten berkas PDF' });
      }

      // Local extraction with 0% data leakage
      const rawText = await extractTextFromPdfBuffer(buffer);
      const parsedMetadata = parseIndonesianLegalText(rawText, filename);

      // Save directly into SQLite/Prisma persistent memory
      const savedRecord = await saveDocumentMetadataToPersistentMemory(prisma, {
        documentId: documentId || null,
        customerId: customerId || null,
        metadata: parsedMetadata,
        verifiedBy,
      });

      res.status(201).json({
        success: true,
        data: savedRecord,
        extraction: parsedMetadata,
        privacy: {
          zeroDataLeakage: true,
          storageMode: 'persistent_sqlite_memory',
          processedLocally: true,
        },
      });
    } catch (error: any) {
      console.error('Extract document metadata error:', error);
      res.status(500).json({ error: error.message || 'Gagal mengekstrak metadata dokumen' });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }
    }
  });

  // PUT /api/admin/documents/metadata/:id - update / verify extracted metadata fields
  router.put('/metadata/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        docType,
        companyName,
        documentNumber,
        notaryName,
        effectiveDate,
        capitalAmount,
        businessSectors,
        registeredAddress,
        keyPeople,
        summary,
        customerId,
      } = req.body;

      const existing = await prisma.documentMetadata.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Metadata dokumen tidak ditemukan' });
      }

      const updated = await prisma.documentMetadata.update({
        where: { id },
        data: {
          docType: docType !== undefined ? docType : existing.docType,
          companyName: companyName !== undefined ? companyName : existing.companyName,
          documentNumber: documentNumber !== undefined ? documentNumber : existing.documentNumber,
          notaryName: notaryName !== undefined ? notaryName : existing.notaryName,
          effectiveDate: effectiveDate !== undefined ? effectiveDate : existing.effectiveDate,
          capitalAmount: capitalAmount !== undefined ? capitalAmount : existing.capitalAmount,
          businessSectors: businessSectors !== undefined ? businessSectors : existing.businessSectors,
          registeredAddress: registeredAddress !== undefined ? registeredAddress : existing.registeredAddress,
          keyPeople: keyPeople !== undefined ? keyPeople : existing.keyPeople,
          summary: summary !== undefined ? summary : existing.summary,
          customerId: customerId !== undefined ? customerId : existing.customerId,
          verifiedBy: req.user?.email || existing.verifiedBy,
        },
        include: {
          customer: { select: { id: true, name: true, mailboxAddress: true } },
          document: { select: { id: true, title: true, filename: true } },
        },
      });

      res.json({ success: true, metadata: updated });
    } catch (error) {
      console.error('Update document metadata error:', error);
      res.status(500).json({ error: 'Gagal memperbarui metadata dokumen' });
    }
  });

  // DELETE /api/admin/documents/metadata/:id - delete metadata from persistent memory
  router.delete('/metadata/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.documentMetadata.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete document metadata error:', error);
      res.status(500).json({ error: 'Gagal menghapus metadata' });
    }
  });

  return router;
};
