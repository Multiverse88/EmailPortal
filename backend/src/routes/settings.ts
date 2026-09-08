import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';

export default (prisma: PrismaClient) => {
  const router = Router();

  // GET /api/settings - retrieve customer profile and parsed preferences
  router.get('/', async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

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
        user,
        preferences,
      });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/settings/preferences - update customer preferences JSON
  router.put('/preferences', async (req: Request, res: Response) => {
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
