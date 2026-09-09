import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  authenticateSuperAdmin,
  authenticateOfficerOrAdmin,
  authenticateCustomer,
} from '../src/middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('RBAC Middleware', () => {
  const app = express();
  app.use(express.json());

  app.get('/api/superadmin-only', authenticateSuperAdmin, (req, res) => {
    res.json({ message: 'Welcome Super Admin', user: req.user });
  });

  app.get('/api/officer-or-admin', authenticateOfficerOrAdmin, (req, res) => {
    res.json({ message: 'Welcome Staff', user: req.user });
  });

  app.get('/api/customer-only', authenticateCustomer, (req, res) => {
    res.json({ message: 'Welcome Customer', user: req.user });
  });

  const signToken = (id: string, email: string, type: 'admin' | 'customer', role?: string) =>
    jwt.sign({ id, email, type, role }, JWT_SECRET, { expiresIn: '1h' });

  it('allows superadmin to access superadmin and officer endpoints', async () => {
    const token = signToken('admin-1', 'admin@clienteasylegal.co.id', 'admin', 'superadmin');
    const res1 = await request(app).get('/api/superadmin-only').set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app).get('/api/officer-or-admin').set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(200);
  });

  it('allows officer to access officer endpoint but blocks from superadmin endpoint', async () => {
    const token = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    const res1 = await request(app).get('/api/officer-or-admin').set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app).get('/api/superadmin-only').set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(403);
  });

  it('blocks customer from admin/officer endpoints', async () => {
    const token = signToken('cust-1', 'budi@clienteasylegal.co.id', 'customer');
    const res = await request(app).get('/api/superadmin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
