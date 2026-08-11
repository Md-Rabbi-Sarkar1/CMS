import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const currentDir = dirname(fileURLToPath(import.meta.url));
const visitedPaths = new Set<string>();

function parseEnvFile(fileContents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const normalizedContents = fileContents.replace(/^\uFEFF/u, "");

  for (const line of normalizedContents.split(/\r?\n/u)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function applyEnvFile(filePath: string): void {
  if (!existsSync(filePath) || visitedPaths.has(filePath)) {
    return;
  }

  visitedPaths.add(filePath);

  const parsed = parseEnvFile(readFileSync(filePath, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] ??= value;
  }
}

function candidateEnvPaths(): string[] {
  return [
    resolve(process.cwd(), ".env"),
    resolve(currentDir, "../../.env"),
    resolve(currentDir, "../../../.env"),
    resolve(currentDir, "../../../../.env"),
    resolve(currentDir, "../../dist/.env"),
  ];
}

export function loadDatabaseEnvironment(): NodeJS.ProcessEnv {
  for (const envPath of candidateEnvPaths()) {
    applyEnvFile(envPath);
  }

  return process.env;
}

loadDatabaseEnvironment();

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
