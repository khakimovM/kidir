import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  ImATeapotException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodValidationException } from "nestjs-zod";
import { z } from "zod";
import { ERROR_CODES } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";
import { DomainExceptionFilter, type ErrorBody } from "./domain-exception.filter";

interface Rendered {
  status: number;
  body: ErrorBody;
}

/**
 * Captures what the filter would have sent. This is the single exit point for
 * every error leaving the API, so what it renders *is* the public error
 * contract (.claude/rules/api-design.md).
 */
function capture(): { host: ArgumentsHost; rendered: Rendered } {
  const rendered: Rendered = {
    status: 0,
    body: { error: { code: ERROR_CODES.INTERNAL_ERROR, message: "" } },
  };

  const response = {
    status(code: number) {
      rendered.status = code;
      return this;
    },
    json(body: ErrorBody) {
      rendered.body = body;
      return this;
    },
  } as unknown as Response;

  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  return { host, rendered };
}

function zodErrorFor(schema: z.ZodType, value: unknown): z.ZodError {
  const parsed = schema.safeParse(value);

  if (parsed.success) {
    throw new Error("zod xatosi kutilgan edi");
  }

  return parsed.error;
}

describe("DomainExceptionFilter", () => {
  const filter = new DomainExceptionFilter();
  let logged: jest.SpyInstance;

  beforeEach(() => {
    // The 500 path logs the original error; silencing it keeps the run readable
    // and lets the tests assert that it happens at all.
    logged = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  function render(exception: unknown): Rendered {
    const { host, rendered } = capture();
    filter.catch(exception, host);
    return rendered;
  }

  it("renders a DomainException with its own code and status", () => {
    const rendered = render(
      new DomainException(ERROR_CODES.PHONE_ALREADY_REGISTERED, "Band", HttpStatus.CONFLICT),
    );

    expect(rendered.status).toBe(409);
    expect(rendered.body).toEqual({
      error: { code: ERROR_CODES.PHONE_ALREADY_REGISTERED, message: "Band" },
    });
  });

  it("always answers with exactly one `error` key", () => {
    const rendered = render(DomainException.forbidden("Ruxsat yo'q"));

    expect(Object.keys(rendered.body)).toEqual(["error"]);
    expect(Object.keys(rendered.body.error).sort()).toEqual(["code", "message"]);
  });

  describe("validation failures", () => {
    it("reports the failing field and its message", () => {
      const error = zodErrorFor(z.object({ phone: z.string().min(5, "juda qisqa") }), {
        phone: "a",
      });

      const rendered = render(new ZodValidationException(error));

      expect(rendered.status).toBe(400);
      expect(rendered.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(rendered.body.error.message).toBe("phone: juda qisqa");
    });

    it("omits the prefix when the failure is on the root value", () => {
      const error = zodErrorFor(z.string(), 42);

      const rendered = render(new ZodValidationException(error));

      // An empty path must not produce a leading ": " — the issue's own message
      // is the whole answer.
      expect(rendered.body.error.message).toBe(error.issues[0]?.message);
      expect(rendered.body.error.message.length).toBeGreaterThan(0);
    });

    it("joins a nested path with dots", () => {
      const schema = z.object({ user: z.object({ email: z.email("email noto'g'ri") }) });
      const error = zodErrorFor(schema, { user: { email: "yaroqsiz" } });

      const rendered = render(new ZodValidationException(error));

      expect(rendered.body.error.message).toBe("user.email: email noto'g'ri");
    });

    /**
     * `getZodError()` is typed as unknown by nestjs-zod. A non-ZodError must
     * degrade to a generic message rather than crash the error handler itself —
     * a throw here would leave the request hanging.
     */
    it("degrades to a generic message when the payload is not a zod error", () => {
      const rendered = render(new ZodValidationException(new Error("boshqa xato")));

      expect(rendered.status).toBe(400);
      expect(rendered.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(rendered.body.error.message).toBe("Ma'lumotlar noto'g'ri");
    });

    it("degrades to a generic message when the zod error carries no issues", () => {
      const rendered = render(new ZodValidationException(new z.ZodError([])));

      expect(rendered.body.error.message).toBe("Ma'lumotlar noto'g'ri");
    });
  });

  describe("plain HttpExceptions", () => {
    it.each([
      [new BadRequestException("yomon"), 400, ERROR_CODES.VALIDATION_ERROR],
      [new NotFoundException("topilmadi"), 404, ERROR_CODES.NOT_FOUND],
      [new HttpException("kirish yo'q", HttpStatus.UNAUTHORIZED), 401, ERROR_CODES.UNAUTHORIZED],
      [new HttpException("man etilgan", HttpStatus.FORBIDDEN), 403, ERROR_CODES.FORBIDDEN],
      [new HttpException("ziddiyat", HttpStatus.CONFLICT), 409, ERROR_CODES.CONFLICT],
      [new HttpException("juda ko'p", HttpStatus.TOO_MANY_REQUESTS), 429, ERROR_CODES.RATE_LIMITED],
    ])("maps status %# onto the matching code", (exception, status, code) => {
      const rendered = render(exception);

      expect(rendered.status).toBe(status);
      expect(rendered.body.error.code).toBe(code);
    });

    it("falls back to INTERNAL_ERROR for a status with no mapping", () => {
      const rendered = render(new ImATeapotException("choynak"));

      expect(rendered.status).toBe(418);
      expect(rendered.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe("unexpected errors", () => {
    /**
     * The message of an unexpected error can carry a stack trace, a query or a
     * hash. None of that may reach a client, so the response is fixed text and
     * the detail goes to the log instead.
     */
    it("hides the original message behind a generic 500", () => {
      const rendered = render(new Error("select * from users where passwordHash = 'secret'"));

      expect(rendered.status).toBe(500);
      expect(rendered.body).toEqual({
        error: { code: ERROR_CODES.INTERNAL_ERROR, message: "Kutilmagan xatolik yuz berdi" },
      });
      expect(JSON.stringify(rendered.body)).not.toContain("passwordHash");
    });

    it("logs the original error with its stack", () => {
      const failure = new Error("ichki nosozlik");

      render(failure);

      expect(logged).toHaveBeenCalledTimes(1);
      expect(String(logged.mock.calls[0]?.[0])).toContain("ichki nosozlik");
      expect(logged.mock.calls[0]?.[1]).toBe(failure.stack);
    });

    it("handles a thrown value that is not an Error at all", () => {
      const rendered = render("nimadir noto'g'ri ketdi");

      expect(rendered.status).toBe(500);
      expect(rendered.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(logged).toHaveBeenCalledTimes(1);
      expect(logged.mock.calls[0]?.[1]).toBeUndefined();
    });

    it("does not log the 4xx responses", () => {
      render(DomainException.notFound("topilmadi"));

      expect(logged).not.toHaveBeenCalled();
    });

    /** A 5xx DomainException keeps its own code but must still be logged. */
    it("logs a DomainException raised as a 5xx", () => {
      const rendered = render(
        new DomainException(
          ERROR_CODES.INTERNAL_ERROR,
          "Google orqali kirish sozlanmagan",
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );

      expect(rendered.status).toBe(503);
      expect(rendered.body.error.message).toBe("Google orqali kirish sozlanmagan");
      expect(logged).toHaveBeenCalledTimes(1);
    });
  });
});
