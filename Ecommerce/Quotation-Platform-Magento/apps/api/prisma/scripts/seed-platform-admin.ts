/**
 * Creates (or promotes) a platform-admin account — the one deliberately
 * missing self-service path in the product (see AdminUser.isPlatformAdmin
 * in schema.prisma). Takes credentials as CLI args, not env vars or a
 * hardcoded literal, so a real password never ends up sitting in a file.
 *
 * Usage (from apps/api):
 *   npm run seed:platform-admin -- <email> <password> ["Tenant name"]
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const [, , email, password, tenantName = 'Platform Admin'] = process.argv;
  if (!email || !password) {
    console.error('Usage: npm run seed:platform-admin -- <email> <password> ["Tenant name"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.APP_DATABASE_URL } } });
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });

    if (existing) {
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: { passwordHash, isPlatformAdmin: true },
      });
      console.log(`Promoted existing account ${email} to platform admin and updated its password.`);
      return;
    }

    const tenant = await prisma.tenant.create({ data: { name: tenantName, email } });
    await prisma.adminUser.create({
      data: { tenantId: tenant.id, email, passwordHash, role: 'owner', isPlatformAdmin: true },
    });
    console.log(`Created platform admin ${email} under tenant "${tenantName}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to seed platform admin:', err);
  process.exit(1);
});
