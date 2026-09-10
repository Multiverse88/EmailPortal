import bcrypt from 'bcryptjs';
import app, { prisma, syncWorker } from './app';

const PORT = process.env.PORT || 4000;
const worker = syncWorker;

async function ensureAdministrativeAccounts() {
  try {
    const domain = (process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id').trim().toLowerCase();
    const adminEmail = `admin@${domain}`;
    const officerEmail = `officer@${domain}`;

    const superAdmin = await prisma.adminUser.findFirst({
      where: {
        OR: [{ role: 'superadmin' }, { email: adminEmail }],
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

    const officer = await prisma.adminUser.findFirst({
      where: {
        OR: [{ role: 'officer' }, { email: officerEmail }],
      },
    });

    if (!officer) {
      console.log(`🌱 [EasyLegal] Menginisialisasi akun Officer: ${officerEmail}...`);
      const defaultOfficerPassword = process.env.INITIAL_OFFICER_PASSWORD || 'Officer123!';
      const officerPasswordHash = await bcrypt.hash(defaultOfficerPassword, 10);
      await prisma.adminUser.create({
        data: {
          name: 'Officer Staf Legal',
          email: officerEmail,
          passwordHash: officerPasswordHash,
          role: 'officer',
          isActive: true,
        },
      });
      console.log(`✓ [EasyLegal] Akun Officer siap (${officerEmail})!`);
    }
  } catch (err) {
    console.error('✗ [EasyLegal] Error menginisialisasi akun administratif:', err);
  }
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');

    await ensureAdministrativeAccounts();

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
