# TERMINAL 2 — BACKEND (auth core)

## Worktree tayyorlash (asosiy repo'dan)

Windows `cmd.exe` da:

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree add ..\kidir-backend -b feature/phase-1-auth-core main
cd ..\kidir-backend
npm install
npm run generate --workspace=apps/api
copy ..\kidir\.env .env
claude
```

PowerShell'da oxirgi ikki qatordan biri farq qiladi: `Copy-Item ..\kidir\.env .env`

## Prompt (shu matnni Claude'ga ber)

---

Sen Kidir loyihasining BACKEND (auth core) terminalisan. Avval `CLAUDE.md`,
`docs/PLAN.md`, `docs/phase-1-briefs/00-umumiy-qoidalar.md`,
`.claude/rules/security.md` va `.claude/rules/api-design.md` ni o'qi.

**Sen FAQAT shu papkalarga yozasan:**
`apps/api/src/auth/**`, `apps/api/src/common/guards/**`,
`apps/api/src/common/decorators/**`, `apps/api/src/users/**`

`packages/shared`, `prisma/schema.prisma`, `app.module.ts`, `main.ts`,
`package.json` — TEGMAYSAN. Hammasi tayyor.

### Nima tayyor (shulardan foydalanasan)

- **Zod kontraktlar** `@kidir/shared` da: `zRegister`, `zLogin`, `zRequestPhoneOtp`,
  `zVerifyPhoneOtp`, `zRequestEmailOtp`, `zVerifyEmailOtp`, `zGoogleCallbackQuery`,
  `zSessionUser`, `zAuthResponse`, `zUpdateProfile`, `zPublicUser`, `ERROR_CODES`.
- **`DomainException`** (`apps/api/src/common`) + global exception filter
  (`{ error: { code, message } }`) + global `ZodValidationPipe`.
- **`OtpService`** abstract class (`apps/api/src/otp/otp.contract.ts`) —
  INFRA terminal implementatsiyani parallel yozayapti. Sen shu abstraksiyani
  inject qilasan va **kontraktni o'zgartirmaysan**. U hali yozilmagan bo'lsa ham
  senda typecheck o'tadi.
- **Prisma modellari**: `User` (phone/email/passwordHash/googleId/kycLevel/status),
  `RefreshToken` (`tokenHash` unique, `familyId`, `expiresAt`, `revokedAt`,
  `replacedById`, `ip`, `userAgent`) — schema o'zgartirish shart emas.
- `cookie-parser` va CORS (`X-Requested-With` ruxsat etilgan) `main.ts` da ulangan.
- Paketlar o'rnatilgan: `@nestjs/jwt`, `@nestjs/passport`, `passport-google-oauth20`,
  `argon2`, `@nestjs/throttler`.

### Vazifa 1 — Guardlar (`apps/api/src/common/guards/`)

- **`JwtGuard`** — access tokenni **cookie'dan** o'qiydi (header'dan EMAS),
  tekshiradi, `request.user` ga qo'yadi. `@Public()` dekoratori bilan belgilangan
  endpointlarni o'tkazib yuboradi.
- **`RolesGuard`** — `@Roles(...)` dekoratoridan kutilgan rollarni oladi
  (`CLIENT | WORKER | PM | MODERATOR | SUPERADMIN`).
  Foydalanuvchi `SUSPENDED`/`BANNED` bo'lsa → `ACCOUNT_SUSPENDED`/`ACCOUNT_BANNED`.
- **`CsrfGuard`** — GLOBAL. Har mutation (POST/PUT/PATCH/DELETE) da
  `X-Requested-With` header majburiy; yo'q bo'lsa → `CSRF_HEADER_MISSING` (403).
  GET/HEAD/OPTIONS tekshirilmaydi. Guard'ni `AuthModule` dan `APP_GUARD` bilan
  ro'yxatdan o'tkaz (`app.module.ts` ga TEGMA).
- Dekoratorlar `apps/api/src/common/decorators/`: `@Public()`, `@Roles()`,
  `@CurrentUser()`.

### Vazifa 2 — Auth service (`apps/api/src/auth/`)

**Parol:** argon2id (`argon2` paketi, `type: argon2.argon2id`). Boshqa algoritm yo'q.

**Tokenlar:**

- Access JWT — 15 daqiqa. Refresh — 30 kun (`Config` dan o'qisang yanada yaxshi).
- **Ikkalasi ham httpOnly + Secure + SameSite=Lax cookie'da.** Javob body'sida
  token YO'Q (`zAuthResponse` faqat `user` qaytaradi).
- `Secure` bayrog'i: `env.NODE_ENV === "production"` da majburiy;
  lokalda `http://localhost` uchun `false` bo'lishi mumkin — buni bitta joyda hal qil.
- Refresh cookie yo'li tor bo'lsin (masalan `/auth/refresh`), domen `env.COOKIE_DOMAIN`.

**Refresh rotation + reuse detection (ENG MUHIM):**

- DB'da faqat `tokenHash` saqlanadi (xom token EMAS) — sha256 yetarli, argon2 shart emas.
- Har refresh'da eski yozuv `revokedAt` bilan yopiladi, `replacedById` yangi yozuvga
  ishora qiladi, yangi token beriladi. `familyId` o'zgarmaydi.
- **Allaqachon revoke qilingan refresh token qayta ishlatilsa** → o'sha `familyId`
  dagi BARCHA tokenlar revoke qilinadi (foydalanuvchining hamma sessiyasi tugaydi)
  va `REFRESH_REUSE_DETECTED` qaytariladi.
- Rotation `prisma.$transaction` ichida — poyga holatida ikkita yangi token chiqmasin.

**Endpointlar** (`.claude/rules/api-design.md`: REST, DTO `createZodDto` dan):

| Metod  | Yo'l                      | Izoh                                                    |
| ------ | ------------------------- | ------------------------------------------------------- |
| `POST` | `/auth/otp/phone/request` | `@Public()`, throttle 5/min                             |
| `POST` | `/auth/otp/phone/verify`  | `@Public()`, throttle 5/min                             |
| `POST` | `/auth/register`          | `@Public()` — telefon avval tasdiqlangan bo'lishi shart |
| `POST` | `/auth/login`             | `@Public()`, throttle 5/min                             |
| `POST` | `/auth/refresh`           | `@Public()` (cookie bilan ishlaydi)                     |
| `POST` | `/auth/logout`            | JwtGuard                                                |
| `GET`  | `/auth/me`                | JwtGuard → `zSessionUser`                               |
| `POST` | `/auth/otp/email/request` | JwtGuard, throttle 5/min                                |
| `POST` | `/auth/otp/email/verify`  | JwtGuard → `emailVerifiedAt`                            |
| `GET`  | `/auth/google`            | `@Public()` — `state` generatsiya qilinadi              |
| `GET`  | `/auth/google/callback`   | `@Public()` — `state` MAJBURIY validatsiya              |

**Ro'yxatdan o'tish oqimi:** telefon OTP → `verify` → `register`.
`register` da `otpService.consumeVerification("phone", phone)` chaqiriladi;
`false` qaytsa → `OTP_NOT_VERIFIED`. Muvaffaqiyatda `phoneVerifiedAt` va
`kycLevel = PHONE` yoziladi.

**Xavfsizlik nuanslari:**

- Login xatosi **doim bir xil**: `INVALID_CREDENTIALS`. "Bunday user yo'q" va
  "parol xato" farqlanmaydi (user enumeration).
- User topilmasa ham argon2 verify chaqirilsin (dummy hash bilan) — timing attack.
- `passwordHash`, `googleId`, `tokenHash` hech qachon javobga chiqmaydi.
- Google OAuth **faqat CLIENT** uchun (`OAUTH_ROLE_NOT_ALLOWED`).
  `state` Redis'da TTL bilan saqlanadi va callback'da bir marta ishlatiladi.
- Rate limit: auth endpointlarida `@Throttle` bilan 5/min
  (qiymat `CONFIG_KEYS.AUTH_RATE_LIMIT_PER_MIN` dan).

### Vazifa 3 — Users moduli (auth tugagach)

`apps/api/src/users/`: onboarding qadamlarini saqlash va profil.

- `PATCH /users/me` — `zUpdateProfile` (har qadam alohida saqlanadi)
- `GET /users/:id` — `zPublicUser` (telefon/email CHIQMAYDI)
- Onboarding tugagani: telefon+email tasdiqlangan, fullName, WORKER uchun
  specialization + kamida 1 skill. `zSessionUser.onboardingComplete` shuni aks ettiradi.
- Portfolio linklar `zPortfolioLinks` bilan validatsiya qilinadi (allowlist tayyor).

### Testlar (MAJBURIY)

`apps/api/src/auth/auth.service.spec.ts` — pul emas, lekin **auth ham 100% branch**:

- refresh rotation → yangi token, eskisi revoke
- **reuse detection** → butun `familyId` revoke, `REFRESH_REUSE_DETECTED`
- noto'g'ri parol → `INVALID_CREDENTIALS`
- mavjud bo'lmagan user → **aynan o'sha** `INVALID_CREDENTIALS`
- `SUSPENDED` user login qila olmaydi
- telefon tasdiqlanmagan holda `register` → `OTP_NOT_VERIFIED`

Prisma mock qilinmaydi — test DB (docker'da ishlab turibdi).

### Tugagach

`npm run lint && npm run typecheck && npm run test` — uchalasi yashil.
Keyin o'zbekcha qisqa hisobot yoz va ORKESTR ga xabar ber.

---
