import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from "@nestjs/common";
import type { PublicUser, SessionUser } from "@kidir/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/authenticated-user";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

/**
 * Neither route says `@Public()`, so both are authenticated by the global
 * guards: profiles are visible to signed-in users, not to the open internet,
 * so scraping the worker base costs an account. No `@Roles(...)` — every role
 * has a profile — but `RolesGuard` still runs, which is what stops a suspended
 * account from editing itself.
 */
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch("me")
  updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ): Promise<SessionUser> {
    // The id comes from the access-token cookie, never from the payload.
    return this.users.updateProfile(current.id, body);
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string): Promise<PublicUser> {
    return this.users.getPublicProfile(id);
  }
}
