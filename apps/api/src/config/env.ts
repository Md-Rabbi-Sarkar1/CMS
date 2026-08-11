import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

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

export function loadEnvironment(): NodeJS.ProcessEnv {
  for (const envPath of candidateEnvPaths()) {
    applyEnvFile(envPath);
  }

  return process.env;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
});

const parsedEnv = envSchema.safeParse(loadEnvironment());

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsedEnv.data;
