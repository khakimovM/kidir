import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

// No eager $connect() in onModuleInit: the app must boot even when
// Postgres is unreachable (e.g. CI's lint/typecheck/test job has no
// database service). Prisma connects lazily on the first query, and
// HealthController surfaces connectivity via db:false instead of a
// crashed bootstrap.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
