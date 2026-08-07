# Faza 1 (auth) — Kod review

> Sana: 2026-08-07 · Tekshirilgan commit: `b7aa4be` · Reviewer: ORKESTR terminali
> (`code-reviewer` agenti + qo'lda tasdiqlash)
>
> Qamrov: `apps/api/src/**` (53 fayl), `apps/web/**` (49 fayl),
> `packages/shared/src/**` (24 fayl), `prisma/schema.prisma`, eslint/tsconfig/turbo.

**KRITIK topilma yo'q.** 3 ta YUQORI, 8 ta O'RTA, 6 ta PAST.

---

## Kidir-kritik ro'yxati (avval shular tekshirildi)

| Tekshiruv                                              | Natija                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Float/Number bilan pul                                 | **Toza** — pul kodi bu fazada yo'q; `zMoneyTiyin = z.bigint()` (`shared/schemas/common.ts:3`), Prisma'da `BigInt` |
| `$transaction`/LedgerEntry'siz balans                  | **Toza** — balans o'zgarishi yo'q; `$transaction` faqat refresh rotation'da va to'g'ri ishlatilgan                |
| Guard'siz protected endpoint                           | **Toza** — ikkala controller'da ham class-level `@UseGuards(JwtGuard, RolesGuard)`                                |
| localStorage/sessionStorage'da token                   | **Toza** — `registration-draft.ts` faqat `role`/`phone`/`phoneVerified` saqlaydi                                  |
| CSRF headersiz mutation                                | **Toza** — global `CsrfGuard` + klient `X-Requested-With` yuboradi                                                |
| Provider implementatsiyasini to'g'ridan-to'g'ri import | **Toza** — `EskizSmsProvider`/`GmailSmtpMailProvider` faqat `providers.module.ts:23,27` da                        |
| Sanitizatsiyasiz render                                | **Toza** — `dangerouslySetInnerHTML`/`innerHTML` 0 marta                                                          |
| Duplikat type shared'dan tashqarida                    | **Buzilgan** — O-5 va O-4 ga qarang                                                                               |

---

## YUQORI

### Y-1 · `trust proxy` sozlanmagan

**Fayl:** `apps/api/src/main.ts:7-24` (tasdiqlandi: `trust proxy` ham,
`enableShutdownHooks` ham yo'q)

UZ VPS'da Docker Compose + reverse proxy ortida (`docs/PLAN.md` 4.4) Express
`req.ip` har doim proxy manzilini qaytaradi. Oqibati ikki tomonlama:

- `ThrottlerGuard` va `@Throttle({ limit: 5 })` **butun platforma uchun bitta
  5/min hisoblagichga** aylanadi — bitta odam login qilsa qolganlari bloklanadi
  (self-DoS).
- `sessionContext(request)` (`auth.controller.ts:214-216`) `RefreshToken.ip`
  ustuniga har doim bir xil proxy IP yozadi → o'g'irlangan sessiyani kuzatish
  imkonsiz.

**Fix:** `app.set("trust proxy", 1)` (aniq hop soni bilan — `true` qilib qo'yish
`X-Forwarded-For` spoofing'ga yo'l ochadi) va proxy'da header'ni majburan qayta
yozish. Bu xavfsizlik hisobotidagi L-1 bilan bir xil topilma.

### Y-2 · `JwtGuard`/`RolesGuard` global emas

**Fayl:** `apps/api/src/app.module.ts:22-35`

Guardlar faqat controller-level (`auth.controller.ts:48`, `users.controller.ts:16`).
Default holat = **himoyasiz**: yangi controller `@UseGuards` yozishni unutsa,
endpoint ochiq qoladi va hech qanday test ogohlantirmaydi. Kod dizayni allaqachon
global bo'lishga tayyor — `@Public()` va `isPublicRoute()` (`jwt.guard.ts:80-87`)
mavjud, `CsrfGuard` va `ThrottlerGuard` esa `APP_GUARD` orqali global. Bu
nomuvofiqlik.

`CLAUDE.md`: "Har endpoint'da JwtGuard + RolesGuard" ·
`.claude/rules/security.md`: "Guard'siz endpoint = review reject".

**Fix:** `app.module.ts` providers'ga `{ provide: APP_GUARD, useClass: JwtGuard }`
va `{ provide: APP_GUARD, useClass: RolesGuard }` (tartib muhim — JwtGuard
birinchi), controller-level `@UseGuards` larni olib tashlash, `HealthController` ga
`@Public()`. Xavfsizlik hisobotidagi H-3 bilan bir xil.

### Y-3 · `any` taqiqi `apps/web` da kuchga kirmaydi

**Fayl:** `apps/web/eslint.config.mjs:12-17` (tasdiqlandi)

Root `eslint.config.mjs:25` da `"@typescript-eslint/no-explicit-any": "error"` bor,
lekin `apps/web` o'z flat config'ini yozgan va root'ni `extends` qilmaydi — ESLint
cwd'dan yuqoriga qarab qidirishni birinchi topilgan configda to'xtatadi. Natijada
qoida `apps/api` va `packages/shared` da "error", `apps/web` da esa yo'q.

Hozircha kodda `any` **yo'q** (grep 0 natija), ya'ni qoida faqat intizom bilan
ushlab turilibdi — `CLAUDE.md` esa uni taqiqlangan deb belgilaydi.

**Fix:** `apps/web/eslint.config.mjs` ga aniq qo'shish:
`{ rules: { "@typescript-eslint/no-explicit-any": "error" } }`.

---

## O'RTA

### O-1 · Bir xil mantiq ikki joyda: account state tekshiruvi

`apps/api/src/common/guards/roles.guard.ts:36-50` ↔
`apps/api/src/auth/account-state.ts:12-27`

Ikkala blok ham SUSPENDED/BANNED uchun so'zma-so'z bir xil `DomainException`
tashlaydi (bir xil kod, bir xil matn, bir xil status). Uchinchi status qo'shilsa
(masalan `PENDING_REVIEW`) bittasi unutiladi.

**Fix:** `assertAccountUsable` ni `apps/api/src/common/account-state.ts` ga
ko'chirish (qatlam inversiyasini oldini olish uchun — hozir `common` `auth` dan
import qila olmaydi) va `RolesGuard` shuni chaqirsin.

### O-2 · `select` yo'q — `passwordHash` keraksiz joyga tortiladi

`apps/api/src/users/users.service.ts:84-92`

`requireUser()` butun `User` qatorini oladi — `passwordHash`, `googleId`, `phone`,
`email` ham. Bu `getPublicProfile()` (boshqa odamning profili!) yo'lida ham
ishlaydi. Serializer keyin ularni tashlaydi, lekin sirlar keraksiz joyda oqib
yuradi va `res.json(user)` xatosiga bir qadam qoladi.
`.claude/rules/database.md`: "select/include bilan faqat kerakli maydonlar".

**Fix:** `getPublicProfile` uchun alohida `select` (faqat `zPublicUser` maydonlari),
`getSessionUser` uchun `zSessionUser` maydonlari.

### O-3 · Ortiqcha so'rov `updateProfile` da

`apps/api/src/users/users.service.ts:77-78` — `requireUser(userId)` dan keyin
darhol `update`. Ikki round-trip; `update` allaqachon `P2025` tashlaydi.

**Fix:** `updateMany({ where: { id, deletedAt: null } })` yoki `update` ni
`try/catch` bilan.

### O-4 · Hardcode limitlar shared/config jadvalini takrorlaydi

`CLAUDE.md`: "Biznes limitlar hardcode EMAS" ·
`.claude/rules/architecture.md`: "Duplikat TAQIQLANGAN".

| Fayl:qator                                                       | Qiymat                        | Haqiqat manbai                                  |
| ---------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `apps/web/app/(auth)/onboarding/stacklar/skills-form.tsx:27`     | `MAX_SKILLS = 20`             | `zSkills.max(20)` (`shared/schemas/user.ts:27`) |
| `apps/web/app/(auth)/onboarding/portfolio/portfolio-form.tsx:19` | `MAX_LINKS = 10`              | `zPortfolioLinks.max(10)` (`user.ts:58`)        |
| `apps/web/app/(auth)/onboarding/portfolio/portfolio-form.tsx:18` | `MAX_BIO = 1000`              | `zBio.max(1000)` (`user.ts:8`)                  |
| `apps/web/lib/constants.ts:8`                                    | `OTP_MAX_ATTEMPTS = 3`        | DB `Config["otp.maxAttempts"]` (`seed.ts:26`)   |
| `.../telefon-tasdiq/phone-verify-form.tsx:83`                    | `"Kod 2 daqiqa amal qiladi."` | DB `Config["otp.ttlSeconds"]` (`seed.ts:25`)    |

**Fix:** shared'da limitlarni nomlangan konstanta sifatida eksport qilish
(`export const MAX_SKILLS = 20; export const zSkills = z.array(...).max(MAX_SKILLS)`)
va web shundan import qilsin. OTP TTL uchun server allaqachon
`OtpRequestResponse.expiresInSeconds` qaytaradi — UI matnni shu qiymatdan yassin.

### O-5 · Kontrakt type'i ikki joyda qayta chiqarilgan

`apps/api/src/auth/auth.service.ts:41-44` + `apps/web/lib/api-client/auth.ts:15-18`

`shared/schemas/auth.ts` `zRequestPhoneOtp`, `zVerifyPhoneOtp`, `zRequestEmailOtp`,
`zVerifyEmailOtp` schemalarini eksport qiladi, lekin ularning **type'larini
eksport qilmaydi** — tasdiqlandi, faylda faqat 5 ta type eksporti bor
(`SelfServiceRole`, `Register`, `Login`, `AuthResponse`, `OtpRequestResponse`).
Natijada API `z.infer<>` bilan, web esa o'zining `SchemaOutput<>` helper'i bilan
bir xil type'ni mustaqil qayta hosil qiladi — aynan "duplikat kontrakt" holati.

**Fix:** `shared/schemas/auth.ts` ga to'rtta type eksportini qo'shish va ikkala
tomondagi lokal derivatsiyani o'chirish.

### O-6 · `AUTH_RATE_LIMIT_PER_MIN` config jadvalidan o'qilmaydi

`apps/api/src/auth/auth.constants.ts:34` — `CONFIG_KEYS.AUTH_RATE_LIMIT_PER_MIN`
mavjud va seed qilingan (`seed.ts:27`), lekin hech qachon o'qilmaydi. Kod izohi
sababni to'g'ri tushuntiradi (`@Throttle` dekorator-vaqtida hisoblanadi), ya'ni bu
ongli qaror — lekin `CLAUDE.md` ning "limitlar DB config jadvalidan" qoidasi
baribir buzilgan va admin panelidan limitni o'zgartirish ishlamaydi.

**Fix:** `getTracker`/`getLimit` ni config jadvalidan (keshlangan) o'qiydigan
custom guard. `RedisOtpService.limits()` (`redis-otp.service.ts:207-232`) da
allaqachon aynan shu pattern bor — uni umumiy `ConfigService` ga chiqarib ikkalasi
ishlatsin.

### O-7 · `enableShutdownHooks()` chaqirilmagan

`apps/api/src/main.ts` (tasdiqlandi)

`RedisModule` `OnApplicationShutdown` (`redis.module.ts:48-60`), `PrismaService`
`OnModuleDestroy` (`prisma.service.ts:11-13`) implement qilgan, lekin Nest bu
hook'larni `enableShutdownHooks()` siz SIGTERM'da **chaqirmaydi**. Docker deploy
paytida Redis ulanishi `quit()` qilinmay uziladi, in-flight komandalar yo'qoladi.

**Fix:** `await app.listen(...)` dan oldin `app.enableShutdownHooks();`.

### O-8 · Index'siz foreign key'lar

`apps/api/prisma/schema.prisma` · `.claude/rules/database.md`: "har foreign key +
har filter ustuni index".

Indekssiz: `Config.updatedById`, `TeamMember.invitedById`,
`LedgerEntry.actorUserId`, `Conversation.teamId`, `Conversation.dealId`,
`Message.senderId`.

Faza 1 uchun faqat `Config` amalda ishlatiladi (ta'sir kichik), lekin
`Message.senderId` va `LedgerEntry.actorUserId` keyingi fazalarda issiq yo'lda
bo'ladi.

**Fix:** yangi migratsiyada shu 6 ustunga `@@index` (mavjud migratsiya
tahrirlanmasin).

---

## PAST

| Kod | Fayl                                                                         | Nima                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | `apps/api/package.json`                                                      | Ishlatilmaydigan bog'liqliklar: `@nestjs/passport`, `passport`, `passport-google-oauth20`, `@types/passport-google-oauth20` — tasdiqlandi, passport faqat `google-auth.service.ts:39` dagi **izohda** tilga olingan, hech qayerda import qilinmagan (OAuth2 oqimi qo'lda yozilgan). `nestjs-pino`/`pino`/`pino-http` ham ishlatilmaydi (`main.ts` da logger sozlanmagan). Passport'ni olib tashlash; pino'ni yo ulash (PLAN 4.4 talab qiladi), yo olib tashlash. |
| P-2 | `apps/api/src/users/users.controller.ts:31`                                  | `ParseUUIDPipe`, `zUuid` emas. `CLAUDE.md`: "input FAQAT shared zod schema bilan". Tashqi ta'siri kichik (`DomainExceptionFilter` xatoni `VALIDATION_ERROR` ga tarjima qiladi).                                                                                                                                                                                                                                                                                  |
| P-3 | `apps/api/src/auth/token.service.ts:144-153`                                 | Logout access token'ni bekor qilmaydi — xavfsizlik hisobotidagi M-1 bilan bir xil.                                                                                                                                                                                                                                                                                                                                                                               |
| P-4 | `apps/api/src/auth/auth.service.ts:171-173`                                  | Email enumeration (autentifikatsiyalangan). Telefon oqimida bu ataylab qilinmagan (`:69-74` dagi izoh ajoyib), email oqimida esa amalga oshirilgan — nomuvofiqlik. Xavfsizlik hisobotidagi M-4.                                                                                                                                                                                                                                                                  |
| P-5 | `apps/api/src/providers/required-env.ts:14`, `.../eskiz-sms.provider.ts:141` | Xom `Error` ishlatilgan. **Buzilish deb hisoblanmaydi**: `requiredEnv` bootstrap misconfiguration (klient hali yo'q), `EskizError` esa infra xatosi bo'lib `DomainExceptionFilter` uni umumiy 500 ga aylantiradi. Ro'yxatda so'ralgani uchun qayd etildi.                                                                                                                                                                                                        |
| P-6 | `apps/api/src/health/health.controller.ts:8-17`                              | Autentifikatsiyasiz `db: boolean` qaytaradi. Y-2 tuzatilgandan keyin `@Public()` kerak bo'ladi. UptimeRobot uchun `status` yetarli.                                                                                                                                                                                                                                                                                                                              |

---

## Toza deb tasdiqlangan bo'limlar

**Arxitektura / qatlamlar.** Controllerlarda biznes logika yo'q — ikkalasi ham
faqat DTO → service → response. Modullar aro chaqiruv faqat service orqali.
`apps/web` da `apps/admin` ga import yo'q (grep 0).

**Provider-interfeys pattern — namunali.** `OtpService` abstrakt klass sifatida
injection token bo'lib xizmat qiladi (`otp.contract.ts:22`), `RedisOtpService`
faqat `otp.module.ts:11` da bog'lanadi. SMS/Mail xuddi shunday.

**`any` — toza.** Butun `apps/**` + `packages/**` bo'yicha `: any` / `as any` /
`<any>` 0 natija. `@ts-ignore`/`@ts-expect-error`/`eslint-disable` ham 0.
`unknown` + zod narrowing izchil ishlatilgan.

**Zod validatsiya.** Global `ZodValidationPipe` (`common.module.ts:16`), barcha DTO
`createZodDto(shared schema)`. Prisma'ga xom `req.body` berilmaydi — `updateProfile`
maydonlarni qo'lda ko'chiradi. Google'ning javobi ham zod bilan narrow qilingan.

**Error handling.** Yagona `{ error: { code, message } }` konverti, barcha kodlar
`shared/constants/error-codes.ts` dan. Kutilmagan xato hech qachon o'z matnini
oshkor qilmaydi. Klientda `ApiError.code` bo'yicha branch + to'liq matn mapping.

**DB.** 21 model, hammasida `@default(uuid(7))` (v4/cuid/autoincrement 0 ta).
Loop ichida query yo'q (N+1 yo'q). `RefreshToken` da `tokenHash @unique`,
`userId`/`familyId`/`expiresAt` index'langan — rotation va reuse detection uchun
aynan kerakli indekslar.

**Endpoint xavfsizligi.** `@Public()` faqat o'rinli joylarda. `logout`, `me`,
`otp/email/*`, `phone/attach`, `/users/*` — hammasi himoyalangan. Rol o'sishi
imkonsiz (`zSelfServiceRole` faqat CLIENT|WORKER).

**Frontend dizayn tokenlari.** `globals.css` da `--color-*: initial`,
`--text-*: initial`, `--radius-*: initial` bilan Tailwind'ning o'z shkalasi
**butunlay o'chirilgan** — `bg-red-500` yoki `text-3xl` kompilyatsiya bo'lmaydi.
Grep tasdiqladi: hex rang va default shkalalar 0 natija.

**Interaktiv holatlar.** `button.tsx` (hover/active/disabled + `loading` →
`aria-busy`), `input.tsx` (hover/focus-visible/disabled/invalid), `radio-card.tsx`
(peer-checked/peer-focus-visible/peer-disabled), `slider.tsx`, `otp-input.tsx`.
Global `:focus-visible` ring va `prefers-reduced-motion`.

**Forma accessibility.** `Field` context id/`aria-describedby`/`aria-invalid` ni
avtomatik ulaydi, har `<label htmlFor>` bilan. `Alert` `role="alert"|"status"`.
`OtpInput` da har katakda `aria-label`, `autocomplete="one-time-code"`,
`inputMode="numeric"`, paste/backspace/arrow qo'llab-quvvatlash.

**Nomlash.** Fayllar `kebab-case.role.ts`, klasslar `PascalCase`, zod schemalar
`z*` prefiksi, konstantalar `SCREAMING_SNAKE`, Redis kalitlari
`kidir:<domen>:<id>`. O'lik kod topilmadi.

---

## Umumiy baho: 8.5/10

Faza 1 dan kutilgandan sezilarli yuqori sifat. Ayniqsa kuchli tomonlar:
user-enumeration himoyasi (decoy argon2 hash), refresh reuse detection'ning
transaction ichidagi `revokedAt: null` concurrency control'i, OTP'ning Lua-script
atomikligi va constant-time solishtiruvi, OAuth `state` uchun `GETDEL`, va
`toPublicUser` ning "maydon-maydon quramiz, spread qilmaymiz" prinsipi.
Izohlar _nima_ emas, _nega_ ekanini tushuntiradi.

Zaif tomon — infratuzilma sozlamalari (proxy, shutdown hooks) va limitlarni bitta
manbadan olish intizomi.

### Eng muhim 3 ta

1. **Y-2 — guardlar global emas.** Hozirgi 2 controller to'g'ri, lekin default
   "ochiq" bo'lgani uchun Faza 2 da qo'shiladigan har yangi controller potensial
   teshik. `@Public()`/`isPublicRoute()` allaqachon yozilgan — faqat `APP_GUARD` ga
   ko'chirish qoldi.
2. **Y-1 — `trust proxy` yo'q.** Prod'ga chiqishdan oldin majburiy: hozircha auth
   rate-limit butun platforma uchun umumiy 5/min bo'lib qoladi va `RefreshToken.ip`
   audit izi yaroqsiz.
3. **O-4 + O-5 — kontrakt va limitlar `packages/shared` dan tashqarida
   takrorlangan.** "Duplikat TAQIQLANGAN" qoidasining aniq buzilishi va uchta app
   orasidagi drift'ning birinchi urug'i — hozir arzon, keyin qimmat.
