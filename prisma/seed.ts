import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Seed must share the backend's ENCRYPTION_KEY or the seeded logins won't decrypt.
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/.env') });
import { PrismaClient } from '@prisma/client';
import { seedDemoData } from '../backend/src/lib/demo-data';

const prisma = new PrismaClient();

async function main() {
  const res = await seedDemoData(prisma);
  console.log(
    `✓ Seeded: admin@${res.domain} / Admin123! | budi@${res.domain} / Customer123! (${res.totalDocuments} docs, ${res.totalTickets} tickets)`
  );
}

main().finally(() => prisma.$disconnect());
