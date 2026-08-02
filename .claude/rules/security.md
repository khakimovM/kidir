# Xavfsizlik Qoidalari (Kidir — pul bilan ishlaydigan platforma!)

## Pul va escrow

- Pul: integer tiyin, BigInt. Float/Number arifmetikasi TAQIQLANGAN.
- Har balans o'zgarishi: `$transaction` + double-entry `LedgerEntry` (kimdan, kimga, qancha,
  sabab, dealId/milestoneId/amendmentId). Komissiya alohida ledger yozuvi.
- Balans to'g'ridan-to'g'ri UPDATE qilinmaydi — faqat ledger bilan atomik.
- To'lov endpointlari idempotent: `idempotencyKey` majburiy. PaymentProvider chaqiruvlari retry-safe.
- Dispute'da tegishli milestone puli muzlaydi; moderator qarori (refund/payout/split) ham ledger orqali.
- SubShartnoma ACCEPTED bo'lganda qo'shimcha summa atomik hold'ga — balans yetmasa tranzaksiya rollback.

## Auth (cookie-based!)

- Parol: argon2id. Access JWT 15 min + refresh — IKKALASI httpOnly+Secure+SameSite=Lax cookie'da.
  localStorage/sessionStorage'da token SAQLANMAYDI.
- CSRF: SameSite=Lax + har mutation (POST/PUT/PATCH/DELETE) da custom header (`X-Requested-With`)
  tekshiruvi. Guard darajasida global.
- Refresh rotation + reuse detection (eski refresh qayta ishlatilsa — barcha sessiyalar bekor).
- Har protected endpoint: JwtGuard + RolesGuard. Guard'siz endpoint = review reject.
- Google OAuth faqat client uchun; callback'da state parametri validatsiyasi.
- OTP: SMS (Eskiz) va email (Gmail SMTP, MailProvider orqali) — 6 raqam, 3 urinish, 2 min TTL, rate limit.

## Input va tashqi kontent

- Barcha input zod bilan (shared schema). Prisma'ga xom req.body BERILMAYDI.
- Portfolio/CV linklar: faqat allowlist (github.com, gitlab.com, linkedin.com, behance.net,
  dribbble.com, notion.site) + https. Preview render QILINMAYDI (SSRF himoya).
- Chat xabarlari sanitizatsiya (XSS); telefon raqamlar deal imzolanmaguncha maskalanadi.
- Fayl yuklash (v2): faqat ruxsatli mime + hajm limiti + rasm qayta enkodlash (sharp),
  StorageProvider orqali, path traversal himoya.

## Anti-fraud va nazorat

- Bir xil telefon/karta/fingerprint client↔worker juftligi → avtomatik flag → moderator navbati.
- Yangi jamoa: birinchi 2 deal'da "yangi jamoa" badge.
- Audit log: har moderator/superadmin harakati o'chirilmas jadvalga (append-only).
- Payout: SMS-tasdiqlangan telefon + karta egasi ismi = profil ismi. kycLevel: NONE|PHONE|FULL.
- Rate limiting: auth 5/min, qolgani standart. Secrets faqat env + zod-validatsiyalangan ConfigService.
