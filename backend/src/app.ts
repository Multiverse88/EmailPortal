import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin, authenticateCustomer, authenticateOfficerOrAdmin } from './middleware/auth';
import authRoutes from './routes/auth';
import mailboxRoutes from './routes/mailboxes';
import emailRoutes from './routes/email';
import searchRoutes from './routes/search';
import securityRoutes from './routes/security';
import settingsRoutes from './routes/settings';
import documentsRoutes from './routes/documents';
import supportRoutes from './routes/support';
import storageRoutes from './routes/storage';
import companionRoutes from './routes/companion';

const app = express();
export const prisma = new PrismaClient();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global IP rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.GLOBAL_RATE_LIMIT || '200'),
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    // In test environment, group by user or dummy IP to avoid rate limit flakiness across test suites
    return req.ip || 'test-client';
  },
}));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes(prisma));
app.use('/api/mailboxes', authenticateOfficerOrAdmin, mailboxRoutes(prisma));
app.use('/api/email', authenticateCustomer, emailRoutes(prisma));
app.use('/api/search', authenticateCustomer, searchRoutes(prisma));
app.use('/api/security', securityRoutes(prisma));
app.use('/api/settings', authenticateCustomer, settingsRoutes(prisma));
app.use('/api/documents', authenticateCustomer, documentsRoutes(prisma));
app.use('/api/support', authenticateCustomer, supportRoutes(prisma));
app.use('/api/storage', storageRoutes(prisma));
app.use('/api/companion', companionRoutes(prisma));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;
