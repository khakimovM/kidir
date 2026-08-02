import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

// The monorepo keeps a single .env at the repo root, but workspace scripts
// (`npm run dev --workspace=apps/api`, `ts-node prisma/seed.ts`) run with
// cwd = apps/api, where plain `dotenv/config` finds nothing. Walk up until
// the file turns up.
function findEnvFile(startDir: string): string | undefined {
  let dir = startDir;

  for (;;) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

// In production the process is started with real environment variables and
// no .env file exists — that is not an error, so a miss is silent.
export function loadEnv(): void {
  const path = findEnvFile(process.cwd());
  if (path !== undefined) {
    config({ path });
  }
}
