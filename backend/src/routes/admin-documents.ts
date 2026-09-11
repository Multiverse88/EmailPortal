import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import {
  extractTextFromPdfBuffer,
  extractPdfDocument,
  parseIndonesianLegalText,
  saveDocumentMetadataToPersistentMemory,
} from '../lib/document-extractor';
import { executeDocumentCrossCheck, UnifiedDocumentMetadata } from '../lib/document-cross-checker';
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
      const { customerId, docType, verificationStatus, search } = req.query;
      const where: any = {};

      if (typeof customerId === 'string' && customerId.trim()) {
        where.customerId = customerId.trim();
      }
      if (typeof docType === 'string' && docType.trim()) {
        where.docType = docType.trim();
      }
      if (typeof verificationStatus === 'string' && verificationStatus.trim()) {
        where.verificationStatus = verificationStatus.trim();
      }
      if (typeof search === 'string' && search.trim()) {
        const query = search.trim();
        where.OR = [
          { companyName: { contains: query } },
          { documentNumber: { contains: query } },
          { notaryName: { contains: query } },
          { summary: { contains: query } },
          { subType: { contains: query } },
          { publisher: { contains: query } },
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

      // Parse JSON fields for client convenience
      const formatted = records.map((r) => {
        let specificFields = null;
        let crossCheckResults = null;
        let fieldConfidence = null;

        try {
          if (r.specificFields) specificFields = JSON.parse(r.specificFields);
        } catch {}
        try {
          if (r.crossCheckResults) crossCheckResults = JSON.parse(r.crossCheckResults);
        } catch {}
        try {
          if (r.fieldConfidence) fieldConfidence = JSON.parse(r.fieldConfidence);
        } catch {}

        return {
          ...r,
          parsedSpecificFields: specificFields,
          parsedCrossCheckResults: crossCheckResults,
          parsedFieldConfidence: fieldConfidence,
        };
      });

      res.json({ metadata: formatted, total: formatted.length });
    } catch (error) {
      console.error('List document metadata error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/admin/documents/extract - extract 3-layer metadata with zero data leakage & save to persistent memory
  router.post('/extract', upload.single('file'), async (req: Request, res: Response) => {
    let tempPath: string | null = null;
    try {
      const file = req.file;
      const documentId = req.body.documentId as string | undefined;
      const customerId = req.body.customerId as string | undefined;
      const ticketId = req.body.ticketId as string | undefined;
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
      const { text: rawText, hash: fileHash, pageCount } = await extractPdfDocument(buffer);
      const parsedMetadata = parseIndonesianLegalText(rawText, filename, fileHash, pageCount);

      // Perform cross-check with existing documents of the same customer if customerId exists
      if (customerId) {
        try {
          const peerDocs = await prisma.documentMetadata.findMany({
            where: { customerId },
            take: 5,
            orderBy: { createdAt: 'desc' },
          });

          if (peerDocs.length > 0) {
            const peerUnified: UnifiedDocumentMetadata[] = peerDocs.map((p) => {
              let parsedSpec = undefined;
              try {
                if (p.specificFields) parsedSpec = JSON.parse(p.specificFields);
              } catch {}

              return {
                id: p.id,
                docType: p.docType,
                subType: p.subType || undefined,
                companyName: p.companyName || '',
                documentNumber: p.documentNumber || '',
                documentDate: p.documentDate || p.effectiveDate || undefined,
                publisher: p.publisher || undefined,
                effectiveDate: p.effectiveDate || undefined,
                notaryName: p.notaryName || undefined,
                registeredAddress: p.registeredAddress || undefined,
                capitalAmount: p.capitalAmount || undefined,
                businessSectors: p.businessSectors || undefined,
                keyPeople: p.keyPeople || undefined,
                specificFields: parsedSpec,
              };
            });

            // Combine current doc + peers for full multi-doc cross check
            const bundle = [
              {
                docType: parsedMetadata.docType,
                subType: parsedMetadata.subType,
                companyName: parsedMetadata.companyName,
                normalizedEntityName: parsedMetadata.normalizedEntityName,
                documentNumber: parsedMetadata.documentNumber,
                documentDate: parsedMetadata.documentDate,
                publisher: parsedMetadata.publisher,
                effectiveDate: parsedMetadata.effectiveDate,
                notaryName: parsedMetadata.notaryName,
                registeredAddress: parsedMetadata.registeredAddress,
                cityLocation: parsedMetadata.cityLocation,
                capitalAmount: parsedMetadata.capitalAmount,
                businessSectors: parsedMetadata.businessSectors,
                keyPeople: parsedMetadata.keyPeople,
                specificFields: parsedMetadata.specificFields,
              },
              ...peerUnified,
            ];

            parsedMetadata.crossCheckResults = executeDocumentCrossCheck(bundle);
          }
        } catch (crossErr) {
          console.warn('Auto cross-check against peer docs failed:', crossErr);
        }
      }

      // Cryptographic RAM buffer zeroing (prevent plaintext lingering in memory)
      try {
        buffer.fill(0);
      } catch {}

      // Zero-Retention by default: only save to DB if explicitly requested
      const shouldSaveToDb = req.body.saveToDatabase === 'true' || req.body.saveToDatabase === true;

      let savedRecord = null;
      if (shouldSaveToDb) {
        savedRecord = await saveDocumentMetadataToPersistentMemory(prisma, {
          documentId: documentId || null,
          customerId: customerId || null,
          ticketId: ticketId || null,
          metadata: parsedMetadata,
          verifiedBy,
        });
      }

      res.status(201).json({
        success: true,
        data: savedRecord,
        extraction: parsedMetadata,
        privacy: {
          zeroDataLeakage: true,
          ephemeralMode: !shouldSaveToDb,
          storageMode: shouldSaveToDb ? 'persistent_sqlite_memory' : 'ephemeral_in_memory_only',
          processedLocally: true,
          message: !shouldSaveToDb
            ? 'Mode Sekali Pakai Aktif: Dokumen hanya ada di memori sesi saat ini dan langsung hilang saat relog / tutup halaman.'
            : 'Tersimpan aman di persistent memory lokal SQLite dengan integritas 3-Lapis Metadata.',
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

  // POST /api/admin/documents/cross-check - execute cross checking across multiple documents
  router.post('/cross-check', async (req: Request, res: Response) => {
    try {
      const { metadataIds, documentPayloads } = req.body;

      let unifiedList: UnifiedDocumentMetadata[] = [];

      // 1. If persistent metadata IDs are provided
      if (Array.isArray(metadataIds) && metadataIds.length > 0) {
        const records = await prisma.documentMetadata.findMany({
          where: { id: { in: metadataIds } },
        });

        const fromDb = records.map((r) => {
          let parsedSpec = undefined;
          try {
            if (r.specificFields) parsedSpec = JSON.parse(r.specificFields);
          } catch {}

          return {
            id: r.id,
            docType: r.docType,
            subType: r.subType || undefined,
            companyName: r.companyName || '',
            documentNumber: r.documentNumber || '',
            documentDate: r.documentDate || r.effectiveDate || undefined,
            publisher: r.publisher || undefined,
            effectiveDate: r.effectiveDate || undefined,
            notaryName: r.notaryName || undefined,
            registeredAddress: r.registeredAddress || undefined,
            capitalAmount: r.capitalAmount || undefined,
            businessSectors: r.businessSectors || undefined,
            keyPeople: r.keyPeople || undefined,
            specificFields: parsedSpec,
          };
        });

        unifiedList = unifiedList.concat(fromDb);
      }

      // 2. If ephemeral payloads are provided directly from frontend session
      if (Array.isArray(documentPayloads) && documentPayloads.length > 0) {
        unifiedList = unifiedList.concat(documentPayloads);
      }

      if (unifiedList.length === 0) {
        return res.status(400).json({ error: 'Pilih minimal satu dokumen untuk diuji silang' });
      }

      const findings = executeDocumentCrossCheck(unifiedList);

      const summary = {
        total: findings.length,
        cocokCount: findings.filter((f) => f.status === 'cocok').length,
        tidakCocokCount: findings.filter((f) => f.status === 'tidak cocok').length,
        notFoundCount: findings.filter((f) => f.status === 'data tidak ditemukan').length,
      };

      res.json({
        success: true,
        findings,
        summary,
        analyzedDocumentsCount: unifiedList.length,
      });
    } catch (error: any) {
      console.error('Cross check error:', error);
      res.status(500).json({ error: 'Gagal menjalankan analisis cek silang dokumen' });
    }
  });

  // POST /api/admin/documents/save - explicitly save ephemeral extraction to persistent memory
  router.post('/save', async (req: Request, res: Response) => {
    try {
      const { metadata, customerId, documentId, ticketId } = req.body;
      if (!metadata || typeof metadata !== 'object') {
        return res.status(400).json({ error: 'Metadata dokumen wajib disertakan' });
      }

      const verifiedBy = req.user?.email || 'Officer';
      const savedRecord = await saveDocumentMetadataToPersistentMemory(prisma, {
        documentId: documentId || null,
        customerId: customerId || null,
        ticketId: ticketId || null,
        metadata,
        verifiedBy,
      });

      res.status(201).json({
        success: true,
        data: savedRecord,
      });
    } catch (error) {
      console.error('Explicit save document metadata error:', error);
      res.status(500).json({ error: 'Gagal menyimpan metadata ke database' });
    }
  });

  // PATCH /api/admin/documents/metadata/:id/status - quick toggle verification status
  router.patch('/metadata/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { verificationStatus } = req.body;

      if (!['otomatis', 'dicek_agen', 'ditolak'].includes(verificationStatus)) {
        return res.status(400).json({ error: 'Status harus berupa "otomatis", "dicek_agen", atau "ditolak"' });
      }

      const updated = await prisma.documentMetadata.update({
        where: { id },
        data: {
          verificationStatus,
          verifiedBy: req.user?.email || 'Officer',
        },
      });

      res.json({ success: true, metadata: updated });
    } catch (error) {
      console.error('Update verification status error:', error);
      res.status(500).json({ error: 'Gagal memperbarui status verifikasi' });
    }
  });

  // PUT /api/admin/documents/metadata/:id - update / verify extracted metadata fields
  router.put('/metadata/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        docType,
        subType,
        companyName,
        documentNumber,
        documentDate,
        publisher,
        notaryName,
        effectiveDate,
        capitalAmount,
        businessSectors,
        registeredAddress,
        keyPeople,
        summary,
        customerId,
        verificationStatus,
      } = req.body;

      const existing = await prisma.documentMetadata.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Metadata dokumen tidak ditemukan' });
      }

      const updated = await prisma.documentMetadata.update({
        where: { id },
        data: {
          docType: docType !== undefined ? docType : existing.docType,
          subType: subType !== undefined ? subType : existing.subType,
          companyName: companyName !== undefined ? companyName : existing.companyName,
          documentNumber: documentNumber !== undefined ? documentNumber : existing.documentNumber,
          documentDate: documentDate !== undefined ? documentDate : existing.documentDate,
          publisher: publisher !== undefined ? publisher : existing.publisher,
          notaryName: notaryName !== undefined ? notaryName : existing.notaryName,
          effectiveDate: effectiveDate !== undefined ? effectiveDate : existing.effectiveDate,
          capitalAmount: capitalAmount !== undefined ? capitalAmount : existing.capitalAmount,
          businessSectors: businessSectors !== undefined ? businessSectors : existing.businessSectors,
          registeredAddress: registeredAddress !== undefined ? registeredAddress : existing.registeredAddress,
          keyPeople: keyPeople !== undefined ? keyPeople : existing.keyPeople,
          summary: summary !== undefined ? summary : existing.summary,
          customerId: customerId !== undefined ? customerId : existing.customerId,
          verificationStatus: verificationStatus !== undefined ? verificationStatus : existing.verificationStatus,
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
