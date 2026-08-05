import { HttpStatus } from "@nestjs/common";
import { ERROR_CODES, type UserStatus } from "@kidir/shared";
import { DomainException } from "../common/exceptions/domain.exception";

/**
 * The account-state gate for the login and refresh paths.
 *
 * `RolesGuard` enforces the same rule for already-authenticated requests; this
 * is the entry side of it, so a suspended account cannot mint a fresh pair of
 * cookies and walk back in.
 */
export function assertAccountUsable(user: { status: UserStatus }): void {
  if (user.status === "SUSPENDED") {
    throw new DomainException(
      ERROR_CODES.ACCOUNT_SUSPENDED,
      "Hisobingiz vaqtincha to'xtatilgan",
      HttpStatus.FORBIDDEN,
    );
  }

  if (user.status === "BANNED") {
    throw new DomainException(
      ERROR_CODES.ACCOUNT_BANNED,
      "Hisobingiz bloklangan",
      HttpStatus.FORBIDDEN,
    );
  }
}
