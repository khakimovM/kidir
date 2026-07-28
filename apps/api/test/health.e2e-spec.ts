import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns status ok", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.db).toBe("boolean");
  });
});
