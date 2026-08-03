import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodValidationException } from "nestjs-zod";
import { ZodError } from "zod";
import { ERROR_CODES, type ErrorCode } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

const STATUS_TO_CODE: Partial<Record<HttpStatus, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
};

/**
 * Single exit point for every error leaving the API, so the shape is always
 * `{ error: { code, message } }` (see .claude/rules/api-design.md).
 *
 * Anything unrecognised becomes a generic 500: an unexpected error's message
 * can carry a stack trace, a query, or a hash, and none of that belongs in a
 * response. It is logged in full instead.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.describe(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled error: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private describe(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof DomainException) {
      return {
        status: exception.getStatus(),
        body: { error: { code: exception.code, message: exception.message } },
      };
    }

    // Thrown by the global ZodValidationPipe when a DTO fails to parse.
    if (exception instanceof ZodValidationException) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: this.firstZodMessage(exception),
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          error: {
            code: STATUS_TO_CODE[status as HttpStatus] ?? ERROR_CODES.INTERNAL_ERROR,
            message: exception.message,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: { code: ERROR_CODES.INTERNAL_ERROR, message: "Kutilmagan xatolik yuz berdi" },
      },
    };
  }

  // getZodError() is typed as unknown by nestjs-zod, so narrow it rather than
  // asserting: a non-ZodError would otherwise crash the error handler itself.
  private firstZodMessage(exception: ZodValidationException): string {
    const error = exception.getZodError();
    if (!(error instanceof ZodError)) {
      return "Ma'lumotlar noto'g'ri";
    }

    const issue = error.issues[0];
    if (issue === undefined) {
      return "Ma'lumotlar noto'g'ri";
    }

    const path = issue.path.join(".");
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  }
}
