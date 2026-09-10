import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/.env') });

const prisma = new PrismaClient();

async function main() {
  const domain = (process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id').trim().toLowerCase();
  const adminEmail = `admin@${domain}`;
  const password = process.env.INITIAL_ADMIN_PASSWORD || 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { isActive: true },
    create: {
      name: 'Admin Utama EasyLegal',
      email: adminEmail,
      passwordHash,
      role: 'superadmin',
      isActive: true,
    },
  });

  console.log(`✓ Super Admin initialized: ${admin.email} (Password: ${password})`);
}

main().finally(() => prisma.$disconnect());

