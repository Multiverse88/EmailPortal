import bcrypt from 'bcryptjs';
import app, { prisma } from './app';
import { SyncWorker } from './workers/sync';

const PORT = process.env.PORT || 4000;
const worker = new SyncWorker(prisma);

async function ensureSuperAdmin() {
  try {
    const domain = (process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id').trim().toLowerCase();
    const adminEmail = `admin@${domain}`;
    const superAdmin = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { role: 'superadmin' },
          { email: adminEmail },
        ],
      },
    });

    if (!superAdmin) {
      console.log(`🌱 [EasyLegal] Menginisialisasi akun Super Admin: ${adminEmail}...`);
      const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin123!';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await prisma.adminUser.create({
        data: {
          name: 'Admin Utama EasyLegal',
          email: adminEmail,
          passwordHash,
          role: 'superadmin',
          isActive: true,
        },
      });
      console.log(`✓ [EasyLegal] Akun Super Admin siap (${adminEmail})!`);
    }
  } catch (err) {
    console.error('✗ [EasyLegal] Error menginisialisasi Super Admin:', err);
  }
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');

    await ensureSuperAdmin();

    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    await worker.start();
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    worker.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

startServer();
