import { AccountType, PrismaClient } from "@prisma/client";
import { CONFIG_KEYS } from "@kidir/shared";

const prisma = new PrismaClient();

const CONFIG_SEED: Record<string, number> = {
  [CONFIG_KEYS.COMMISSION_CLIENT_BPS]: 200,
  [CONFIG_KEYS.COMMISSION_WORKER_BPS]: 200,
  [CONFIG_KEYS.TEAM_MAX_ACTIVE_DEALS]: 3,
  [CONFIG_KEYS.WORKER_MAX_TEAMS]: 3,
  [CONFIG_KEYS.PM_MAX_TEAMS]: 1,
  [CONFIG_KEYS.MILESTONE_MIN_COUNT]: 1,
  [CONFIG_KEYS.MILESTONE_MAX_COUNT]: 5,
  [CONFIG_KEYS.MILESTONE_AUTO_COMPLETE_DAYS]: 5,
  [CONFIG_KEYS.DEADLINE_WARN_AT_PCT]: 80,
  [CONFIG_KEYS.DEADLINE_GRACE_HOURS]: 48,
  [CONFIG_KEYS.RATING_REVEAL_DAYS]: 14,
  [CONFIG_KEYS.DISPUTE_FIRST_RESPONSE_BUSINESS_DAYS]: 3,
  [CONFIG_KEYS.TEAM_NEW_BADGE_DEALS]: 2,
  [CONFIG_KEYS.OTP_TTL_SECONDS]: 120,
  [CONFIG_KEYS.OTP_MAX_ATTEMPTS]: 3,
  [CONFIG_KEYS.AUTH_RATE_LIMIT_PER_MIN]: 5,
};

// ESCROW, PLATFORM_COMMISSION, EXTERNAL are singleton platform accounts
// (userId: null). Account's @@unique([userId, type]) can't guarantee
// singleton-ness at the DB level (Postgres treats each NULL as distinct),
// so idempotency is enforced here via find-then-create.
const PLATFORM_ACCOUNT_TYPES: AccountType[] = ["ESCROW", "PLATFORM_COMMISSION", "EXTERNAL"];

async function seedConfig(): Promise<void> {
  for (const [key, value] of Object.entries(CONFIG_SEED)) {
    await prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

async function seedPlatformAccounts(): Promise<void> {
  for (const type of PLATFORM_ACCOUNT_TYPES) {
    const existing = await prisma.account.findFirst({ where: { type, userId: null } });
    if (!existing) {
      await prisma.account.create({ data: { type, userId: null } });
    }
  }
}

async function main(): Promise<void> {
  await seedConfig();
  await seedPlatformAccounts();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
