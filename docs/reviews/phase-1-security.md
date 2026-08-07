# Faza 1 (auth) — Xavfsizlik auditi

> Sana: 2026-08-07 · Tekshirilgan commit: `b7aa4be` · Auditor: ORKESTR terminali
> (`security-auditor` agenti + qo'lda tasdiqlash)
>
> Har topilma kodda o'qib tasdiqlangan. Tasdiqlanmagan taxminlar hisobotga kiritilmagan.

## Qamrov

`apps/api/src/auth/**`, `apps/api/src/common/guards/**`, `apps/api/src/otp/**`,
`apps/api/src/providers/**`, `apps/api/src/users/**`, `apps/web/lib/api-client/**`.

**KRITIK topilma yo'q.** 3 ta YUQORI, 5 ta O'RTA, 5 ta PAST.

---

## YUQORI

### H-1 · Google OAuth `state` brauzerga bog'lanmagan → login CSRF

**Fayl:** `apps/api/src/auth/google-auth.service.ts:57-72` va `:106-116`

`state` Redis'ga shunchaki `"1"` qiymati bilan yoziladi
(`redis.set(stateKey(state), "1", ...)`). U qurbonning brauzeridagi hech qanday
cookie yoki sessiya bilan bog'lanmagan, shuning uchun faqat _"bu state bizning
serverdan chiqqan"_ ni isbotlaydi — _"bu callback aynan o'sha brauzerdan keldi"_ ni
EMAS. (Kodda `consumeState` GETDEL bilan bir martaligini to'g'ri ta'minlaydi;
muammo bir martalikda emas, egalikda.)

**Stsenariy:** hujumchi `GET /auth/google` ni ochib `state=S` oladi; o'z Google
akkaunti bilan consent'ni bajaradi va callback URL'dan `code=C` ni ushlab qoladi
(ishlatmaydi); keyin qurbonga
`https://api.kidir.net/auth/google/callback?code=C&state=S` havolasini yuboradi.
Bu oddiy GET navigatsiya — CsrfGuard GET'ni o'tkazadi. Natijada qurbonning
brauzeriga **hujumchi akkauntining cookie'lari** o'rnatiladi. Qurbon o'z profilida
deb o'ylab balans to'ldiradi, TZ yozadi, shaxsiy ma'lumot kiritadi — hammasi
hujumchi akkauntida qoladi.

**Tavsiya:** `buildAuthorizationUrl` da `state` bilan birga httpOnly + SameSite=Lax
bir martalik cookie qo'yish (`kidir_oauth_state`, TTL 10 daq); callback'da cookie
qiymatini query'dagi `state` bilan doimiy vaqtda solishtirish va cookie'ni tozalash.
Qo'shimcha: PKCE (`code_challenge`) va `nonce`.

### H-2 · Telefon/email almashtirish qayta autentifikatsiyasiz

**Fayl:** `apps/api/src/auth/auth.service.ts:200-220` (`attachPhone`),
`:180-192` (`verifyEmailOtp`)

`attachPhone` ning izohida "Google orqali kelgan, telefonsiz akkauntlar uchun"
deyilgan, lekin kodda **`user.phone === null` sharti yo'q**.
`assertPhoneAvailable(input.phone, userId)` foydalanuvchining o'z id'sini istisno
qiladi, shuning uchun `update` mavjud telefonni yangisiga bemalol almashtiradi.
Ya'ni bu amalda cheklovsiz "telefonni o'zgartirish" endpointi. `verifyEmailOtp`
ham xuddi shunday emailni almashtiradi.

Ikkalasi ham joriy parolni yoki ESKI kanalga OTP'ni talab qilmaydi va eski
raqam/emailga ogohlantirish yubormaydi.

**Stsenariy:** hujumchi 15 daqiqalik access cookie'ga ega bo'ldi (H-3 va M-1 bilan
birgalikda) → o'z telefoni va emailini biriktiradi → akkauntning barcha kontakt
kanallari hujumchida. `docs/PLAN.md` 5.2 bo'yicha payout "SMS-tasdiqlangan
telefon" ga bog'langani uchun bu payout kanalini egallashga olib boradi.

**Tavsiya:** (1) `attachPhone` da `user.phone === null` ni majburiy qilish, telefon
almashtirish uchun alohida oqim; (2) kontakt kanalini o'zgartirishda joriy parol
yoki eski kanalga OTP; (3) o'zgarishdan keyin eski kanalga xabar + barcha refresh
familylarni revoke.

### H-3 · `JwtGuard`/`RolesGuard` global emas — default "ochiq"

**Fayl:** `apps/api/src/app.module.ts:34`, `apps/api/src/health/health.controller.ts:4-6`

`CsrfGuard` (`auth.module.ts`) va `ThrottlerGuard` (`app.module.ts:34`) `APP_GUARD`
sifatida global, lekin `JwtGuard`/`RolesGuard` **yo'q** — ular har controller'da
qo'lda `@UseGuards(...)` bilan qo'yiladi. Ya'ni himoya "esdan chiqmaslik"
konventsiyasiga tayanadi va **fail-open** ishlaydi. Buning isboti allaqachon kodda:
`HealthController` da hech qanday guard yo'q (bu holda zararsiz, lekin `db: false`
ni anonim ko'rsatadi).

`.claude/rules/security.md` ning "Har protected endpoint: JwtGuard + RolesGuard"
qoidasi kod darajasida majburlanmagan. Faza 4-5 da deal, ledger va dispute
controllerlari qo'shilganda bitta unutilgan dekorator to'g'ridan-to'g'ri ochiq
endpointga aylanadi.

**Tavsiya:** `JwtGuard` va `RolesGuard` ni `APP_GUARD` sifatida global ro'yxatdan
o'tkazish — ular allaqachon `isPublicRoute` ni qo'llab-quvvatlaydi, ya'ni
`@Public()` ishlashda davom etadi — va `HealthController` ga aniq `@Public()`
qo'yish. Shunda default "yopiq" bo'ladi. **Bu Faza 2 boshlanishidan oldin
bajarilishi kerak**, chunki keyin har yangi modul xatoni takrorlash imkoniga ega.

---

## O'RTA

### M-1 · Access token revoke qilinmaydi — logout'dan keyin ham 15 daqiqa yashaydi

**Fayl:** `apps/api/src/common/guards/jwt.guard.ts:44-56`,
`apps/api/src/auth/token.service.ts:84-92, 144-160`

`JwtGuard` access JWT'ni tekshirganda faqat `user` jadvalini o'qiydi
(`id, role, status`) — sessiya yoki `familyId` revoke qilinganini tekshirmaydi.
Refresh tomoni benuqson qurilgan (rotation + reuse detection), access tomoni esa
butunlay stateless. Qurbon logout bosganda yoki reuse-detection butun familyni
o'ldirganda ham, o'g'irlangan access token to'liq 15 daqiqa ishlaydi va shu vaqt
ichida `PATCH /users/me`, `POST /auth/phone/attach` chaqira oladi (H-2 bilan
zanjir hosil qiladi).

**Tavsiya:** access JWT payload'iga `fam` (familyId) qo'shib, `JwtGuard` da
Redis'dagi "revoked families" to'plamiga qarshi tekshirish — revoke paytida
familyId'ni 15 daqiqalik TTL bilan Redis'ga yozish kifoya (bitta O(1) so'rov).

### M-2 · OTP tasdiq markeri chaqiruvchiga bog'lanmagan — telefon tasdig'ini o'g'irlash

**Fayl:** `apps/api/src/otp/redis-otp.service.ts:170, 248-250`
(`kidir:otp:verified:phone:<raqam>`), `apps/api/src/auth/auth.service.ts:92, 203`

Marker faqat telefon raqami bo'yicha kalitlanadi (`verifiedKey(channel, target)`)
va qiymati `"1"` — uni KIM yaratganini hech kim tekshirmaydi. 15 daqiqa yashaydi.

**Stsenariy:** hujumchi qurbonning raqamini biladi va uni ro'yxatdan o'tayotganini
payqadi. Qurbon `otp/phone/verify` ni muvaffaqiyatli bajargach, hujumchi o'z
akkaunti bilan `POST /auth/phone/attach` ni o'sha raqam bilan chaqiradi →
`consumeVerification` markerni **hujumchiga** beradi → qurbonning raqami hujumchi
akkauntiga biriktiriladi (`kycLevel: PHONE`). Qurbonning `register` chaqiruvi endi
`OTP_NOT_VERIFIED` bilan yiqiladi va u o'z raqami bilan ro'yxatdan o'ta olmaydi.

**Tavsiya:** `verify` javobida bir martalik opaque `verificationToken` (32 bayt
random) qaytarish va uni marker qiymati sifatida saqlash; `register` va
`attachPhone` o'sha tokenni majburiy input sifatida talab qilsin (GETDEL + doimiy
vaqtli solishtirish).

### M-3 · SMS xarajati bo'yicha abuse — `POST /auth/otp/phone/request` global cheklovsiz

**Fayl:** `apps/api/src/auth/auth.controller.ts:58-64`,
`apps/api/src/otp/redis-otp.service.ts:113-139`

Yagona to'siq — IP bo'yicha 5/min va raqam bo'yicha 120s lock. Bitta IP kuniga
~7200 ta turli raqamga SMS yubora oladi; Eskiz har SMS uchun pul oladi. Bu
to'g'ridan-to'g'ri moliyaviy zarar va operator oldida reputatsiya masalasi.

**Tavsiya:** kunlik global SMS cheklovi (Redis counter, limit config jadvalidan),
IP/24 bo'yicha sutkalik cap, chegaradan keyin CAPTCHA. Alert: kunlik SMS soni
odatdagidan 3× oshsa.

### M-4 · Email enumeration + so'ralmagan pochta oracle'i

**Fayl:** `apps/api/src/auth/auth.service.ts:170-173` → `assertEmailAvailable` (`:308-320`),
`apps/api/src/auth/auth.controller.ts:140-148`

`POST /auth/otp/email/request` ixtiyoriy email qabul qiladi: band bo'lsa
`EMAIL_ALREADY_REGISTERED` (409), aks holda o'sha manzilga haqiqiy xat ketadi.
Har qanday ro'yxatdan o'tgan foydalanuvchi shu tarzda "bu email Kidir'da bormi?"
degan savolga javob oladi va platformani begona manzillarga xat yuborish uchun
ishlatadi (domen reputatsiyasi + Gmail SMTP limitlari).

**Tavsiya:** band emailda ham bir xil neytral javob (xat yubormasdan), yoki
`assertEmailAvailable` ni faqat `verify` bosqichida qo'llash; per-user sutkalik
email OTP cheklovi.

### M-5 · Rate limit faqat IP bo'yicha, hisoblagich in-memory

**Fayl:** `apps/api/src/auth/auth.controller.ts:37-40`,
`apps/api/src/app.module.ts:24, 34`

`@Throttle` faqat IP kaliti bilan ishlaydi, `identifier` bo'yicha emas — tarqoq
(botnet/proxy) hujumchi bitta akkauntga cheksiz parol taxminlay oladi. Bundan
tashqari `ThrottlerModule.forRoot` xotira-storage bilan: bir nechta API instansi
yoki oddiy restart cheklovni nolga qaytaradi (Redis loyihada allaqachon bor).

**Tavsiya:** `ThrottlerStorageRedisService` ga o'tish + `login`/`otp` uchun
`identifier` (telefon/email) bo'yicha alohida hisoblagich (progressiv kechikish
yoki 15 daqiqalik lockout).

---

## PAST

| Kod | Fayl                                                               | Nima                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1 | `apps/api/src/main.ts:7-24`                                        | `trust proxy` sozlanmagan. Reverse proxy ortida barcha foydalanuvchilar bitta 5/min chelakni bo'lishadi (self-DoS) va `RefreshToken.ip` audit ustuni foydasiz bo'ladi. Deploy paytida aniq hop soni bilan (`app.set("trust proxy", 1)`) — `true` qilib qo'yish `X-Forwarded-For` spoofing'ga yo'l ochadi.           |
| L-2 | `apps/api/prisma/schema.prisma` (RefreshToken), `token.service.ts` | Muddati o'tgan refresh yozuvlari hech qachon tozalanmaydi. 30 kunlik TTL × har rotation = jadval cheksiz o'sadi. Faza 4 dagi BullMQ bilan kunlik cleanup job.                                                                                                                                                       |
| L-3 | `apps/api/src/auth/token.service.ts:84-92`                         | Legitim retry butun sessiyani o'ldirishi mumkin: rotation javobi yo'lda yo'qolsa, klient eski token bilan qayta uradi → reuse deb qaraladi → family revoke. Parallel poyga to'g'ri hal qilingan, ketma-ket retry esa qamrab olinmagan. Yechim: yangi token berilgandan keyin eskisiga 10-30 soniyalik grace window. |
| L-4 | `apps/api/src/main.ts`                                             | `helmet` o'rnatilmagan. API faqat JSON qaytargani uchun ta'sir past, lekin `X-Content-Type-Options: nosniff` va `Referrer-Policy` arzon qo'shimcha.                                                                                                                                                                 |
| L-5 | `apps/api/src/auth/google-auth.service.ts:27, 87`                  | `email_verified` optional va tekshiruv `=== false`. Google har doim yuboradi, lekin `undefined` holati tasdiqlanmagan manzilni qabul qiladi. `=== true` ga o'zgartirish arzon.                                                                                                                                      |
| L-6 | `apps/api/src/auth/auth.controller.ts:108-131`                     | `POST /auth/refresh` va `/auth/logout` da `@authThrottle` yo'q — faqat global 60/min. Token imzolangani uchun brute force real emas, lekin har chaqiruv JWT verify + bir necha DB so'rovi qiladi (arzon DoS yuzasi).                                                                                                |

---

## Toza deb tasdiqlangan bo'limlar

Bular tekshirildi va **muammo topilmadi** — bu ham natija:

**Token saqlash.** Tokenlar FAQAT cookie'da (`auth.cookies.ts:34-46`: httpOnly +
secure(prod) + SameSite=Lax); javob body'sida token yo'q (`zAuthResponse` faqat
`user` — `packages/shared/src/schemas/auth.ts:72`); DB'da faqat SHA-256 digest
(`auth.crypto.ts:10`, `RefreshToken.tokenHash @unique`); access TTL aynan 15 daqiqa;
access/refresh alohida secretlar bilan, ikkalasi ham `min(32)` (`config/env.ts:13-14`);
refresh cookie `path=/auth` bilan toraytirilgan. `localStorage` da token yo'q;
`sessionStorage` faqat `registration-draft.ts` da va u yerda parol ham, token ham
saqlanmaydi.

**Refresh rotation.** Reuse detection butun `familyId` ni revoke qiladi
(`token.service.ts:87, 155-160`); rotation `$transaction` ichida va poyga-himoyali
(`updateMany` + `revokedAt: null` filtri qator lock'i bilan) — bu joy haqiqatan
mustahkam.

**CSRF va CORS.** `CsrfGuard` `APP_GUARD` sifatida global, opt-out dekoratori yo'q —
yangi controller avtomatik qamraladi. Faqat GET/HEAD/OPTIONS o'tkaziladi
(`csrf.guard.ts:9, 34`). CORS aniq ro'yxat (`main.ts:17-21`), `"*"` yo'q,
`credentials: true`, `allowedHeaders` cheklangan — preflight custom header'ni
himoya qiladi, ya'ni CSRF zanjiri to'liq yopiq.

**OTP mexanikasi.** Kod `crypto.randomInt` bilan (`Math.random` yo'q);
solishtirish `timingSafeEqual` + oldindan SHA-256 (uzunlik ham sizmaydi);
urinishlar tugaganda kalit Lua ichida darhol o'chiriladi — parallel taxminlar
byudjetni "sotib ololmaydi"; `consumeVerification` atomik `GETDEL`;
TTL har doim qo'yiladi va TTL'siz kalit majburan almashtiriladi; kod hech qayerda
log'ga yozilmaydi (faqat Mock providerlar chiqaradi va prod'da ogohlantirish beradi).

**Login xavfsizligi.** Parol argon2id, OWASP parametrlari bilan
(`auth.constants.ts:42-47`); user enumeration yo'q — mavjud bo'lmagan user,
`passwordHash === null` (Google akkaunt) va noto'g'ri parol aynan bir xil
`INVALID_CREDENTIALS` beradi; timing attack'ga qarshi dummy hash `onModuleInit` da
isitiladi va har doim `argon2.verify` chaqiriladi; suspend/ban tekshiruvi faqat
parol isbotlangandan keyin — to'g'ri tartib.

**Rol eskalatsiyasi.** Schema darajasida bloklangan: `zSelfServiceRole` faqat
CLIENT|WORKER (`packages/shared/src/schemas/auth.ts:9`), `zUpdateProfile` da
`role`/`status` maydoni umuman yo'q. `role`/`status` har so'rovda DB'dan qayta
o'qiladi (`jwt.guard.ts:45-48`) — moderator suspend qilsa darhol kuchga kiradi.
Google faqat CLIENT roli uchun; callback redirect'i qattiq `env.WEB_URL`
(open redirect yo'q).

**Ma'lumot sizishi.** Serializer obyektni maydonma-maydon quradi
(`user.serializer.ts:49-61`), spread yo'q — kelajakda modelga qo'shilgan ustun
avtomatik sizib chiqmaydi. `GET /users/:id` faqat `PublicUser`, telefon/email yo'q.
`DomainExceptionFilter` noma'lum xatoni umumiy `INTERNAL_ERROR` ga aylantiradi,
stack faqat log'ga — Prisma xato matnlari, SQL va yo'llar javobga chiqmaydi.
Hardcode secret topilmadi.

**SSRF / portfolio linklar.** Allowlist + majburiy `https` + subdomen
`endsWith("." + domain)` bilan to'g'ri tekshiriladi
(`packages/shared/src/schemas/user.ts`) — `evil-github.com` va
`https://github.com@evil.com` ikkalasi ham rad etiladi; server tomonda ikkinchi
marta ham tekshiriladi (`users.service.ts:60-72`); preview render qilinmaydi.

**IDOR (Faza 1 doirasida).** `PATCH /users/me` id'ni faqat cookie'dan oladi,
body'dan emas; `CurrentUser` dekoratori user yo'q bo'lsa exception tashlaydi;
`RolesGuard` `request.user === undefined` da fail-closed ishlaydi.

---

## Umumiy baho: 8/10

Implementatsiya sifati yuqori. Refresh rotation'dagi poyga holati haqiqatan
to'g'ri hal qilingan, OTP Lua skriptlari atomik va doimiy vaqtli solishtirish
bilan, serializer maydonma-maydon qurilgan, timing attack va user enumeration
ataylab yopilgan, CSRF global. Kod izohlari qaror sabablarini yozadi — audit uchun
kamdan-kam uchraydigan sifat.

Asosiy zaifliklar bitta naqshdan kelib chiqadi: **"kirish nuqtasi" mustahkam,
lekin "kirgandan keyin" va "chetlab o'tish yo'llari" nozikroq** — OAuth callback
brauzerga bog'lanmagan (H-1), kontakt kanallarini almashtirish qayta
autentifikatsiyasiz (H-2), access token revoke qilinmaydi (M-1), guard'lar global
emas (H-3). Hech biri Faza 1'ning o'zida pul yo'qotishga olib kelmaydi (pul moduli
hali yo'q), lekin Faza 4 (escrow) ustiga qurilganda **har biri pul yo'liga tegadi**.

## Tavsiya etilgan tartib

1. **Faza 2 boshlanishidan oldin:** H-3 (guard'lar global) — keyinchalik har yangi
   modul xatoni takrorlash imkoniga ega bo'ladi, shuning uchun eng arzon vaqt shu.
2. **Faza 2 davomida:** H-1, H-2, M-2 — auth oqimiga tegadi, alohida `fix/` branch.
3. **Faza 4 (escrow) dan oldin:** M-1, M-5, L-1 — pul yo'liga bevosita tegadi.
4. **Faza 4 davomida:** M-3, L-2 (BullMQ joblar bilan birga).
5. **Istalgan vaqt:** M-4, L-3, L-4, L-5, L-6.
