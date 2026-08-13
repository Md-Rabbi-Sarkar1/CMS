<<<<<<< HEAD
declare const process: { env: Record<string, string | undefined>; exit: (code?: number) => never };
=======
>>>>>>> feat/phase-12-daily-work-reports
import bcrypt from "bcryptjs";

import { prisma } from "../src/index.js";

const COMPANY_SLUG = "demo-construction";
const COMPANY_NAME = "Demo Construction Co.";
const ADMIN_EMAIL = "admin@demo.local";
const ADMIN_NAME = "Alex Admin";
const ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD ?? "Password123!";
const SALT_ROUNDS = 12;

async function main(): Promise<void> {
  const company = await prisma.company.upsert({
    where: { slug: COMPANY_SLUG },
    update: { name: COMPANY_NAME },
    create: {
      slug: COMPANY_SLUG,
      name: COMPANY_NAME,
    },
    select: { id: true },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: ADMIN_EMAIL,
      },
    },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      companyId: company.id,
      name: ADMIN_NAME,
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

  console.log(`Seed complete: company "${COMPANY_SLUG}" + ADMIN "${ADMIN_EMAIL}".`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
