import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import authRoutes from '../src/routes/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const signToken = (id: string, email: string, type: 'admin' | 'customer', role?: string) =>
  jwt.sign({ id, email, type, role }, JWT_SECRET, { expiresIn: '1h' });

describe('POST /api/auth/impersonate/:customerId', () => {
  const mockPrisma: any = {
    customer: {
      findUnique: jest.fn(),
    },
    loginSession: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes(mockPrisma));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows officer to impersonate an active customer and returns customer token', async () => {
    const officerToken = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust-123',
      name: 'Budi Setiawan',
      mailboxAddress: 'budi@clienteasylegal.co.id',
      status: 'active',
      avatarUrl: null,
      storageQuota: 5368709120,
    });
    mockPrisma.loginSession.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/impersonate/cust-123')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      id: 'cust-123',
      email: 'budi@clienteasylegal.co.id',
      type: 'customer',
      role: 'customer',
    });
    expect(res.body.impersonatedBy).toMatchObject({
      email: 'officer@clienteasylegal.co.id',
      role: 'officer',
    });

    const decoded = jwt.verify(res.body.token, JWT_SECRET) as any;
    expect(decoded.id).toBe('cust-123');
    expect(decoded.email).toBe('budi@clienteasylegal.co.id');
    expect(decoded.type).toBe('customer');

    expect(mockPrisma.loginSession.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('allows superadmin to impersonate active customer', async () => {
    const adminToken = signToken('admin-1', 'admin@clienteasylegal.co.id', 'admin', 'superadmin');
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust-456',
      name: 'PT Sinar Jaya',
      mailboxAddress: 'ptsinarjaya@clienteasylegal.co.id',
      status: 'active',
      avatarUrl: null,
      storageQuota: 5368709120,
    });
    mockPrisma.loginSession.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/impersonate/cust-456')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ptsinarjaya@clienteasylegal.co.id');
    expect(res.body.impersonatedBy.role).toBe('superadmin');
  });

  it('blocks regular customer token with 403 Forbidden', async () => {
    const custToken = signToken('cust-1', 'budi@clienteasylegal.co.id', 'customer');

    const res = await request(app)
      .post('/api/auth/impersonate/cust-999')
      .set('Authorization', `Bearer ${custToken}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 if target customer does not exist', async () => {
    const officerToken = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/impersonate/non-existent-id')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/tidak ditemukan/i);
  });

  it('returns 403 if target customer is inactive', async () => {
    const officerToken = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust-inactive',
      mailboxAddress: 'inactive@clienteasylegal.co.id',
      status: 'inactive',
    });

    const res = await request(app)
      .post('/api/auth/impersonate/cust-inactive')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/dinonaktifkan/i);
  });
});
