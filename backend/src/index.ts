import app, { prisma } from './app';
import { SyncWorker } from './workers/sync';
import { seedDemoData } from './lib/demo-data';

const PORT = process.env.PORT || 4000;
const worker = new SyncWorker(prisma);

async function ensureSeedData() {
  try {
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0 || process.env.FORCE_SEED_DEMO === 'true') {
      console.log('🌱 [EasyLegal] No admin accounts detected (or FORCE_SEED_DEMO active). Initializing demo accounts and data...');
      const res = await seedDemoData(prisma);
      console.log(`✓ [EasyLegal] Database initialized successfully! Admin: admin@${res.domain} (password: Admin123!)`);
    } else {
      console.log(`✓ [EasyLegal] Database verified (${adminCount} admin accounts present).`);
    }
  } catch (seedErr) {
    console.error('✗ [EasyLegal] Seeding error during startup:', seedErr);
  }
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');

    await ensureSeedData();

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
