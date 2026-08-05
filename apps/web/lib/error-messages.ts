import { ERROR_CODES } from "@kidir/shared";
import { CLIENT_ERROR_CODES, isApiError, type AnyErrorCode } from "./api-client";

/**
 * One Uzbek sentence per error code. The server's own `message` is only used
 * for codes this build does not know about, so wording stays under UI control
 * and never leaks server internals.
 */
const MESSAGES: Record<AnyErrorCode, string> = {
  [ERROR_CODES.VALIDATION_ERROR]: "Kiritilgan ma'lumotda xatolik bor. Maydonlarni tekshiring.",
  [ERROR_CODES.UNAUTHORIZED]: "Sessiya tugagan. Iltimos, qaytadan kiring.",
  [ERROR_CODES.FORBIDDEN]: "Bu amal uchun ruxsatingiz yo'q.",
  [ERROR_CODES.NOT_FOUND]: "Ma'lumot topilmadi.",
  [ERROR_CODES.CONFLICT]: "Bu amalni hozirgi holatda bajarib bo'lmaydi.",
  [ERROR_CODES.RATE_LIMITED]: "Juda ko'p urinish bo'ldi. Bir daqiqadan so'ng qayta urining.",
  [ERROR_CODES.INTERNAL_ERROR]: "Serverda xatolik yuz berdi. Birozdan so'ng qayta urining.",

  [ERROR_CODES.OTP_INVALID]: "Kod noto'g'ri. Qaytadan tekshirib kiriting.",
  [ERROR_CODES.OTP_EXPIRED]: "Kod muddati tugagan. Yangi kod so'rang.",
  [ERROR_CODES.OTP_TOO_MANY_ATTEMPTS]: "Urinishlar tugadi, yangi kod so'rang.",
  [ERROR_CODES.OTP_ALREADY_SENT]: "Kod allaqachon yuborilgan. Taymer tugashini kuting.",
  [ERROR_CODES.OTP_NOT_VERIFIED]:
    "Tasdiqlash muddati o'tib ketgan. Tasdiqlashni qaytadan boshlang.",

  [ERROR_CODES.INVALID_CREDENTIALS]: "Login yoki parol noto'g'ri.",
  [ERROR_CODES.PHONE_ALREADY_REGISTERED]: "Bu telefon raqam allaqachon ro'yxatdan o'tgan.",
  [ERROR_CODES.EMAIL_ALREADY_REGISTERED]: "Bu email allaqachon ro'yxatdan o'tgan.",

  [ERROR_CODES.REFRESH_TOKEN_INVALID]: "Sessiya yaroqsiz. Iltimos, qaytadan kiring.",
  [ERROR_CODES.REFRESH_REUSE_DETECTED]:
    "Xavfsizlik sababli barcha sessiyalar tugatildi. Qaytadan kiring.",
  [ERROR_CODES.SESSION_EXPIRED]: "Sessiya muddati tugadi. Iltimos, qaytadan kiring.",
  [ERROR_CODES.CSRF_HEADER_MISSING]: "So'rov xavfsizlik tekshiruvidan o'tmadi. Sahifani yangilang.",

  [ERROR_CODES.ACCOUNT_SUSPENDED]:
    "Hisobingiz vaqtincha to'xtatilgan. Qo'llab-quvvatlashga yozing.",
  [ERROR_CODES.ACCOUNT_BANNED]: "Hisobingiz bloklangan.",
  [ERROR_CODES.ONBOARDING_INCOMPLETE]: "Avval ro'yxatdan o'tishni yakunlang.",

  [ERROR_CODES.OAUTH_STATE_INVALID]: "Google orqali kirish amalga oshmadi. Qaytadan urining.",
  [ERROR_CODES.OAUTH_EMAIL_MISMATCH]: "Google hisobidagi email profildagi email bilan mos emas.",
  [ERROR_CODES.OAUTH_ROLE_NOT_ALLOWED]: "Google orqali kirish faqat buyurtmachilar uchun.",

  [ERROR_CODES.PORTFOLIO_LINK_NOT_ALLOWED]: "Bu sayt ruxsat etilganlar ro'yxatida yo'q.",

  [CLIENT_ERROR_CODES.NETWORK_ERROR]: "Serverga ulanib bo'lmadi. Internet aloqasini tekshiring.",
  [CLIENT_ERROR_CODES.MALFORMED_RESPONSE]: "Serverdan tushunarsiz javob keldi.",
};

const DEFAULT_MESSAGE = "Nimadir xato ketdi. Birozdan so'ng qayta urining.";

function isKnownCode(code: string): code is AnyErrorCode {
  return code in MESSAGES;
}

/** Uzbek text for any thrown value — safe to call in a `catch` block. */
export function errorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (!isApiError(error)) {
    return fallback;
  }

  if (isKnownCode(error.code)) {
    return MESSAGES[error.code];
  }

  return error.message.length > 0 ? error.message : fallback;
}
