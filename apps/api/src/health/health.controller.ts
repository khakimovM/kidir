import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
