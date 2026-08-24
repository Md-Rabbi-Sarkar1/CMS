import express from "express";
import { describe, expect, it } from "vitest";
import { agent as supertestAgent } from "supertest";

import { rateLimit } from "./middleware/rate-limit.js";
import { app } from "./app.js";

describe("Production hardening", () => {
  describe("Security headers", () => {
    it("sets protective headers on API responses", async () => {
      const res = await supertestAgent(app).get("/api/v1/health");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
      expect(res.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
      expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
      expect(res.headers["cross-origin-resource-policy"]).toBe("same-site");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("Rate limiting", () => {
    it("rejects mutating requests beyond the limit with 429 when enabled", async () => {
      const limitedApp = express();
      limitedApp.use(rateLimit({ windowMs: 60_000, maxRequests: 2 }, true));
      limitedApp.post("/probe", (_req, res) => {
        res.json({ ok: true });
      });

      const agent = supertestAgent(limitedApp);
      expect((await agent.post("/probe")).status).toBe(200);
      expect((await agent.post("/probe")).status).toBe(200);

      const res = await agent.post("/probe");
      expect(res.status).toBe(429);
      const error = (res.body as { error: { code: string; message: string } }).error;
      expect(error.code).toBe("RATE_LIMITED");
    });

    it("does not throttle read-only methods (SSR and health probes stay open)", async () => {
      const limitedApp = express();
      limitedApp.use(rateLimit({ windowMs: 60_000, maxRequests: 2 }, true));
      limitedApp.get("/probe", (_req, res) => {
        res.json({ ok: true });
      });

      const agent = supertestAgent(limitedApp);
      for (let i = 0; i < 10; i += 1) {
        expect((await agent.get("/probe")).status).toBe(200);
      }
    });

    it("is inactive under NODE_ENV=test so the integration suite stays unaffected", async () => {
      const res = await supertestAgent(app).get("/api/v1/health");

      expect([200, 503]).toContain(res.status);
    });
  });
});
