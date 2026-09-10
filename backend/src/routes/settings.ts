import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'node:path';
import { storage } from '../lib/storage';
import { getCustomerStorageStats } from '../lib/quota';
import { getAccountFolderName } from '../lib/synology-sync';
import { computeRetention } from '../lib/retention';
import { authenticateCustomer, verifyToken } from '../middleware/auth';

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya berkas gambar (PNG, JPG, WebP, SVG) yang diperbolehkan'));
    }
  },
});

export default (prisma: PrismaClient) => {
  const router = Router();

  // Helper to stream avatar given a customerId
  const streamAvatarForCustomer = async (customerId: string, res: Response) => {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { avatarUrl: true },
    });

    if (!customer || !customer.avatarUrl) {
      return res.status(404).json({ error: 'Avatar belum diatur' });
    }

    const storageKey = customer.avatarUrl;
    if (!(await storage.objectExists(storageKey))) {
      return res.status(404).json({ error: 'Berkas avatar tidak ditemukan di storage' });
    }

    const ext = path.extname(storageKey).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = await storage.getObjectStream(storageKey);
    stream.on('error', (err) => {
      console.error('Avatar stream error:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'Berkas avatar tidak ditemukan' });
      }
    });
    return stream.pipe(res);
  };

  // GET /api/settings/avatar/:customerId - public streaming for <img> tags
  router.get('/avatar/:customerId', async (req: Request, res: Response) => {
    try {
      await streamAvatarForCustomer(req.params.customerId, res);
    } catch (error) {
      console.error('Stream avatar by ID error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/settings/avatar - backwards-compatible streaming with customerId query or token
  router.get('/avatar', async (req: Request, res: Response) => {
    try {
      let customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;

      if (!customerId) {
        const authHeader = req.headers.authorization;
        let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        if (!token && typeof req.query.token === 'string') {
          token = req.query.token;
        }

        if (token) {
          try {
            const payload = verifyToken(token);
            if (payload.type === 'customer') {
              customerId = payload.id;
            }
          } catch {}
        }
      }

      if (!customerId && (req as any).user?.id) {
        customerId = (req as any).user.id;
      }

      if (!customerId) {
        return res.status(401).json({ error: 'Unauthorized or customerId missing' });
      }

      await streamAvatarForCustomer(customerId, res);
    } catch (error) {
      console.error('Stream avatar error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/settings - retrieve customer profile and parsed preferences with storage stats
  router.get('/', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const [customer, storageStats] = await Promise.all([
        prisma.customer.findUnique({
          where: { id: customerId },
        }),
        getCustomerStorageStats(prisma, customerId),
      ]);

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      let preferences: Record<string, any> = {};
      if (customer.preferences) {
        try {
          preferences = JSON.parse(customer.preferences);
        } catch {
          preferences = {};
        }
      }

      // Exclude password hash/encryption for security
      const { passwordEnc, ...user } = customer;

      res.json({
        user: {
          ...user,
          avatarUrl: customer.avatarUrl ? `/api/settings/avatar/${customer.id}?v=${new Date(customer.updatedAt).getTime()}` : null,
          storageQuota: storageStats.storageLimit,
          storageUsed: storageStats.storageUsed,
          isStorageFull: storageStats.isFull,
        },
        preferences,
        storageStats,
        retention: computeRetention(customer.createdAt),
      });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/settings/avatar - upload company logo / profile picture to isolated IDCloudHost storage
  router.post('/avatar', authenticateCustomer, (req: Request, res: Response, next) => {
    uploadAvatar.single('avatar')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Gagal mengunggah foto profil' });
      }
      next();
    });
  }, async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Tidak ada berkas gambar yang dipilih' });
      }

      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Delete old avatar if existing in S3
      if (customer.avatarUrl) {
        try {
          await storage.deleteObject(customer.avatarUrl);
        } catch {}
      }

      // Save to IDCloudHost S3 with isolated tenant path
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      const storageKey = `accounts/${customerId}/avatar/logo_${Date.now()}${ext}`;

      await storage.putObject(storageKey, file.buffer, file.mimetype);

      // Mirror to Synology with human-readable account folder
      try {
        const accountFolder = getAccountFolderName(customer);
        const synologyPath = `accounts/${accountFolder}/avatar/logo${ext}`;
        await storage.mirrorToSynology(synologyPath, file.buffer);
      } catch (mirrorErr) {
        console.warn('Could not mirror avatar to Synology:', mirrorErr);
      }

      // Save to database
      await prisma.customer.update({
        where: { id: customerId },
        data: { avatarUrl: storageKey },
      });

      const displayUrl = `/api/settings/avatar/${customerId}?v=${Date.now()}`;
      res.json({
        success: true,
        message: 'Logo perusahaan berhasil diperbarui',
        avatarUrl: displayUrl,
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      res.status(500).json({ error: 'Gagal mengunggah logo perusahaan' });
    }
  });

  // DELETE /api/settings/avatar - remove company logo and reset to default
  router.delete('/avatar', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });

      if (customer?.avatarUrl) {
        try {
          await storage.deleteObject(customer.avatarUrl);
        } catch {}
        await prisma.customer.update({
          where: { id: customerId },
          data: { avatarUrl: null },
        });
      }

      res.json({ success: true, message: 'Logo berhasil dihapus' });
    } catch (error) {
      console.error('Delete avatar error:', error);
      res.status(500).json({ error: 'Gagal menghapus logo' });
    }
  });

  // PUT /api/settings/preferences - update customer preferences JSON
  router.put('/preferences', authenticateCustomer, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      let currentPrefs: Record<string, any> = {};
      if (customer.preferences) {
        try {
          currentPrefs = JSON.parse(customer.preferences);
        } catch {
          currentPrefs = {};
        }
      }

      // Support either { preferences: { ... } } wrapper or flat object payload
      const patch =
        req.body?.preferences !== undefined &&
        typeof req.body?.preferences === 'object' &&
        req.body?.preferences !== null
          ? req.body.preferences
          : req.body && typeof req.body === 'object'
            ? req.body
            : {};

      const mergedPrefs = { ...currentPrefs, ...patch };

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          preferences: JSON.stringify(mergedPrefs),
        },
      });

      res.json({ preferences: mergedPrefs });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
