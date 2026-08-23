import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/construction_ops?schema=public";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default function globalSetup(): void {
  const root = resolve(currentDir, "../..");
  const env = { ...process.env, DATABASE_URL };

  execSync("pnpm --filter @construction-ops/database exec prisma migrate deploy", {
    cwd: root,
    env,
    stdio: "inherit",
  });

  execSync("pnpm --filter @construction-ops/database seed", {
    cwd: root,
    env: { ...env, DEV_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? "Password123!" },
    stdio: "inherit",
  });
}
