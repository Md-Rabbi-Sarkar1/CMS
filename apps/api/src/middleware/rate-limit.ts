import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory fixed-window limiter. Sufficient for the documented pre-production
// requirement; a distributed store would only be needed for multi-instance
// deployments, which the architecture does not currently specify.
export function rateLimit({ windowMs, maxRequests }: RateLimitOptions, enabled = env.NODE_ENV !== "test") {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only mutating methods are throttled. Read-only traffic (SSR page loads,
    // health probes) all flows through here and must never produce 429s for
    // legitimate use; brute-force targets (login, refresh, writes) are all
    // mutating methods.
    if (!enabled || req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }

    const key = req.ip ?? "unknown";
    const now = Date.now();
    let bucket = buckets.get(key);

    if (bucket === undefined || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > maxRequests) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests, please retry later" },
      });
      return;
    }

    next();
  };
}

// Auth endpoints are the primary brute-force target; keep them stricter than
// the general write-traffic ceiling.
export const globalRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 300 });
export const authRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 30 });
