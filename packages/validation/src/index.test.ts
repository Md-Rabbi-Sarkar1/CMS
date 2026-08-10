import { describe, expect, it } from "vitest";

import { paginationQuerySchema } from "./index.js";

describe("validation package", () => {
  it("applies pagination defaults", () => {
    const result = paginationQuerySchema.parse({});

    expect(result).toEqual({ page: 1, pageSize: 20 });
  });
});
