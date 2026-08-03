import { HttpException, HttpStatus } from "@nestjs/common";
import { ERROR_CODES, type ErrorCode } from "@kidir/shared";

/**
 * The only exception business code should throw. Carries a stable
 * SCREAMING_SNAKE code that clients can branch on; the message is for humans
 * and may change freely.
 *
 * Services throw it, `DomainExceptionFilter` renders it as
 * `{ error: { code, message } }`. Never throw raw HttpException from a
 * service — the code is what the web and admin apps switch on.
 */
export class DomainException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, status);
  }

  static notFound(message: string): DomainException {
    return new DomainException(ERROR_CODES.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }

  static forbidden(message: string): DomainException {
    return new DomainException(ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static unauthorized(code: ErrorCode, message: string): DomainException {
    return new DomainException(code, message, HttpStatus.UNAUTHORIZED);
  }

  static conflict(code: ErrorCode, message: string): DomainException {
    return new DomainException(code, message, HttpStatus.CONFLICT);
  }
}
