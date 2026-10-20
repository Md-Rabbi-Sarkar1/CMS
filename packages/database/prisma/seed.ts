import bcrypt from "bcryptjs";

import { prisma } from "../src/index.js";

const COMPANY_SLUG = "demo-construction";
const COMPANY_NAME = "Demo Construction Co.";
const ADMIN_EMAIL = "admin@demo.local";
const ADMIN_NAME = "Alex Admin";
const ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD ?? "Password123!";
const SALT_ROUNDS = 12;
const DEMO_USERS = [
  { email: "mdrabbisarkar70@gmail.com", name: "Demo Project Manager", password: "11111111", role: "PROJECT_MANAGER" as const },
  { email: "mdrabbisarkar71@gmail.com", name: "Demo Engineer", password: "11111111", role: "ENGINEER" as const },
  { email: "mdrabbisarkar72@gmail.com", name: "Demo Worker", password: "11111111", role: "WORKER" as const },
];

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

  for (const demoUser of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demoUser.password, SALT_ROUNDS);
    await prisma.user.upsert({
      where: { companyId_email: { companyId: company.id, email: demoUser.email } },
      update: { name: demoUser.name, passwordHash, role: demoUser.role },
      create: {
        companyId: company.id,
        email: demoUser.email,
        name: demoUser.name,
        passwordHash,
        role: demoUser.role,
      },
      select: { id: true },
    });
  }

  console.log(`Seed complete: company "${COMPANY_SLUG}" + demo role users.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
