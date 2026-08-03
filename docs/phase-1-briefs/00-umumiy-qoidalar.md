# Faza 1 — Barcha terminallar uchun umumiy qoidalar

> Bu fayl har brifda havola qilinadi. Har terminal ishni boshlashdan oldin
> `CLAUDE.md`, `docs/PLAN.md` va `.claude/rules/**` ni o'qiydi.

## Egalik chegaralari (BUZILMAYDI)

Har terminal FAQAT o'z papkalariga yozadi. Boshqa papkadagi faylni o'zgartirish
kerak bo'lsa — **o'zgartirmaysan**, ORKESTR ga xabar berasan.

| Terminal | Faqat shu fayllarga yozadi                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| ORKESTR  | `packages/shared/**`, `apps/api/prisma/**`, `app.module.ts`, `main.ts`, `package.json`, `docs/**`                     |
| BACKEND  | `apps/api/src/auth/**`, `apps/api/src/common/guards/**`, `apps/api/src/common/decorators/**`, `apps/api/src/users/**` |
| INFRA    | `apps/api/src/providers/**`, `apps/api/src/redis/**`, `apps/api/src/otp/**`                                           |
| FRONTEND | `apps/web/app/**`, `apps/web/components/**`, `apps/web/lib/**`, `apps/web/hooks/**`                                   |
| TEST     | `**/*.spec.ts`, `apps/api/test/**`                                                                                    |
| AUDIT    | `docs/reviews/**` (kod YOZMAYDI)                                                                                      |

**`packages/shared` ga hech kim yozmaydi.** Kontrakt yetishmasa — ORKESTR ga ayt.
**`apps/api/package.json` ga hech kim tegmaydi** — Faza 1 ning barcha paketlari
allaqachon o'rnatilgan. Yangi paket kerak bo'lsa — ORKESTR ga ayt.

## Qat'iy texnik qoidalar

- **`any` TAQIQLANGAN** (eslint error). `unknown` + narrowing ishlat.
- Pul — hech qayerda `number` emas, `BigInt` (tiyin). Faza 1 da pul yo'q, lekin qoida amal qiladi.
- Barcha id — UUID v7, Prisma `@default(uuid(7))` allaqachon schemada.
- **Input validatsiyasi FAQAT `@kidir/shared` dagi zod schema orqali.**
  DTO: `import { createZodDto } from "nestjs-zod"` → `class LoginDto extends createZodDto(zLogin) {}`.
  Global `ZodValidationPipe` allaqachon ulangan — qo'lda parse qilish shart emas.
  Prisma'ga xom `req.body` BERILMAYDI.
- **Xato tashlash:** faqat `DomainException` (`apps/api/src/common`). Xom `HttpException`
  yoki `throw new Error()` review'da rad etiladi. Kodlar `ERROR_CODES` dan.
- Har protected endpoint: `JwtGuard` + `RolesGuard`. Guard'siz endpoint = review reject.
- Tokenlar **FAQAT** httpOnly + Secure + SameSite=Lax cookie'da. localStorage YO'Q.
- Redis kalitlari: `kidir:<domen>:<id>`, **TTL majburiy**. `redisKey()` helper bor
  (`apps/api/src/redis/redis.constants.ts`).
- Tashqi xizmat — faqat interfeys orqali (`SMS_PROVIDER`, `MAIL_PROVIDER` tokenlari).
  Implementatsiyani biznes kod import QILMAYDI.
- Biznes limitlar (OTP TTL, urinishlar soni, rate limit) — **hardcode EMAS**,
  `Config` jadvalidan (`CONFIG_KEYS` shared'da, seed'da qiymatlar bor).

## Tugatishdan oldin (MAJBURIY)

```bash
npm run lint && npm run typecheck && npm run test
```

Uchalasi ham yashil bo'lmasa — ish tugallanmagan hisoblanadi.

## Commit

Conventional commits, inglizcha: `feat(api): add refresh token rotation`.
Kichik va mantiqiy commitlar. `main` ga o'zing merge QILMAYSAN — ORKESTR qiladi.

## Tugagach

Qisqacha hisobot yoz (o'zbekcha): nima qilindi, qaysi fayllar, nima tekshirildi,
qaysi joyda shubha bor. Keyin ORKESTR ga xabar ber.

## Foydali

- Domen qoidalari: `kidir-domain` skill avtomatik yuklanadi (deal/escrow/jamoa savollarida).
- Lokal o'rnatish/muammolar: `docs/SETUP.md`
- Baza allaqachon ko'tarilgan bo'lishi kerak: `docker compose up -d`
