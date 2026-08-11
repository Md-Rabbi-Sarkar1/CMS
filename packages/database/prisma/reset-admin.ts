/**
 * DEV-ONLY helper: resets the development ADMIN user's password to a known value.
 *
 * It changes ONLY the user with email `admin@demo.local` in the company with slug
 * `demo-construction`. Existing rows are never deleted.
 *
 * The password defaults to `Password123!` and can be overridden via the
 * `DEV_ADMIN_PASSWORD` environment variable.
 *
 * NEVER run this against a production database.
 *
 * Usage:
 *   pnpm db:reset-admin
 *   DEV_ADMIN_PASSWORD="..." pnpm db:reset-admin
 */
import bcrypt from "bcryptjs";

import { prisma } from "../src/index.js";

const ADMIN_EMAIL = "admin@demo.local";
const COMPANY_SLUG = "demo-construction";
const DEV_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD ?? "Password123!";
const SALT_ROUNDS = 12;

async function main(): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { slug: COMPANY_SLUG },
    select: { id: true },
  });

  if (!company) {
    console.error(`Company with slug "${COMPANY_SLUG}" not found.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: ADMIN_EMAIL,
      },
    },
    update: {
      passwordHash,
    },
    create: {
      companyId: company.id,
      name: "Alex Admin",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log(`Development ADMIN credential reset for ${admin.email} (role: ${admin.role}).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
