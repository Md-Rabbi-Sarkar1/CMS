import baseConfig from "@construction-ops/config/eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: [".next/", "next-env.d.ts"],
  },
];
