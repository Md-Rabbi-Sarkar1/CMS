import { describe, expect, it } from "vitest";

import type { ApiSuccessResponse } from "./index.js";

describe("shared package", () => {
  it("exports shared API response types", () => {
    const response: ApiSuccessResponse<{ ok: boolean }> = {
      success: true,
      data: { ok: true },
    };

    expect(response.success).toBe(true);
  });
});
