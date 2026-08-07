import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
  {
    // ESLint stops at the first config it finds walking up from the cwd, so
    // the repo root's rules never reach this app. `any` is banned project-wide
    // (CLAUDE.md) and next/typescript only warns about it, so state it here or
    // the ban holds in apps/api and packages/shared but not in the app that
    // renders user input.
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];

export default eslintConfig;
