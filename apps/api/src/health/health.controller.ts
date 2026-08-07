import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The one route that must answer without an account: uptime monitoring runs
 * anonymously. It says so explicitly now that the guards are global — before,
 * it was open by omission, which is the failure mode this route documents.
 */
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: "ok"; db: boolean }> {
    let db = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = false;
    }
    return { status: "ok", db };
  }
}
