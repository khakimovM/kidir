import { SetMetadata, type CustomDecorator } from "@nestjs/common";
import type { UserRole } from "@kidir/shared";

export const ROLES_KEY = "kidir:roles";

/**
 * Restricts a handler to the listed roles. Without it `RolesGuard` still runs
 * and still rejects suspended or banned accounts — it only skips the role
 * comparison.
 */
export const Roles = (...roles: readonly UserRole[]): CustomDecorator =>
  SetMetadata(ROLES_KEY, roles);
