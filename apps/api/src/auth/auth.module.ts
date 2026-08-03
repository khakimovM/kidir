import { Module } from "@nestjs/common";

/**
 * OWNER: backend terminal (feature/phase-1-auth-core).
 *
 * Registration/login (argon2id), access + refresh cookies, refresh rotation
 * with reuse detection, Google OAuth, and the guards in ../common/guards.
 * Imports OtpModule for the phone/email codes.
 */
@Module({})
export class AuthModule {}
