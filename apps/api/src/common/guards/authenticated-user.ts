import type { Request } from "express";
import type { UserRole, UserStatus } from "@kidir/shared";

/**
 * What `JwtGuard` puts on the request. Deliberately narrow: `passwordHash` and
 * `googleId` must never travel with the request object, because anything
 * attached there is one careless `res.json(req.user)` away from the wire.
 *
 * `role` and `status` are read from the database on every request rather than
 * taken from the JWT: a moderator suspending an account has to take effect
 * now, not when the 15-minute access token expires.
 */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
