import { createZodDto } from "nestjs-zod";
import {
  zGoogleCallbackQuery,
  zLogin,
  zRegister,
  zRequestEmailOtp,
  zRequestPhoneOtp,
  zVerifyEmailOtp,
  zVerifyPhoneOtp,
} from "@kidir/shared";

/**
 * Every DTO is the shared zod schema and nothing else. The global
 * `ZodValidationPipe` parses against it, so a controller never sees a shape
 * the contract does not describe — and web, admin and api cannot drift.
 */
export class RequestPhoneOtpDto extends createZodDto(zRequestPhoneOtp) {}

export class VerifyPhoneOtpDto extends createZodDto(zVerifyPhoneOtp) {}

export class RequestEmailOtpDto extends createZodDto(zRequestEmailOtp) {}

export class VerifyEmailOtpDto extends createZodDto(zVerifyEmailOtp) {}

export class RegisterDto extends createZodDto(zRegister) {}

export class LoginDto extends createZodDto(zLogin) {}

export class GoogleCallbackQueryDto extends createZodDto(zGoogleCallbackQuery) {}
