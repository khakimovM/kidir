import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { ERROR_CODES } from "@kidir/shared";
import { AppModule } from "../src/app.module";
import { Public } from "../src/common/decorators/public.decorator";

/**
 * Pins the guard default for every route added from here on.
 *
 * Until the guards moved to APP_GUARD they were listed per controller, so a
 * new controller that forgot `@UseGuards` was silently anonymous — the kind of
 * mistake nothing fails on. The controllers below are declared inside the test
 * precisely because they are what a future feature module looks like on its
 * first day: no guard decorators at all. If someone reverts the global
 * registration, `/test-unguarded` starts answering 200 and this suite fails,
 * rather than a deal or ledger route quietly opening in a later phase.
 */
@Controller("test-unguarded")
class UnguardedController {
  @Get()
  read(): { reached: true } {
    return { reached: true };
  }
}

@Controller("test-public")
class PublicController {
  @Public()
  @Get()
  read(): { reached: true } {
    return { reached: true };
  }
}

describe("global auth guards", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [UnguardedController, PublicController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a controller that declares no guards of its own", async () => {
    const response = await request(app.getHttpServer()).get("/test-unguarded");

    expect(response.status).toBe(401);
    expect((response.body as { error?: { code?: unknown } }).error?.code).toBe(
      ERROR_CODES.UNAUTHORIZED,
    );
  });

  it("still lets a route opt out with @Public()", async () => {
    const response = await request(app.getHttpServer()).get("/test-public");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reached: true });
  });

  it("keeps the health check reachable without an account", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect((response.body as { status?: unknown }).status).toBe("ok");
  });
});
