import app, { prisma } from './app';
import { SyncWorker } from './workers/sync';

const PORT = process.env.PORT || 4000;
const worker = new SyncWorker(prisma);

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');

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
