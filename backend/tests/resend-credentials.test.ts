import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mailboxRoutes from '../src/routes/mailboxes';
import { authenticateOfficerOrAdmin } from '../src/middleware/auth';
import { encrypt } from '../src/lib/crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const signToken = (id: string, email: string, type: 'admin' | 'customer', role?: string) =>
  jwt.sign({ id, email, type, role }, JWT_SECRET, { expiresIn: '1h' });

describe('POST /api/mailboxes/:id/resend-credentials', () => {
  const mockPrisma: any = {
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const app = express();
  app.use(express.json());
  app.use('/api/mailboxes', authenticateOfficerOrAdmin, mailboxRoutes(mockPrisma));

  const sampleCust = {
    id: 'cust-abc',
    name: 'PT Klien Utama',
    mailboxAddress: 'klien@clienteasylegal.co.id',
    personalEmail: 'personal@klien.com',
    passwordEnc: encrypt('Rahasia!123'),
    status: 'active',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows superadmin to resend credentials to customer personal email', async () => {
    const adminToken = signToken('admin-1', 'admin@clienteasylegal.co.id', 'admin', 'superadmin');
    mockPrisma.customer.findUnique.mockResolvedValue(sampleCust);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/mailboxes/cust-abc/resend-credentials')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mailboxAddress).toBe('klien@clienteasylegal.co.id');
    expect(res.body.personalEmail).toBe('personal@klien.com');
    expect(res.body.temporaryPassword).toBe('Rahasia!123');
  });

  it('allows officer to resend credentials to customer personal email', async () => {
    const officerToken = signToken('officer-1', 'officer@clienteasylegal.co.id', 'admin', 'officer');
    mockPrisma.customer.findUnique.mockResolvedValue(sampleCust);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/mailboxes/cust-abc/resend-credentials')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mailboxAddress).toBe('klien@clienteasylegal.co.id');
    expect(res.body.personalEmail).toBe('personal@klien.com');
    expect(res.body.temporaryPassword).toBe('Rahasia!123');
  });

  it('blocks customer from accessing resend credentials endpoint with 403 Forbidden', async () => {
    const customerToken = signToken('cust-1', 'budi@clienteasylegal.co.id', 'customer');
    const res = await request(app)
      .post('/api/mailboxes/cust-abc/resend-credentials')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('blocks unauthenticated requests with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/mailboxes/cust-abc/resend-credentials');

    expect(res.status).toBe(401);
  });
});
